import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import {
  ReferralQueryDto,
  ReferralResponseDto,
  ErrorResponseDto,
  ApiError,
} from '../dto';
import { ManageReferralUseCase } from '../../application/use-cases/manage-referral.use-case';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import {
  SEASON_CHAINS,
  SEASON_1_CHAINS,
  SEASON_1_PRIMARY_CHAIN,
  REFERRAL_CONFIG,
} from '../../constants';

@ApiTags('referrals')
@Controller('shards')
export class ReferralsController {
  constructor(
    private readonly manageReferralUseCase: ManageReferralUseCase,
    private readonly manageSeasonUseCase: ManageSeasonUseCase,
  ) {}

  @Get(':walletAddress/referrals')
  @ApiOperation({
    summary: 'Get referral information for a wallet',
    description:
      'Returns referral status, referrals made, and active referral list',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Ethereum wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral information retrieved successfully',
    type: ReferralResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address or parameters',
    type: ErrorResponseDto,
  })
  async getReferrals(
    @Param('walletAddress') walletAddress: string,
    @Query() query: ReferralQueryDto,
  ): Promise<ReferralResponseDto> {
    try {
      if (!this.isValidWalletAddress(walletAddress)) {
        throw ApiError.invalidWalletAddress(walletAddress);
      }

      if (query.season && query.chain) {
        this.validateSeasonChain(query.season, query.chain);
      }

      const seasonId = query.season || (await this.getCurrentSeasonId());

      const referralData = await this.manageReferralUseCase.getReferralInfo({
        walletAddress,
        seasonId,
      });

      const activeReferrals =
        await this.manageReferralUseCase.getActiveReferrals({
          referrerAddress: walletAddress,
          seasonId,
        });

      return {
        wallet: walletAddress,
        season_id: seasonId,
        referrals_made: referralData.referralsMade,
        referrals_limit: REFERRAL_CONFIG.MAX_REFERRALS_PER_SEASON,
        total_referral_shards: referralData.totalReferralShards,
        referred_by: referralData.referredBy || undefined,
        referee_bonus_active: referralData.refereeBonusActive,
        referee_bonus_expires: referralData.refereeBonusExpires || undefined,
        active_referrals: activeReferrals.map((ref) => ({
          wallet: ref.wallet,
          referred_date: ref.referredDate,
          status: ref.status as 'active' | 'inactive',
          shards_earned: ref.shardsEarned,
        })),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: `/api/shards/${walletAddress}/referrals`,
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }
      throw error;
    }
  }

  @Post(':walletAddress/referrals')
  @ApiOperation({
    summary: 'Create a referral',
    description: 'Register a referee using a referral code (wallet address)',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Referee wallet address',
    example: '0x9abcdef012345678abcdef012345678abcdef01',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        referral_code: {
          type: 'string',
          description: 'Referrer wallet address as referral code',
          example: '0x1234567890abcdef1234567890abcdef12345678',
        },
      },
      required: ['referral_code'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Referral created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Referral registered successfully',
        },
        referee_bonus_expires: {
          type: 'string',
          example: '2025-02-14T00:00:00Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid referral or validation error',
    type: ErrorResponseDto,
  })
  async createReferral(
    @Param('walletAddress') walletAddress: string,
    @Body() body: { referral_code: string },
  ): Promise<{
    success: boolean;
    message: string;
    referee_bonus_expires?: string;
  }> {
    try {
      if (!this.isValidWalletAddress(walletAddress)) {
        throw ApiError.invalidWalletAddress(walletAddress);
      }

      if (!this.isValidWalletAddress(body.referral_code)) {
        throw ApiError.invalidWalletAddress(body.referral_code);
      }

      if (walletAddress.toLowerCase() === body.referral_code.toLowerCase()) {
        throw ApiError.selfReferralNotAllowed();
      }

      await this.manageReferralUseCase.createReferral({
        referrerAddress: body.referral_code,
        refereeAddress: walletAddress,
        seasonId: await this.getCurrentSeasonId(),
      });

      const bonusExpires = new Date();
      bonusExpires.setDate(
        bonusExpires.getDate() + REFERRAL_CONFIG.REFEREE_BONUS_DURATION_DAYS,
      );

      return {
        success: true,
        message: 'Referral registered successfully',
        referee_bonus_expires: bonusExpires.toISOString(),
      };
    } catch (error) {
      if (error instanceof ApiError || error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An error occurred while processing the referral',
          path: `/api/shards/${walletAddress}/referrals`,
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  private isValidWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private validateSeasonChain(season: number, chain: string): void {
    if (season === 1) {
      if (!SEASON_1_CHAINS.includes(chain as any)) {
        throw ApiError.seasonChainMismatch(season, `base or ethereum`, chain);
      }
    } else {
      const expectedChain = SEASON_CHAINS.SEASON_2_PLUS;
      if (chain !== expectedChain) {
        throw ApiError.seasonChainMismatch(season, expectedChain, chain);
      }
    }
  }

  private getChainForSeason(season: number): string {
    return season === 1 ? SEASON_1_PRIMARY_CHAIN : SEASON_CHAINS.SEASON_2_PLUS;
  }

  private async getCurrentSeasonId(): Promise<number> {
    const currentSeason = await this.manageSeasonUseCase.getCurrentSeason(
      SEASON_1_PRIMARY_CHAIN,
    );
    return currentSeason?.id || 1;
  }
}
