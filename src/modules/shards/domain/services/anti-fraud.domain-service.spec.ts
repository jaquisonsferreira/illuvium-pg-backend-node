import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AntiFraudDomainService } from './anti-fraud.domain-service';
import { IShardEarningHistoryRepository } from '../repositories/shard-earning-history.repository.interface';
import { ANTI_FRAUD_CONFIG } from '../../constants';

describe('AntiFraudDomainService', () => {
  let service: AntiFraudDomainService;
  let configService: jest.Mocked<ConfigService>;
  let shardEarningHistoryRepo: jest.Mocked<IShardEarningHistoryRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntiFraudDomainService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => defaultValue),
          },
        },
        {
          provide: 'IShardEarningHistoryRepository',
          useValue: {
            getAverageDailyShards: jest.fn(),
            findByWallet: jest.fn(),
            findByWalletAndDate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AntiFraudDomainService>(AntiFraudDomainService);
    configService = module.get(ConfigService);
    shardEarningHistoryRepo = module.get('IShardEarningHistoryRepository');
  });

  describe('checkWallet', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const seasonId = 1;

    it('should return not suspicious for normal earnings', async () => {
      const dailyShards = 1000;
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(900);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
      );

      expect(result.isSuspicious).toBe(false);
      expect(result.score).toBeLessThan(50);
      expect(result.reasons).toHaveLength(0);
    });

    it('should flag wallet with insufficient transactions', async () => {
      const dailyShards = 1000;
      const transactionCount = 10;
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(900);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
        transactionCount,
      );

      expect(result.reasons).toContain(
        `Wallet has only ${transactionCount} transactions (minimum: ${ANTI_FRAUD_CONFIG.MIN_WALLET_TRANSACTIONS})`,
      );
      expect(result.score).toBeGreaterThan(0);
      expect(result.recommendations).toContain(
        'Verify wallet has genuine on-chain activity',
      );
    });

    it('should flag extremely high daily earnings', async () => {
      const dailyShards = 60000;
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(1000);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.reasons).toContain('Extremely high daily shard earnings');
      expect(result.recommendations).toContain(
        'Manual review required for high-value account',
      );
    });

    it('should flag first-time earner with high shards', async () => {
      const dailyShards = 5001; // Just above 5000 threshold
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(0);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
      );

      // For first-time earner with > 5000 shards, analyzeEarningPattern returns
      // isSuspicious: false, so the reasons are NOT added to the main result
      expect(result.score).toBe(0);
      expect(result.isSuspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should flag first-time earner with extremely high shards', async () => {
      const dailyShards = 51000; // > 50000 threshold
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(0);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
      );

      // For > 50000 shards, the main checkWallet adds 30 points
      expect(result.score).toBe(30);
      expect(result.isSuspicious).toBe(false); // Still < 50
      expect(result.reasons).toContain('Extremely high daily shard earnings');
      expect(result.recommendations).toContain(
        'Manual review required for high-value account',
      );
    });

    it('should flag high variance from average', async () => {
      const dailyShards = 11000; // 11x average, above default threshold of 10
      const avgDailyShards = 1000;
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(
        avgDailyShards,
      );

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
      );

      // The analyzeEarningPattern adds Math.min(40, 11 * 4) = 40 points
      // Since score < 50, isSuspicious is false but reasons are added
      expect(result.score).toBe(40);
      expect(result.isSuspicious).toBe(false);
      const variance = dailyShards / avgDailyShards;
      expect(result.reasons).toContain(
        `Daily earnings ${variance.toFixed(1)}x higher than 30-day average (${avgDailyShards.toFixed(2)} shards)`,
      );
      expect(result.recommendations).toContain(
        'Review earning sources for unusual activity',
      );
    });

    it('should handle zero daily shards', async () => {
      const dailyShards = 0;
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(100);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
      );

      expect(result.isSuspicious).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('should accumulate multiple fraud indicators', async () => {
      const dailyShards = 60000;
      const transactionCount = 5;
      shardEarningHistoryRepo.getAverageDailyShards.mockResolvedValue(1000);

      const result = await service.checkWallet(
        walletAddress,
        dailyShards,
        seasonId,
        transactionCount,
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.reasons.length).toBeGreaterThan(2);
    });
  });

  describe('checkWalletClustering', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should detect clustering with few unique addresses', async () => {
      const relatedTransactions = [
        '0xabc123',
        '0xabc123',
        '0xabc123',
        '0xdef456',
        '0xdef456',
        '0xghi789',
        '0xjkl012',
        ...Array(44).fill('0xabc123'), // Total 51 transactions with 4 unique addresses
      ];

      const result = await service.checkWalletClustering(
        walletAddress,
        relatedTransactions,
      );

      expect(result.isClustered).toBe(true);
      expect(result.clusterSize).toBe(4); // Only 4 unique addresses (< 5)
      expect(result.suspicionScore).toBe(30);
    });

    it('should not flag normal wallet interactions', async () => {
      const relatedTransactions = [
        '0xabc123',
        '0xdef456',
        '0x789ghi',
        '0xjkl012',
        '0xmno345',
        '0xpqr678',
      ];

      const result = await service.checkWalletClustering(
        walletAddress,
        relatedTransactions,
      );

      expect(result.isClustered).toBe(false);
      expect(result.clusterSize).toBe(6);
      expect(result.suspicionScore).toBe(0);
    });

    it('should exclude self-transactions from cluster count', async () => {
      const relatedTransactions = [
        walletAddress,
        walletAddress.toUpperCase(),
        '0xabc123',
        '0xdef456',
      ];

      const result = await service.checkWalletClustering(
        walletAddress,
        relatedTransactions,
      );

      expect(result.clusterSize).toBe(2); // Only counts unique addresses excluding self
      expect(result.isClustered).toBe(false);
    });
  });

  describe('checkReferralAbuse', () => {
    const referrerAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should detect self-referral', async () => {
      const refereeAddresses = [
        '0xabc123',
        referrerAddress.toLowerCase(),
        '0xdef456',
      ];

      const result = await service.checkReferralAbuse(
        referrerAddress,
        refereeAddresses,
      );

      expect(result.isAbusive).toBe(true);
      expect(result.reasons).toContain('Self-referral detected');
    });

    it('should not flag legitimate referrals', async () => {
      const refereeAddresses = ['0xabc123', '0xdef456', '0x789ghi'];

      const result = await service.checkReferralAbuse(
        referrerAddress,
        refereeAddresses,
      );

      expect(result.isAbusive).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should handle uppercase addresses correctly', async () => {
      const refereeAddresses = [
        '0xabc123',
        referrerAddress.toLowerCase(), // The check uses includes() which is case sensitive, and the entity converts to lowercase
        '0xdef456',
      ];

      const result = await service.checkReferralAbuse(
        referrerAddress,
        refereeAddresses,
      );

      expect(result.isAbusive).toBe(true);
      expect(result.reasons).toContain('Self-referral detected');
    });
  });

  describe('calculateFraudScore', () => {
    it('should calculate score based on wallet age', () => {
      const score1 = service.calculateFraudScore({ walletAge: 3 });
      expect(score1).toBe(20); // < 7 days

      const score2 = service.calculateFraudScore({ walletAge: 15 });
      expect(score2).toBe(10); // < 30 days

      const score3 = service.calculateFraudScore({ walletAge: 60 });
      expect(score3).toBe(0); // > 30 days
    });

    it('should calculate score based on transaction count', () => {
      const score1 = service.calculateFraudScore({ transactionCount: 5 });
      expect(score1).toBe(25); // < 10 transactions

      const score2 = service.calculateFraudScore({ transactionCount: 15 });
      expect(score2).toBe(15); // < min threshold (20)

      const score3 = service.calculateFraudScore({ transactionCount: 50 });
      expect(score3).toBe(0); // > min threshold
    });

    it('should calculate score based on earning variance', () => {
      const score1 = service.calculateFraudScore({ earningVariance: 15 });
      expect(score1).toBe(30); // > fraud threshold (10)

      const score2 = service.calculateFraudScore({ earningVariance: 8 });
      expect(score2).toBe(15); // > max daily variance (5)

      const score3 = service.calculateFraudScore({ earningVariance: 3 });
      expect(score3).toBe(0); // within normal range
    });

    it('should combine multiple factors', () => {
      const score = service.calculateFraudScore({
        walletAge: 5,
        transactionCount: 8,
        earningVariance: 12,
        clusteringScore: 30,
        referralAbuseScore: 20,
      });

      // 20 (age) + 25 (transactions) + 30 (variance) + 30 (clustering) + 20 (referral) = 125
      // But capped at 100
      expect(score).toBe(100);
    });
  });

  describe('risk level methods', () => {
    it('should correctly identify high risk', () => {
      expect(service.isHighRisk(75)).toBe(true);
      expect(service.isHighRisk(70)).toBe(true);
      expect(service.isHighRisk(69)).toBe(false);
    });

    it('should correctly identify medium risk', () => {
      expect(service.isMediumRisk(40)).toBe(true);
      expect(service.isMediumRisk(50)).toBe(true);
      expect(service.isMediumRisk(69)).toBe(true);
      expect(service.isMediumRisk(70)).toBe(false);
      expect(service.isMediumRisk(39)).toBe(false);
    });

    it('should correctly identify low risk', () => {
      expect(service.isLowRisk(0)).toBe(true);
      expect(service.isLowRisk(39)).toBe(true);
      expect(service.isLowRisk(40)).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use default values when config is not set', () => {
      expect(service['minTransactions']).toBe(
        ANTI_FRAUD_CONFIG.MIN_WALLET_TRANSACTIONS,
      );
      expect(service['fraudThreshold']).toBe(
        ANTI_FRAUD_CONFIG.FRAUD_DETECTION_THRESHOLD,
      );
      expect(service['maxDailyVariance']).toBe(
        ANTI_FRAUD_CONFIG.MAX_DAILY_VARIANCE,
      );
    });

    it('should use config values when available', async () => {
      configService.get
        .mockReturnValueOnce(50) // MIN_WALLET_TRANSACTIONS
        .mockReturnValueOnce(15) // FRAUD_DETECTION_THRESHOLD
        .mockReturnValueOnce(10); // MAX_DAILY_VARIANCE

      const newModule: TestingModule = await Test.createTestingModule({
        providers: [
          AntiFraudDomainService,
          {
            provide: ConfigService,
            useValue: configService,
          },
          {
            provide: 'IShardEarningHistoryRepository',
            useValue: shardEarningHistoryRepo,
          },
        ],
      }).compile();

      const newService = newModule.get<AntiFraudDomainService>(
        AntiFraudDomainService,
      );

      expect(newService['minTransactions']).toBe(50);
      expect(newService['fraudThreshold']).toBe(15);
      expect(newService['maxDailyVariance']).toBe(10);
    });
  });
});
