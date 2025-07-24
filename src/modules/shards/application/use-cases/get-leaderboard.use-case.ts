import { Injectable, Inject } from '@nestjs/common';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';

interface GetLeaderboardDto {
  seasonId: number;
  category?: 'total' | 'staking' | 'social' | 'developer' | 'referral';
  limit?: number;
  page?: number;
  search?: string;
  walletAddress?: string;
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  wallet: string;
  totalShards: number;
  stakingShards: number;
  socialShards: number;
  developerShards: number;
  referralShards: number;
  lastCalculatedAt: Date;
  rankChange?: number;
  lastActivity?: Date;
}

interface LeaderboardResult {
  seasonId: number;
  category: string;
  totalParticipants: number;
  totalEntries: number;
  entries: LeaderboardEntry[];
  userEntry?: LeaderboardEntry & { percentile: number };
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

@Injectable()
export class GetLeaderboardUseCase {
  constructor(
    @Inject('IShardBalanceRepository')
    private readonly shardBalanceRepository: IShardBalanceRepository,
    @Inject('ISeasonRepository')
    private readonly seasonRepository: ISeasonRepository,
  ) {}

  async execute(dto: GetLeaderboardDto): Promise<LeaderboardResult> {
    const {
      seasonId,
      category = 'total',
      limit = 100,
      page = 1,
      walletAddress,
    } = dto;

    const offset = (page - 1) * limit;

    const season = await this.seasonRepository.findById(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    const { balances, total } =
      await this.shardBalanceRepository.findTopBySeason(
        seasonId,
        limit,
        offset,
        category,
      );

    const entries: LeaderboardEntry[] = balances.map((balance, index) => ({
      rank: offset + index + 1,
      walletAddress: balance.walletAddress,
      wallet: balance.walletAddress,
      totalShards: balance.totalShards,
      stakingShards: balance.stakingShards,
      socialShards: balance.socialShards,
      developerShards: balance.developerShards,
      referralShards: balance.referralShards,
      lastCalculatedAt: balance.lastCalculatedAt,
      rankChange: 0,
      lastActivity: balance.lastCalculatedAt,
    }));

    let userEntry: LeaderboardResult['userEntry'] | undefined;
    if (walletAddress) {
      const userBalance =
        await this.shardBalanceRepository.findByWalletAndSeason(
          walletAddress,
          seasonId,
        );

      if (userBalance) {
        const userRank = await this.shardBalanceRepository.getWalletRank(
          walletAddress,
          seasonId,
          category,
        );

        const totalParticipants =
          await this.shardBalanceRepository.getTotalParticipantsBySeason(
            seasonId,
          );

        const percentile =
          totalParticipants > 0
            ? ((totalParticipants - userRank + 1) / totalParticipants) * 100
            : 0;

        userEntry = {
          rank: userRank,
          walletAddress: userBalance.walletAddress,
          wallet: userBalance.walletAddress,
          totalShards: userBalance.totalShards,
          stakingShards: userBalance.stakingShards,
          socialShards: userBalance.socialShards,
          developerShards: userBalance.developerShards,
          referralShards: userBalance.referralShards,
          lastCalculatedAt: userBalance.lastCalculatedAt,
          rankChange: 0,
          lastActivity: userBalance.lastCalculatedAt,
          percentile: Math.round(percentile * 100) / 100,
        };
      }
    }

    const totalParticipants =
      await this.shardBalanceRepository.getTotalParticipantsBySeason(seasonId);

    return {
      seasonId,
      category,
      totalParticipants,
      totalEntries: total,
      entries,
      userEntry,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  async getSeasonStats(seasonId: number): Promise<{
    totalParticipants: number;
    totalShardsIssued: number;
    averageShardsPerParticipant: number;
    topCategories: {
      staking: { total: number; percentage: number };
      social: { total: number; percentage: number };
      developer: { total: number; percentage: number };
      referral: { total: number; percentage: number };
    };
  }> {
    const season = await this.seasonRepository.findById(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    const totalParticipants =
      await this.shardBalanceRepository.getTotalParticipantsBySeason(seasonId);

    const totalShardsIssued =
      await this.shardBalanceRepository.getTotalShardsIssuedBySeason(seasonId);

    const averageShardsPerParticipant =
      totalParticipants > 0 ? totalShardsIssued / totalParticipants : 0;

    const allBalances =
      await this.shardBalanceRepository.findBySeason(seasonId);

    const categoryTotals = allBalances.reduce(
      (totals, balance) => {
        totals.staking += balance.stakingShards;
        totals.social += balance.socialShards;
        totals.developer += balance.developerShards;
        totals.referral += balance.referralShards;
        return totals;
      },
      { staking: 0, social: 0, developer: 0, referral: 0 },
    );

    const topCategories = {
      staking: {
        total: categoryTotals.staking,
        percentage:
          totalShardsIssued > 0
            ? (categoryTotals.staking / totalShardsIssued) * 100
            : 0,
      },
      social: {
        total: categoryTotals.social,
        percentage:
          totalShardsIssued > 0
            ? (categoryTotals.social / totalShardsIssued) * 100
            : 0,
      },
      developer: {
        total: categoryTotals.developer,
        percentage:
          totalShardsIssued > 0
            ? (categoryTotals.developer / totalShardsIssued) * 100
            : 0,
      },
      referral: {
        total: categoryTotals.referral,
        percentage:
          totalShardsIssued > 0
            ? (categoryTotals.referral / totalShardsIssued) * 100
            : 0,
      },
    };

    return {
      totalParticipants,
      totalShardsIssued,
      averageShardsPerParticipant:
        Math.round(averageShardsPerParticipant * 100) / 100,
      topCategories,
    };
  }

  async getUserPosition(dto: {
    wallet: string;
    seasonId: number;
    timeframe: string;
  }): Promise<LeaderboardEntry | null> {
    const userBalance = await this.shardBalanceRepository.findByWalletAndSeason(
      dto.wallet,
      dto.seasonId,
    );

    if (!userBalance) {
      return null;
    }

    const userRank = await this.shardBalanceRepository.getWalletRank(
      dto.wallet,
      dto.seasonId,
      'total',
    );

    return {
      rank: userRank,
      walletAddress: userBalance.walletAddress,
      wallet: userBalance.walletAddress,
      totalShards: userBalance.totalShards,
      stakingShards: userBalance.stakingShards,
      socialShards: userBalance.socialShards,
      developerShards: userBalance.developerShards,
      referralShards: userBalance.referralShards,
      lastCalculatedAt: userBalance.lastCalculatedAt,
      rankChange: 0,
      lastActivity: userBalance.lastCalculatedAt,
    };
  }

  async searchWalletInLeaderboard(
    searchTerm: string,
    seasonId: number,
    limit: number = 10,
  ): Promise<LeaderboardEntry[]> {
    const balances = await this.shardBalanceRepository.searchByWallet(
      searchTerm,
      seasonId,
      limit,
    );

    const entries = await Promise.all(
      balances.map(async (balance) => {
        const rank = await this.shardBalanceRepository.getWalletRank(
          balance.walletAddress,
          seasonId,
          'total',
        );

        return {
          rank,
          walletAddress: balance.walletAddress,
          wallet: balance.walletAddress,
          totalShards: balance.totalShards,
          stakingShards: balance.stakingShards,
          socialShards: balance.socialShards,
          developerShards: balance.developerShards,
          referralShards: balance.referralShards,
          lastCalculatedAt: balance.lastCalculatedAt,
          rankChange: 0,
          lastActivity: balance.lastCalculatedAt,
        };
      }),
    );

    return entries;
  }
}
