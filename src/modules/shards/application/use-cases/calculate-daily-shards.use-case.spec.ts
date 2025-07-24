import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CalculateDailyShardsUseCase } from './calculate-daily-shards.use-case';
import { ShardCalculationDomainService } from '../../domain/services/shard-calculation.domain-service';
import { AntiFraudDomainService } from '../../domain/services/anti-fraud.domain-service';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { IReferralRepository } from '../../domain/repositories/referral.repository.interface';
import { IShardEarningHistoryRepository } from '../../domain/repositories/shard-earning-history.repository.interface';
import { IDeveloperContributionRepository } from '../../domain/repositories/developer-contribution.repository.interface';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { ReferralEntity } from '../../domain/entities/referral.entity';
import { SeasonEntity } from '../../domain/entities/season.entity';
import { ShardEarningHistoryEntity } from '../../domain/entities/shard-earning-history.entity';

describe('CalculateDailyShardsUseCase', () => {
  let useCase: CalculateDailyShardsUseCase;
  let shardCalculationService: ShardCalculationDomainService;
  let antiFraudService: AntiFraudDomainService;
  let seasonRepository: jest.Mocked<ISeasonRepository>;
  let shardBalanceRepository: jest.Mocked<IShardBalanceRepository>;
  let vaultPositionRepository: jest.Mocked<IVaultPositionRepository>;
  let referralRepository: jest.Mocked<IReferralRepository>;
  let shardEarningHistoryRepository: jest.Mocked<IShardEarningHistoryRepository>;
  let developerContributionRepository: jest.Mocked<IDeveloperContributionRepository>;
  let mockSeason: SeasonEntity;

  beforeEach(async () => {
    mockSeason = new SeasonEntity(
      1,
      'Season 1',
      'base',
      new Date('2024-01-01'),
      new Date('2024-12-31'),
      'active',
      {
        vaultRates: { usdc: 1, eth: 2, weth: 2 },
        socialConversionRate: 100,
        vaultLocked: false,
        withdrawalEnabled: true,
      },
      10,
      1000,
      new Date(),
      new Date(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculateDailyShardsUseCase,
        ShardCalculationDomainService,
        AntiFraudDomainService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: 'ISeasonRepository',
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: 'IShardBalanceRepository',
          useValue: {
            findByWalletAndSeason: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'IVaultPositionRepository',
          useValue: {
            findByWalletAndSeason: jest.fn(),
          },
        },
        {
          provide: 'IReferralRepository',
          useValue: {
            findActiveByReferrer: jest.fn(),
            findByRefereeAndSeason: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'IShardEarningHistoryRepository',
          useValue: {
            findByWalletAndDate: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: 'IDeveloperContributionRepository',
          useValue: {
            findByWalletAndDate: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<CalculateDailyShardsUseCase>(
      CalculateDailyShardsUseCase,
    );
    shardCalculationService = module.get<ShardCalculationDomainService>(
      ShardCalculationDomainService,
    );
    antiFraudService = module.get<AntiFraudDomainService>(
      AntiFraudDomainService,
    );
    seasonRepository = module.get('ISeasonRepository');
    shardBalanceRepository = module.get('IShardBalanceRepository');
    vaultPositionRepository = module.get('IVaultPositionRepository');
    referralRepository = module.get('IReferralRepository');
    shardEarningHistoryRepository = module.get(
      'IShardEarningHistoryRepository',
    );
    developerContributionRepository = module.get(
      'IDeveloperContributionRepository',
    );
  });

  describe('execute', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const seasonId = 1;
    const date = new Date('2024-01-15');

    it('should calculate daily shards for a new wallet', async () => {
      const mockVaultPositions = [
        VaultPositionEntity.create({
          walletAddress,
          vaultAddress: '0xvault1',
          assetSymbol: 'usdc',
          chain: 'base',
          balance: '5000',
          shares: '5000',
          usdValue: 5000,
          snapshotDate: date,
          blockNumber: 1000,
        }),
      ];

      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(null);
      vaultPositionRepository.findByWalletAndSeason.mockResolvedValue(
        mockVaultPositions,
      );
      developerContributionRepository.findByWalletAndDate.mockResolvedValue([]);
      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);
      referralRepository.findActiveByReferrer.mockResolvedValue([]);
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(null);
      shardBalanceRepository.create.mockResolvedValue({} as any);
      shardEarningHistoryRepository.create.mockResolvedValue({} as any);
      antiFraudService.checkWallet = jest
        .fn()
        .mockResolvedValue({ isSuspicious: false, reasons: [] });

      const result = await useCase.execute({ walletAddress, seasonId, date });

      expect(result).toMatchObject({
        walletAddress,
        seasonId,
        stakingShards: 5,
        socialShards: 0,
        developerShards: 0,
        referralShards: 0,
        totalShards: 5,
        vaultBreakdown: [
          {
            vaultAddress: '0xvault1',
            chain: 'base',
            tokenSymbol: 'usdc',
            balance: 5000,
            usdValue: 5000,
            shardsEarned: 5,
          },
        ],
        date,
      });

      expect(shardBalanceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress,
          seasonId,
          stakingShards: 5,
          socialShards: 0,
          developerShards: 0,
          referralShards: 0,
          totalShards: 5,
        }),
      );
    });

    it('should update existing balance and apply referee bonus', async () => {
      const existingBalance = new ShardBalanceEntity(
        '1',
        walletAddress,
        seasonId,
        10,
        20,
        30,
        40,
        100,
        new Date(date.getTime() - 24 * 60 * 60 * 1000),
        date,
        date,
      );

      const mockReferral = ReferralEntity.create({
        referrerAddress: '0xreferrer',
        refereeAddress: walletAddress,
        seasonId,
      }).activate(100);

      const mockVaultPositions = [
        VaultPositionEntity.create({
          walletAddress,
          vaultAddress: '0xvault1',
          assetSymbol: 'usdc',
          chain: 'base',
          balance: '1000',
          shares: '1000',
          usdValue: 1000,
          snapshotDate: date,
          blockNumber: 1000,
        }),
      ];

      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(null);
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(
        existingBalance,
      );
      vaultPositionRepository.findByWalletAndSeason.mockResolvedValue(
        mockVaultPositions,
      );
      developerContributionRepository.findByWalletAndDate.mockResolvedValue([]);
      referralRepository.findByRefereeAndSeason.mockResolvedValue(mockReferral);
      referralRepository.findActiveByReferrer.mockResolvedValue([]);
      shardBalanceRepository.update.mockResolvedValue({} as any);
      shardEarningHistoryRepository.create.mockResolvedValue({} as any);
      antiFraudService.checkWallet = jest
        .fn()
        .mockResolvedValue({ isSuspicious: false, reasons: [] });

      const result = await useCase.execute({ walletAddress, seasonId, date });

      expect(result.totalShards).toBe(1.2);
      expect(result.stakingShards).toBe(1.2);
      expect(shardBalanceRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stakingShards: 11.2,
          socialShards: 20,
          developerShards: 30,
          referralShards: 40,
          totalShards: 101.2,
        }),
      );
    });

    it('should apply fraud detection', async () => {
      const mockVaultPositions = [
        VaultPositionEntity.create({
          walletAddress,
          vaultAddress: '0xvault1',
          assetSymbol: 'usdc',
          chain: 'base',
          balance: '1000000',
          shares: '1000000',
          usdValue: 1000000,
          snapshotDate: date,
          blockNumber: 1000,
        }),
      ];

      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(null);
      vaultPositionRepository.findByWalletAndSeason.mockResolvedValue(
        mockVaultPositions,
      );
      developerContributionRepository.findByWalletAndDate.mockResolvedValue([]);
      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);
      referralRepository.findActiveByReferrer.mockResolvedValue([]);
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(null);
      shardBalanceRepository.create.mockResolvedValue({} as any);
      shardEarningHistoryRepository.create.mockResolvedValue({} as any);
      antiFraudService.checkWallet = jest.fn().mockResolvedValue({
        isSuspicious: true,
        reasons: ['Unusual activity detected'],
      });

      const result = await useCase.execute({ walletAddress, seasonId, date });

      expect(result.fraudCheckResult).toEqual({
        isSuspicious: true,
        reasons: ['Unusual activity detected'],
      });
      expect(result.stakingShards).toBe(1000);
    });

    it('should handle repository errors gracefully', async () => {
      seasonRepository.findById.mockRejectedValue(new Error('Database error'));

      await expect(
        useCase.execute({ walletAddress, seasonId, date }),
      ).rejects.toThrow('Database error');
    });

    it('should calculate vault breakdown correctly', async () => {
      const mockVaultPositions = [
        VaultPositionEntity.create({
          walletAddress,
          vaultAddress: '0xvault1',
          assetSymbol: 'usdc',
          chain: 'base',
          balance: '5000',
          shares: '5000',
          usdValue: 5000,
          snapshotDate: date,
          blockNumber: 1000,
        }),
        VaultPositionEntity.create({
          walletAddress,
          vaultAddress: '0xvault2',
          assetSymbol: 'eth',
          chain: 'base',
          balance: '2',
          shares: '2',
          usdValue: 6000,
          snapshotDate: date,
          blockNumber: 1000,
        }),
      ];

      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(null);
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(null);
      vaultPositionRepository.findByWalletAndSeason.mockResolvedValue(
        mockVaultPositions,
      );
      developerContributionRepository.findByWalletAndDate.mockResolvedValue([]);
      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);
      referralRepository.findActiveByReferrer.mockResolvedValue([]);
      shardBalanceRepository.create.mockResolvedValue({} as any);
      shardEarningHistoryRepository.create.mockResolvedValue({} as any);
      antiFraudService.checkWallet = jest
        .fn()
        .mockResolvedValue({ isSuspicious: false, reasons: [] });

      const result = await useCase.execute({ walletAddress, seasonId, date });

      expect(result.vaultBreakdown).toHaveLength(2);
      expect(result.vaultBreakdown[0]).toEqual({
        vaultAddress: '0xvault1',
        chain: 'base',
        tokenSymbol: 'usdc',
        balance: 5000,
        usdValue: 5000,
        shardsEarned: 5,
      });
      expect(result.vaultBreakdown[1]).toEqual({
        vaultAddress: '0xvault2',
        chain: 'base',
        tokenSymbol: 'eth',
        balance: 2,
        usdValue: 6000,
        shardsEarned: 12,
      });
      expect(result.stakingShards).toBe(17);
    });

    it('should return existing history if already calculated', async () => {
      const existingHistory = new ShardEarningHistoryEntity(
        '1',
        walletAddress,
        seasonId,
        date,
        10,
        20,
        30,
        40,
        100,
        [
          {
            vaultId: '0xvault1',
            asset: 'usdc',
            chain: 'base',
            shardsEarned: 10,
            usdValue: 10000,
          },
        ],
        {
          refereeMultiplier: 1,
          fraudCheckResult: { isSuspicious: false, reasons: [] },
          calculatedAt: new Date().toISOString(),
        },
        new Date(),
      );

      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(
        existingHistory,
      );

      const result = await useCase.execute({ walletAddress, seasonId, date });

      expect(result).toMatchObject({
        walletAddress,
        seasonId,
        date,
        stakingShards: 10,
        socialShards: 20,
        developerShards: 30,
        referralShards: 40,
        totalShards: 100,
        vaultBreakdown: [
          {
            vaultAddress: '0xvault1',
            chain: 'base',
            tokenSymbol: 'usdc',
            balance: 0,
            usdValue: 10000,
            shardsEarned: 10,
          },
        ],
        fraudCheckResult: { isSuspicious: false, reasons: [] },
      });

      expect(
        vaultPositionRepository.findByWalletAndSeason,
      ).not.toHaveBeenCalled();
      expect(shardBalanceRepository.create).not.toHaveBeenCalled();
      expect(shardBalanceRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for inactive season', async () => {
      const inactiveSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'completed',
        {
          vaultRates: { usdc: 1, eth: 2, weth: 2 },
          socialConversionRate: 100,
          vaultLocked: false,
          withdrawalEnabled: true,
        },
        10,
        1000,
        new Date(),
        new Date(),
      );

      seasonRepository.findById.mockResolvedValue(inactiveSeason);

      await expect(
        useCase.execute({ walletAddress, seasonId, date }),
      ).rejects.toThrow('Season 1 is not active');
    });

    it('should throw error for non-existent season', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ walletAddress, seasonId, date }),
      ).rejects.toThrow('Season 1 is not active');
    });
  });
});
