import { Injectable } from '@nestjs/common';
import { ANTI_FRAUD_CONFIG } from '../../constants';

export interface FraudDetectionResult {
  isValid: boolean;
  suspiciousActivity: boolean;
  flaggedReasons: string[];
  riskScore: number;
}

export interface WalletVerificationData {
  walletAddress: string;
  transactionCount: number;
  accountAge: number;
  earningPattern: {
    dailyAverage: number;
    variance: number;
    spikes: number;
  };
}

@Injectable()
export class FraudDetectionDomainService {
  validateWalletEligibility(
    data: WalletVerificationData,
  ): FraudDetectionResult {
    const flaggedReasons: string[] = [];
    let riskScore = 0;
    let suspiciousActivity = false;

    if (data.transactionCount < ANTI_FRAUD_CONFIG.MIN_WALLET_TRANSACTIONS) {
      flaggedReasons.push(
        `Insufficient transaction history: ${data.transactionCount} < ${ANTI_FRAUD_CONFIG.MIN_WALLET_TRANSACTIONS}`,
      );
      riskScore += 30;
    }

    if (data.earningPattern.variance > ANTI_FRAUD_CONFIG.MAX_DAILY_VARIANCE) {
      flaggedReasons.push(
        `High earning variance: ${data.earningPattern.variance}x > ${ANTI_FRAUD_CONFIG.MAX_DAILY_VARIANCE}x`,
      );
      riskScore += 40;
      suspiciousActivity = true;
    }

    if (
      data.earningPattern.spikes > ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD
    ) {
      flaggedReasons.push(
        `Unusual earning spikes: ${data.earningPattern.spikes}x > ${ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD}x`,
      );
      riskScore += 50;
      suspiciousActivity = true;
    }

    return {
      isValid: riskScore < 50,
      suspiciousActivity,
      flaggedReasons,
      riskScore,
    };
  }

  validateReferralEligibility(
    referrerAddress: string,
    refereeAddress: string,
    referralCount: number,
  ): FraudDetectionResult {
    const flaggedReasons: string[] = [];
    let riskScore = 0;

    if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
      flaggedReasons.push('Self-referral detected');
      riskScore += 100;
    }

    if (referralCount >= 10) {
      flaggedReasons.push(`Referral limit exceeded: ${referralCount} >= 10`);
      riskScore += 80;
    }

    return {
      isValid: riskScore < 50,
      suspiciousActivity: riskScore > 70,
      flaggedReasons,
      riskScore,
    };
  }

  detectAnomalousEarnings(
    walletAddress: string,
    dailyShards: number,
    historicalAverage: number,
  ): FraudDetectionResult {
    const flaggedReasons: string[] = [];
    let riskScore = 0;
    let suspiciousActivity = false;

    if (
      dailyShards >
      historicalAverage * ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD
    ) {
      flaggedReasons.push(
        `Anomalous daily earnings: ${dailyShards} > ${historicalAverage * ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD}`,
      );
      riskScore += 60;
      suspiciousActivity = true;
    }

    if (dailyShards < 0) {
      flaggedReasons.push('Negative shard value detected');
      riskScore += 100;
      suspiciousActivity = true;
    }

    return {
      isValid: riskScore < 50,
      suspiciousActivity,
      flaggedReasons,
      riskScore,
    };
  }

  shouldRequireManualReview(results: FraudDetectionResult[]): boolean {
    return results.some(
      (result) => result.suspiciousActivity || result.riskScore > 70,
    );
  }

  generateFraudReport(
    walletAddress: string,
    results: FraudDetectionResult[],
  ): {
    walletAddress: string;
    overallRiskScore: number;
    requiresManualReview: boolean;
    allFlaggedReasons: string[];
    timestamp: Date;
  } {
    const overallRiskScore = Math.max(...results.map((r) => r.riskScore));
    const allFlaggedReasons = results.flatMap((r) => r.flaggedReasons);
    const requiresManualReview = this.shouldRequireManualReview(results);

    return {
      walletAddress,
      overallRiskScore,
      requiresManualReview,
      allFlaggedReasons,
      timestamp: new Date(),
    };
  }
}
