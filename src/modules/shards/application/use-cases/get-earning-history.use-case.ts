import { Injectable } from '@nestjs/common';
import { IShardEarningHistoryRepository } from '../../domain/repositories/shard-earning-history.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';

interface GetEarningHistoryDto {
  walletAddress: string;
  seasonId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface EarningHistoryEntry {
  date: Date;
  stakingShards: number;
  socialShards: number;
  developerShards: number;
  referralShards: number;
  dailyTotal: number;
  vaultBreakdown: Array<{
    vaultAddress: string;
    chain: string;
    tokenSymbol: string;
    balance: number;
    usdValue: number;
    shardsEarned: number;
  }>;
  metadata?: any;
}

interface EarningHistoryResult {
  walletAddress: string;
  seasonId?: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  summary: {
    totalDays: number;
    totalShards: number;
    avgDailyShards: number;
    breakdown: {
      staking: number;
      social: number;
      developer: number;
      referral: number;
    };
  };
  history: EarningHistoryEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

interface DailyAveragesDto {
  walletAddress: string;
  seasonId: number;
  days: number;
}

@Injectable()
export class GetEarningHistoryUseCase {
  constructor(
    private readonly shardEarningHistoryRepository: IShardEarningHistoryRepository,
    private readonly seasonRepository: ISeasonRepository,
  ) {}

  async execute(dto: GetEarningHistoryDto): Promise<EarningHistoryResult> {
    const {
      walletAddress,
      seasonId,
      startDate,
      endDate,
      limit = 30,
      offset = 0,
    } = dto;

    if (seasonId) {
      const season = await this.seasonRepository.findById(seasonId);
      if (!season) {
        throw new Error(`Season ${seasonId} not found`);
      }
    }

    const { history, total } =
      await this.shardEarningHistoryRepository.findByWallet(
        walletAddress,
        seasonId,
        startDate,
        endDate,
        limit,
        offset,
      );

    const summary = await this.shardEarningHistoryRepository.getSummaryByWallet(
      walletAddress,
      seasonId || 0, // If no seasonId, this will need to be handled
      startDate,
      endDate,
    );

    const entries: EarningHistoryEntry[] = history.map((h) => ({
      date: h.date,
      stakingShards: h.stakingShards,
      socialShards: h.socialShards,
      developerShards: h.developerShards,
      referralShards: h.referralShards,
      dailyTotal: h.dailyTotal,
      vaultBreakdown: h.vaultBreakdown.map((v) => ({
        vaultAddress: v.vaultId,
        chain: v.chain,
        tokenSymbol: v.asset,
        balance: 0, // Not stored in history
        usdValue: v.usdValue,
        shardsEarned: v.shardsEarned,
      })),
      metadata: h.metadata,
    }));

    return {
      walletAddress,
      seasonId,
      dateRange: {
        start: history.length > 0 ? history[history.length - 1].date : null,
        end: history.length > 0 ? history[0].date : null,
      },
      summary,
      history: entries,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  async getDailyAverages(dto: DailyAveragesDto): Promise<{
    walletAddress: string;
    seasonId: number;
    period: number;
    averages: {
      daily: number;
      staking: number;
      social: number;
      developer: number;
      referral: number;
    };
    trend: {
      direction: 'up' | 'down' | 'stable';
      percentage: number;
    };
  }> {
    const { walletAddress, seasonId, days } = dto;

    const currentAverage =
      await this.shardEarningHistoryRepository.getAverageDailyShards(
        walletAddress,
        seasonId,
        days,
      );

    const previousAverage =
      await this.shardEarningHistoryRepository.getAverageDailyShards(
        walletAddress,
        seasonId,
        days * 2,
      );

    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;

    if (previousAverage > 0) {
      const difference = currentAverage - previousAverage;
      trendPercentage = (difference / previousAverage) * 100;

      if (trendPercentage > 5) {
        trendDirection = 'up';
      } else if (trendPercentage < -5) {
        trendDirection = 'down';
      }
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summary = await this.shardEarningHistoryRepository.getSummaryByWallet(
      walletAddress,
      seasonId,
      startDate,
      endDate,
    );

    const avgDays = summary.totalDays || 1;

    return {
      walletAddress,
      seasonId,
      period: days,
      averages: {
        daily: currentAverage,
        staking: summary.breakdown.staking / avgDays,
        social: summary.breakdown.social / avgDays,
        developer: summary.breakdown.developer / avgDays,
        referral: summary.breakdown.referral / avgDays,
      },
      trend: {
        direction: trendDirection,
        percentage: Math.round(trendPercentage * 100) / 100,
      },
    };
  }

  async getTopEarningDays(
    walletAddress: string,
    seasonId: number,
    limit: number = 10,
  ): Promise<EarningHistoryEntry[]> {
    const { history } = await this.shardEarningHistoryRepository.findByWallet(
      walletAddress,
      seasonId,
      undefined,
      undefined,
      1000, // Get more records to sort
      0,
    );

    const sorted = history
      .sort((a, b) => b.dailyTotal - a.dailyTotal)
      .slice(0, limit);

    return sorted.map((h) => ({
      date: h.date,
      stakingShards: h.stakingShards,
      socialShards: h.socialShards,
      developerShards: h.developerShards,
      referralShards: h.referralShards,
      dailyTotal: h.dailyTotal,
      vaultBreakdown: h.vaultBreakdown.map((v) => ({
        vaultAddress: v.vaultId,
        chain: v.chain,
        tokenSymbol: v.asset,
        balance: 0, // Not stored in history
        usdValue: v.usdValue,
        shardsEarned: v.shardsEarned,
      })),
      metadata: h.metadata,
    }));
  }

  async getEarningStreaks(
    walletAddress: string,
    seasonId: number,
  ): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActiveDate: Date | null;
  }> {
    const { history } = await this.shardEarningHistoryRepository.findByWallet(
      walletAddress,
      seasonId,
      undefined,
      undefined,
      365, // Get up to a year of data
      0,
    );

    if (history.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        lastActiveDate: null,
      };
    }

    const sorted = history.sort((a, b) => a.date.getTime() - b.date.getTime());

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    const lastActiveDate = sorted[sorted.length - 1].date;

    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = Math.floor(
        (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActive = new Date(lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);

    const daysSinceLastActive = Math.floor(
      (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastActive <= 1) {
      // Still active
      currentStreak = tempStreak;
    }

    return {
      currentStreak,
      longestStreak,
      totalActiveDays: history.length,
      lastActiveDate,
    };
  }
}
