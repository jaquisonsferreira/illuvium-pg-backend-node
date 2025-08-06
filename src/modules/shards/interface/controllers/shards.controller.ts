import { Controller, Get, Param, Query, HttpException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  ShardBalanceQueryDto,
  ShardBalanceResponseDto,
  ShardHistoryQueryDto,
  ShardHistoryResponseDto,
  ErrorResponseDto,
  ApiError,
} from '../dto';
import { CalculateDailyShardsUseCase } from '../../application/use-cases/calculate-daily-shards.use-case';
import { GetEarningHistoryUseCase } from '../../application/use-cases/get-earning-history.use-case';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import {
  SEASON_CHAINS,
  SEASON_1_CHAINS,
  SEASON_1_PRIMARY_CHAIN,
} from '../../constants';

@ApiTags('shards')
@Controller('shards')
export class ShardsController {
  constructor(
    private readonly calculateDailyShardsUseCase: CalculateDailyShardsUseCase,
    private readonly getEarningHistoryUseCase: GetEarningHistoryUseCase,
    private readonly manageSeasonUseCase: ManageSeasonUseCase,
  ) {}

  @Get(':walletAddress')
  @ApiOperation({
    summary: 'Get shard balance for a wallet',
    description:
      'Returns the current shard balance and breakdown for a specific wallet address',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Ethereum wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Shard balance retrieved successfully',
    type: ShardBalanceResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address or parameters',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Wallet not found or has no shard data',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async getShardBalance(
    @Param('walletAddress') walletAddress: string,
    @Query() query: ShardBalanceQueryDto,
  ): Promise<ShardBalanceResponseDto> {
    try {
      if (!this.isValidWalletAddress(walletAddress)) {
        throw ApiError.invalidWalletAddress(walletAddress);
      }

      if (query.season && query.chain) {
        this.validateSeasonChain(query.season, query.chain);
      }

      const seasonId = query.season || (await this.getCurrentSeasonId());

      const currentSeasonData = await this.calculateDailyShardsUseCase.execute({
        walletAddress,
        seasonId,
        date: new Date(),
      });

      const response: ShardBalanceResponseDto = {
        wallet: walletAddress,
        current_season: {
          season_id: seasonId,
          season_name: `Season ${seasonId}`,
          staking_shards: currentSeasonData.stakingShards,
          social_shards: currentSeasonData.socialShards,
          developer_shards: currentSeasonData.developerShards,
          referral_shards: currentSeasonData.referralShards,
          total_shards: currentSeasonData.totalShards,
          vaults_breakdown: currentSeasonData.vaultBreakdown.map((vault) => ({
            vault_id: vault.vaultAddress,
            chain: vault.chain,
            asset: vault.tokenSymbol,
            balance: vault.balance,
            usd_value: vault.usdValue,
            shards_earned: vault.shardsEarned,
          })),
        },
        total_shards_from_all_seasons: currentSeasonData.totalShards,
        last_updated: new Date().toISOString(),
      };

      if (query.include_all_seasons) {
        response.season_history = await this.getSeasonHistory(walletAddress);
      }

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: `/api/shards/${walletAddress}`,
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }
      throw error;
    }
  }

  @Get(':walletAddress/history')
  @ApiOperation({
    summary: 'Get shard earning history',
    description:
      'Returns the daily earning history for a wallet with optional filtering',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Ethereum wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Earning history retrieved successfully',
    type: ShardHistoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address or parameters',
    type: ErrorResponseDto,
  })
  async getShardHistory(
    @Param('walletAddress') walletAddress: string,
    @Query() query: ShardHistoryQueryDto,
  ): Promise<ShardHistoryResponseDto> {
    try {
      if (!this.isValidWalletAddress(walletAddress)) {
        throw ApiError.invalidWalletAddress(walletAddress);
      }

      if (query.season && query.chain) {
        this.validateSeasonChain(query.season, query.chain);
      }

      const page = query.page || 1;
      const limit = query.limit || 30;
      const seasonId = query.season || (await this.getCurrentSeasonId());

      const historyData = await this.getEarningHistoryUseCase.execute({
        walletAddress,
        seasonId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit,
        offset: (page - 1) * limit,
      });

      const summary = {
        season_id: seasonId,
        period_total: historyData.history.reduce(
          (sum, item) => sum + item.dailyTotal,
          0,
        ),
        avg_daily:
          historyData.history.length > 0
            ? historyData.history.reduce(
                (sum, item) => sum + item.dailyTotal,
                0,
              ) / historyData.history.length
            : 0,
      };

      return {
        data: historyData.history.map((item) => ({
          date: item.date.toISOString().split('T')[0],
          season_id: seasonId,
          staking_shards: item.stakingShards,
          vaults_breakdown: item.vaultBreakdown.map((vault) => ({
            vault_id: vault.vaultAddress,
            chain: vault.chain,
            asset: vault.tokenSymbol,
            balance: vault.balance,
            usd_value: vault.usdValue,
            shards_earned: vault.shardsEarned,
          })),
          social_shards: item.socialShards,
          developer_shards: item.developerShards,
          referral_shards: item.referralShards,
          daily_total: item.dailyTotal,
        })),
        pagination: {
          page,
          limit,
          totalItems: historyData.pagination.total,
          totalPages: Math.ceil(historyData.pagination.total / limit),
        },
        summary,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: `/api/shards/${walletAddress}/history`,
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }
      throw error;
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

  private async getCurrentSeasonId(): Promise<number> {
    const currentSeason = await this.manageSeasonUseCase.getCurrentSeason(
      SEASON_1_PRIMARY_CHAIN,
    );
    return currentSeason?.id || 1;
  }

  private async getSeasonHistory(walletAddress: string): Promise<any[]> {
    const allSeasons = await this.manageSeasonUseCase.getUpcomingSeasons();
    const seasonHistory: any[] = [];

    for (const season of allSeasons) {
      const balance = await this.calculateDailyShardsUseCase.execute({
        walletAddress,
        seasonId: season.id,
        date: new Date(),
      });

      if (balance.totalShards > 0) {
        seasonHistory.push({
          season_id: season.id,
          season_name: season.name,
          total_shards: balance.totalShards,
          staking_shards: balance.stakingShards,
          social_shards: balance.socialShards,
          developer_shards: balance.developerShards,
          referral_shards: balance.referralShards,
        });
      }
    }

    return seasonHistory;
  }
}
