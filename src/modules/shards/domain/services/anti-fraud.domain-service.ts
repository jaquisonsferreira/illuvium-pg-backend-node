import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IShardEarningHistoryRepository } from '../repositories/shard-earning-history.repository.interface';
import { ANTI_FRAUD_CONFIG } from '../../constants';

export interface FraudCheckResult {
  isSuspicious: boolean;
  reasons: string[];
  score: number; // 0-100, higher = more suspicious
  recommendations: string[];
}

export interface WalletProfile {
  walletAddress: string;
  transactionCount: number;
  firstSeenDate?: Date;
  averageDailyShards: number;
  maxDailyShards: number;
  earningPatternVariance: number;
  relatedWallets: string[];
}

@Injectable()
export class AntiFraudDomainService {
  private readonly minTransactions: number;
  private readonly fraudThreshold: number;
  private readonly maxDailyVariance: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly shardEarningHistoryRepo: IShardEarningHistoryRepository,
  ) {
    this.minTransactions = this.configService.get(
      'MIN_WALLET_TRANSACTIONS',
      ANTI_FRAUD_CONFIG.MIN_WALLET_TRANSACTIONS,
    );
    this.fraudThreshold = this.configService.get(
      'FRAUD_DETECTION_THRESHOLD',
      ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD,
    );
    this.maxDailyVariance = this.configService.get(
      'MAX_DAILY_VARIANCE',
      ANTI_FRAUD_CONFIG.MAX_DAILY_VARIANCE,
    );
  }

  async checkWallet(
    walletAddress: string,
    dailyShards: number,
    seasonId: number,
    transactionCount?: number,
  ): Promise<FraudCheckResult> {
    const result: FraudCheckResult = {
      isSuspicious: false,
      reasons: [],
      score: 0,
      recommendations: [],
    };

    if (
      transactionCount !== undefined &&
      transactionCount < this.minTransactions
    ) {
      result.reasons.push(
        `Wallet has only ${transactionCount} transactions (minimum: ${this.minTransactions})`,
      );
      result.score += 20;
      result.recommendations.push(
        'Verify wallet has genuine on-chain activity',
      );
    }

    const earningPattern = await this.analyzeEarningPattern(
      walletAddress,
      seasonId,
      dailyShards,
    );
    if (earningPattern.isSuspicious) {
      result.reasons.push(...earningPattern.reasons);
      result.score += earningPattern.suspicionScore;
      result.recommendations.push(...earningPattern.recommendations);
    }

    if (dailyShards === 0) {
      // Not suspicious, just no earnings
      return result;
    }

    if (dailyShards > 50000) {
      result.reasons.push('Extremely high daily shard earnings');
      result.score += 30;
      result.recommendations.push(
        'Manual review required for high-value account',
      );
    }

    // Determine if suspicious based on score
    result.isSuspicious = result.score >= 50;

    return result;
  }

  private async analyzeEarningPattern(
    walletAddress: string,
    seasonId: number,
    currentDailyShards: number,
  ): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    suspicionScore: number;
    recommendations: string[];
  }> {
    const result = {
      isSuspicious: false,
      reasons: [] as string[],
      suspicionScore: 0,
      recommendations: [] as string[],
    };

    const avgDailyShards =
      await this.shardEarningHistoryRepo.getAverageDailyShards(
        walletAddress,
        seasonId,
        30, // Last 30 days
      );

    if (avgDailyShards === 0) {
      // New earner, check if first earning is suspiciously high
      if (currentDailyShards > 5000) {
        result.reasons.push('First-time earner with unusually high shards');
        result.suspicionScore += 25;
        result.recommendations.push('Verify source of earnings for new wallet');
      }
      return result;
    }

    // Check variance from average
    const variance = currentDailyShards / avgDailyShards;

    if (variance > this.fraudThreshold) {
      result.isSuspicious = true;
      result.reasons.push(
        `Daily earnings ${variance.toFixed(1)}x higher than 30-day average (${avgDailyShards.toFixed(2)} shards)`,
      );
      result.suspicionScore += Math.min(40, variance * 4); // Cap at 40 points
      result.recommendations.push(
        'Review earning sources for unusual activity',
      );
    } else if (variance > this.maxDailyVariance) {
      result.reasons.push('High variance in daily earnings');
      result.suspicionScore += 15;
      result.recommendations.push('Monitor for pattern consistency');
    }

    return result;
  }

  async checkWalletClustering(
    walletAddress: string,
    relatedTransactions: string[],
  ): Promise<{
    isClustered: boolean;
    clusterSize: number;
    suspicionScore: number;
  }> {
    // Simple clustering check based on transaction patterns
    const uniqueRelatedWallets = new Set(
      relatedTransactions.filter(
        (addr) => addr.toLowerCase() !== walletAddress.toLowerCase(),
      ),
    );
    const clusterSize = uniqueRelatedWallets.size;

    // If wallet interacts with too few unique addresses, might be part of a farm
    if (clusterSize < 5 && relatedTransactions.length > 50) {
      return {
        isClustered: true,
        clusterSize,
        suspicionScore: 30,
      };
    }

    return {
      isClustered: false,
      clusterSize,
      suspicionScore: 0,
    };
  }

  async checkReferralAbuse(
    referrerAddress: string,
    refereeAddresses: string[],
  ): Promise<{
    isAbusive: boolean;
    reasons: string[];
  }> {
    const result = {
      isAbusive: false,
      reasons: [] as string[],
    };

    // Check 1: Self-referral (already prevented in entity)
    if (refereeAddresses.includes(referrerAddress.toLowerCase())) {
      result.isAbusive = true;
      result.reasons.push('Self-referral detected');
    }

    // Check 2: All referees created at similar times (potential bot farm)
    // This would need additional data about wallet creation times

    // Check 3: Referees with no genuine activity
    // This check would be done during referral activation

    return result;
  }

  calculateFraudScore(checks: {
    walletAge?: number; // days
    transactionCount?: number;
    earningVariance?: number;
    clusteringScore?: number;
    referralAbuseScore?: number;
  }): number {
    let score = 0;

    // Wallet age score (newer = more suspicious)
    if (checks.walletAge !== undefined) {
      if (checks.walletAge < 7) score += 20;
      else if (checks.walletAge < 30) score += 10;
    }

    // Transaction count score
    if (checks.transactionCount !== undefined) {
      if (checks.transactionCount < 10) score += 25;
      else if (checks.transactionCount < this.minTransactions) score += 15;
    }

    // Earning variance score
    if (checks.earningVariance !== undefined) {
      if (checks.earningVariance > this.fraudThreshold) score += 30;
      else if (checks.earningVariance > this.maxDailyVariance) score += 15;
    }

    // Clustering score
    if (checks.clusteringScore !== undefined) {
      score += checks.clusteringScore;
    }

    // Referral abuse score
    if (checks.referralAbuseScore !== undefined) {
      score += checks.referralAbuseScore;
    }

    return Math.min(100, score); // Cap at 100
  }

  isHighRisk(fraudScore: number): boolean {
    return fraudScore >= 70;
  }

  isMediumRisk(fraudScore: number): boolean {
    return fraudScore >= 40 && fraudScore < 70;
  }

  isLowRisk(fraudScore: number): boolean {
    return fraudScore < 40;
  }
}
