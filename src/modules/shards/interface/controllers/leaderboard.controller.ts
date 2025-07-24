import { Controller, Get, Query, HttpException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import {
  LeaderboardQueryDto,
  LeaderboardResponseDto,
  ErrorResponseDto,
  ApiError,
} from '../dto';
import { GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';

@ApiTags('leaderboard')
@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(
    private readonly getLeaderboardUseCase: GetLeaderboardUseCase,
    private readonly manageSeasonUseCase: ManageSeasonUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get shard leaderboard',
    description:
      'Returns the shard leaderboard with optional filtering and user position',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
    type: LeaderboardResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponseDto,
  })
  async getLeaderboard(
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    try {
      if (query.user_wallet && !this.isValidWalletAddress(query.user_wallet)) {
        throw ApiError.invalidWalletAddress(query.user_wallet);
      }

      const page = query.page || 1;
      const limit = query.limit || 100;
      const timeframe = query.timeframe || 'all_time';
      const seasonId = query.season || (await this.getCurrentSeasonId());

      const leaderboardData = await this.getLeaderboardUseCase.execute({
        seasonId,
        page,
        limit,
        search: query.search,
      });

      let userPosition;
      if (query.include_user_position && query.user_wallet) {
        userPosition = await this.getUserPosition(
          query.user_wallet,
          seasonId,
          timeframe,
        );
      }

      return {
        season_id: seasonId,
        timeframe,
        data: leaderboardData.entries.map((entry, index) => ({
          rank: (page - 1) * limit + index + 1,
          wallet: entry.wallet,
          total_shards: entry.totalShards,
          staking_shards: entry.stakingShards,
          social_shards: entry.socialShards,
          developer_shards: entry.developerShards,
          referral_shards: entry.referralShards,
          rank_change: entry.rankChange,
          last_activity: entry.lastActivity?.toISOString(),
        })),
        pagination: {
          page,
          limit,
          totalItems: leaderboardData.totalEntries,
          totalPages: Math.ceil(leaderboardData.totalEntries / limit),
        },
        user_position: userPosition,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: '/api/leaderboard',
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

  private async getCurrentSeasonId(): Promise<number> {
    const currentSeason =
      await this.manageSeasonUseCase.getCurrentSeason('base');
    return currentSeason?.id || 1;
  }

  private async getUserPosition(
    wallet: string,
    seasonId: number,
    timeframe: string,
  ): Promise<any> {
    const userStats = await this.getLeaderboardUseCase.getUserPosition({
      wallet,
      seasonId,
      timeframe,
    });

    if (!userStats) {
      return undefined;
    }

    return {
      wallet,
      rank: userStats.rank,
      total_shards: userStats.totalShards,
      staking_shards: userStats.stakingShards,
      social_shards: userStats.socialShards,
      developer_shards: userStats.developerShards,
      referral_shards: userStats.referralShards,
    };
  }
}
