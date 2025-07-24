import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionDomainService } from './fraud-detection.domain-service';
import { ANTI_FRAUD_CONFIG } from '../../constants';

describe('FraudDetectionDomainService', () => {
  let service: FraudDetectionDomainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FraudDetectionDomainService],
    }).compile();

    service = module.get<FraudDetectionDomainService>(
      FraudDetectionDomainService,
    );
  });

  describe('validateWalletEligibility', () => {
    it('should validate eligible wallet', () => {
      const data = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        transactionCount: 50,
        accountAge: 30,
        earningPattern: {
          dailyAverage: 1000,
          variance: 2,
          spikes: 3,
        },
      };

      const result = service.validateWalletEligibility(data);

      expect(result.isValid).toBe(true);
      expect(result.suspiciousActivity).toBe(false);
      expect(result.flaggedReasons).toHaveLength(0);
      expect(result.riskScore).toBe(0);
    });

    it('should flag wallet with insufficient transactions', () => {
      const data = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        transactionCount: 10,
        accountAge: 30,
        earningPattern: {
          dailyAverage: 1000,
          variance: 2,
          spikes: 3,
        },
      };

      const result = service.validateWalletEligibility(data);

      expect(result.isValid).toBe(true); // Risk score 30 < 50
      expect(result.suspiciousActivity).toBe(false);
      expect(result.flaggedReasons).toContain(
        `Insufficient transaction history: 10 < ${ANTI_FRAUD_CONFIG.MIN_WALLET_TRANSACTIONS}`,
      );
      expect(result.riskScore).toBe(30);
    });

    it('should flag wallet with high variance', () => {
      const data = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        transactionCount: 50,
        accountAge: 30,
        earningPattern: {
          dailyAverage: 1000,
          variance: 8, // > 5 (MAX_DAILY_VARIANCE)
          spikes: 3,
        },
      };

      const result = service.validateWalletEligibility(data);

      expect(result.isValid).toBe(true); // Risk score 40 < 50
      expect(result.suspiciousActivity).toBe(true);
      expect(result.flaggedReasons).toContain(
        `High earning variance: 8x > ${ANTI_FRAUD_CONFIG.MAX_DAILY_VARIANCE}x`,
      );
      expect(result.riskScore).toBe(40);
    });

    it('should flag wallet with unusual spikes', () => {
      const data = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        transactionCount: 50,
        accountAge: 30,
        earningPattern: {
          dailyAverage: 1000,
          variance: 2,
          spikes: 15, // > 10 (FRAUD_DETECTION_THRESHOLD)
        },
      };

      const result = service.validateWalletEligibility(data);

      expect(result.isValid).toBe(false); // Risk score 50
      expect(result.suspiciousActivity).toBe(true);
      expect(result.flaggedReasons).toContain(
        `Unusual earning spikes: 15x > ${ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD}x`,
      );
      expect(result.riskScore).toBe(50);
    });

    it('should accumulate multiple risk factors', () => {
      const data = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        transactionCount: 5,
        accountAge: 7,
        earningPattern: {
          dailyAverage: 1000,
          variance: 8,
          spikes: 15,
        },
      };

      const result = service.validateWalletEligibility(data);

      expect(result.isValid).toBe(false); // Risk score 120 > 50
      expect(result.suspiciousActivity).toBe(true);
      expect(result.flaggedReasons).toHaveLength(3);
      expect(result.riskScore).toBe(120); // 30 + 40 + 50
    });
  });

  describe('validateReferralEligibility', () => {
    it('should validate eligible referral', () => {
      const result = service.validateReferralEligibility(
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12',
        3,
      );

      expect(result.isValid).toBe(true);
      expect(result.suspiciousActivity).toBe(false);
      expect(result.flaggedReasons).toHaveLength(0);
      expect(result.riskScore).toBe(0);
    });

    it('should flag self-referral', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const result = service.validateReferralEligibility(
        address,
        address.toUpperCase(),
        3,
      );

      expect(result.isValid).toBe(false); // Risk score 100 > 50
      expect(result.suspiciousActivity).toBe(true); // Risk score 100 > 70
      expect(result.flaggedReasons).toContain('Self-referral detected');
      expect(result.riskScore).toBe(100);
    });

    it('should flag excessive referrals', () => {
      const result = service.validateReferralEligibility(
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12',
        10,
      );

      expect(result.isValid).toBe(false); // Risk score 80 > 50
      expect(result.suspiciousActivity).toBe(true); // Risk score 80 > 70
      expect(result.flaggedReasons).toContain(
        'Referral limit exceeded: 10 >= 10',
      );
      expect(result.riskScore).toBe(80);
    });
  });

  describe('detectAnomalousEarnings', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should validate normal earnings', () => {
      const result = service.detectAnomalousEarnings(walletAddress, 1200, 1000);

      expect(result.isValid).toBe(true);
      expect(result.suspiciousActivity).toBe(false);
      expect(result.flaggedReasons).toHaveLength(0);
      expect(result.riskScore).toBe(0);
    });

    it('should flag anomalous high earnings', () => {
      const dailyShards = 12000;
      const historicalAverage = 1000;
      const result = service.detectAnomalousEarnings(
        walletAddress,
        dailyShards,
        historicalAverage,
      );

      expect(result.isValid).toBe(false); // Risk score 60 > 50
      expect(result.suspiciousActivity).toBe(true);
      expect(result.flaggedReasons).toContain(
        `Anomalous daily earnings: 12000 > ${historicalAverage * ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD}`,
      );
      expect(result.riskScore).toBe(60);
    });

    it('should flag negative shards', () => {
      const result = service.detectAnomalousEarnings(walletAddress, -100, 1000);

      expect(result.isValid).toBe(false); // Risk score 100 > 50
      expect(result.suspiciousActivity).toBe(true);
      expect(result.flaggedReasons).toContain('Negative shard value detected');
      expect(result.riskScore).toBe(100);
    });
  });

  describe('shouldRequireManualReview', () => {
    it('should not require review for low risk', () => {
      const results = [
        {
          isValid: true,
          suspiciousActivity: false,
          flaggedReasons: [],
          riskScore: 10,
        },
        {
          isValid: true,
          suspiciousActivity: false,
          flaggedReasons: [],
          riskScore: 20,
        },
      ];

      expect(service.shouldRequireManualReview(results)).toBe(false);
    });

    it('should require review for suspicious activity', () => {
      const results = [
        {
          isValid: true,
          suspiciousActivity: false,
          flaggedReasons: [],
          riskScore: 10,
        },
        {
          isValid: false,
          suspiciousActivity: true,
          flaggedReasons: ['test'],
          riskScore: 60,
        },
      ];

      expect(service.shouldRequireManualReview(results)).toBe(true);
    });

    it('should require review for high risk score', () => {
      const results = [
        {
          isValid: true,
          suspiciousActivity: false,
          flaggedReasons: [],
          riskScore: 10,
        },
        {
          isValid: false,
          suspiciousActivity: false,
          flaggedReasons: ['test'],
          riskScore: 75,
        },
      ];

      expect(service.shouldRequireManualReview(results)).toBe(true);
    });
  });

  describe('generateFraudReport', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should generate report with single result', () => {
      const results = [
        {
          isValid: true,
          suspiciousActivity: false,
          flaggedReasons: ['Test reason'],
          riskScore: 30,
        },
      ];

      const report = service.generateFraudReport(walletAddress, results);

      expect(report.walletAddress).toBe(walletAddress);
      expect(report.overallRiskScore).toBe(30);
      expect(report.requiresManualReview).toBe(false);
      expect(report.allFlaggedReasons).toEqual(['Test reason']);
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should generate report with multiple results', () => {
      const results = [
        {
          isValid: true,
          suspiciousActivity: false,
          flaggedReasons: ['Reason 1'],
          riskScore: 30,
        },
        {
          isValid: false,
          suspiciousActivity: true,
          flaggedReasons: ['Reason 2', 'Reason 3'],
          riskScore: 80,
        },
      ];

      const report = service.generateFraudReport(walletAddress, results);

      expect(report.walletAddress).toBe(walletAddress);
      expect(report.overallRiskScore).toBe(80); // Max of all scores
      expect(report.requiresManualReview).toBe(true);
      expect(report.allFlaggedReasons).toEqual([
        'Reason 1',
        'Reason 2',
        'Reason 3',
      ]);
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should handle empty results', () => {
      const results: any[] = [];

      const report = service.generateFraudReport(walletAddress, results);

      expect(report.walletAddress).toBe(walletAddress);
      expect(report.overallRiskScore).toBe(-Infinity); // Math.max of empty array
      expect(report.requiresManualReview).toBe(false);
      expect(report.allFlaggedReasons).toEqual([]);
      expect(report.timestamp).toBeInstanceOf(Date);
    });
  });
});
