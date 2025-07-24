import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ShardsController } from './shards.controller';
import { CalculateDailyShardsUseCase } from '../../application/use-cases/calculate-daily-shards.use-case';
import { GetEarningHistoryUseCase } from '../../application/use-cases/get-earning-history.use-case';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { ApiError } from '../dto';

describe('ShardsController', () => {
  let controller: ShardsController;
  let calculateDailyShardsUseCase: jest.Mocked<CalculateDailyShardsUseCase>;
  let getEarningHistoryUseCase: jest.Mocked<GetEarningHistoryUseCase>;
  let manageSeasonUseCase: jest.Mocked<ManageSeasonUseCase>;

  const validWallet = '0x1234567890abcdef1234567890abcdef12345678';

  const mockSeasonConfig: SeasonConfig = {
    vaultRates: { ETH: 100, USDC: 150 },
    socialConversionRate: 100,
    vaultLocked: false,
    withdrawalEnabled: true,
    redeemPeriodDays: 30,
  };

  const mockSeason = new SeasonEntity(
    1,
    'Season 1',
    'base',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    'active',
    mockSeasonConfig,
    1000,
    50000,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  const mockVaultBreakdown = [
    {
      vaultAddress: '0xvault123',
      chain: 'base',
      tokenSymbol: 'ETH',
      balance: 1000000000000000000,
      usdValue: 3000,
      shardsEarned: 150,
    },
  ];

  const mockShardBalance = {
    walletAddress: validWallet,
    seasonId: 1,
    date: new Date('2024-01-15'),
    stakingShards: 500,
    socialShards: 200,
    developerShards: 300,
    referralShards: 100,
    totalShards: 1100,
    vaultBreakdown: mockVaultBreakdown,
  };

  const mockHistoryItem = {
    date: new Date('2024-01-15'),
    stakingShards: 20,
    socialShards: 10,
    developerShards: 15,
    referralShards: 5,
    dailyTotal: 50,
    vaultBreakdown: mockVaultBreakdown,
  };

  const mockEarningHistory = {
    walletAddress: validWallet,
    seasonId: 1,
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
    summary: {
      totalDays: 1,
      totalShards: 50,
      avgDailyShards: 50,
      breakdown: {
        staking: 20,
        social: 10,
        developer: 15,
        referral: 5,
      },
    },
    history: [mockHistoryItem],
    pagination: { total: 1, offset: 0, limit: 30, hasMore: false },
  };

  beforeEach(async () => {
    const mockCalculateDailyShardsUseCase = {
      execute: jest.fn(),
    };

    const mockGetEarningHistoryUseCase = {
      execute: jest.fn(),
    };

    const mockManageSeasonUseCase = {
      getCurrentSeason: jest.fn(),
      getUpcomingSeasons: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShardsController],
      providers: [
        {
          provide: CalculateDailyShardsUseCase,
          useValue: mockCalculateDailyShardsUseCase,
        },
        {
          provide: GetEarningHistoryUseCase,
          useValue: mockGetEarningHistoryUseCase,
        },
        {
          provide: ManageSeasonUseCase,
          useValue: mockManageSeasonUseCase,
        },
      ],
    }).compile();

    controller = module.get<ShardsController>(ShardsController);
    calculateDailyShardsUseCase = module.get(CalculateDailyShardsUseCase);
    getEarningHistoryUseCase = module.get(GetEarningHistoryUseCase);
    manageSeasonUseCase = module.get(ManageSeasonUseCase);
  });

  describe('getShardBalance', () => {
    it('should return shard balance for valid wallet', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      calculateDailyShardsUseCase.execute.mockResolvedValue(mockShardBalance);

      const result = await controller.getShardBalance(validWallet, {});

      expect(calculateDailyShardsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
        date: expect.any(Date),
      });
      expect(result).toEqual({
        wallet: validWallet,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          staking_shards: 500,
          social_shards: 200,
          developer_shards: 300,
          referral_shards: 100,
          total_shards: 1100,
          vaults_breakdown: [
            {
              vault_id: '0xvault123',
              chain: 'base',
              asset: 'ETH',
              balance: 1000000000000000000,
              usd_value: 3000,
              shards_earned: 150,
            },
          ],
        },
        total_shards_from_all_seasons: 1100,
        last_updated: expect.any(String),
      });
    });

    it('should include season history when requested', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue([mockSeason]);
      calculateDailyShardsUseCase.execute.mockResolvedValue(mockShardBalance);

      const query = { include_all_seasons: true };
      const result = await controller.getShardBalance(validWallet, query);

      expect(manageSeasonUseCase.getUpcomingSeasons).toHaveBeenCalled();
      expect(result.season_history).toEqual([
        {
          season_id: 1,
          season_name: 'Season 1',
          total_shards: 1100,
          staking_shards: 500,
          social_shards: 200,
          developer_shards: 300,
          referral_shards: 100,
        },
      ]);
    });

    it('should use custom season from query', async () => {
      calculateDailyShardsUseCase.execute.mockResolvedValue(mockShardBalance);

      const query = { season: 2 };
      await controller.getShardBalance(validWallet, query);

      expect(calculateDailyShardsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 2,
        date: expect.any(Date),
      });
    });

    it('should validate season and chain combination', async () => {
      calculateDailyShardsUseCase.execute.mockResolvedValue(mockShardBalance);

      const query = { season: 1, chain: 'base' as any };
      await controller.getShardBalance(validWallet, query);

      expect(calculateDailyShardsUseCase.execute).toHaveBeenCalled();
    });

    it('should throw error for invalid wallet address', async () => {
      const invalidWallet = 'invalid_wallet';

      await expect(
        controller.getShardBalance(invalidWallet, {}),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error for invalid season-chain combination', async () => {
      const query = { season: 1, chain: 'arbitrum' as any };

      await expect(
        controller.getShardBalance(validWallet, query),
      ).rejects.toThrow(HttpException);
    });

    it('should use default season when current season not found', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);
      calculateDailyShardsUseCase.execute.mockResolvedValue(mockShardBalance);

      await controller.getShardBalance(validWallet, {});

      expect(calculateDailyShardsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
        date: expect.any(Date),
      });
    });

    it('should handle use case errors', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      calculateDailyShardsUseCase.execute.mockRejectedValue(
        new Error('Calculation error'),
      );

      await expect(controller.getShardBalance(validWallet, {})).rejects.toThrow(
        'Calculation error',
      );
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.invalidWalletAddress(validWallet);
      calculateDailyShardsUseCase.execute.mockRejectedValue(apiError);

      await expect(controller.getShardBalance(validWallet, {})).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getShardHistory', () => {
    it('should return shard history with default pagination', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getEarningHistoryUseCase.execute.mockResolvedValue(mockEarningHistory);

      const result = await controller.getShardHistory(validWallet, {});

      expect(getEarningHistoryUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
        startDate: undefined,
        endDate: undefined,
        limit: 30,
        offset: 0,
      });
      expect(result).toEqual({
        data: [
          {
            date: '2024-01-15',
            season_id: 1,
            staking_shards: 20,
            social_shards: 10,
            developer_shards: 15,
            referral_shards: 5,
            daily_total: 50,
            vaults_breakdown: [
              {
                vault_id: '0xvault123',
                chain: 'base',
                asset: 'ETH',
                balance: 1000000000000000000,
                usd_value: 3000,
                shards_earned: 150,
              },
            ],
          },
        ],
        pagination: {
          page: 1,
          limit: 30,
          totalItems: 1,
          totalPages: 1,
        },
        summary: {
          season_id: 1,
          period_total: 50,
          avg_daily: 50,
        },
      });
    });

    it('should handle custom pagination parameters', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getEarningHistoryUseCase.execute.mockResolvedValue(mockEarningHistory);

      const query = { page: 2, limit: 10 };
      await controller.getShardHistory(validWallet, query);

      expect(getEarningHistoryUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
        startDate: undefined,
        endDate: undefined,
        limit: 10,
        offset: 10,
      });
    });

    it('should handle date range filtering', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getEarningHistoryUseCase.execute.mockResolvedValue(mockEarningHistory);

      const query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      await controller.getShardHistory(validWallet, query);

      expect(getEarningHistoryUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 30,
        offset: 0,
      });
    });

    it('should handle empty history', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getEarningHistoryUseCase.execute.mockResolvedValue({
        walletAddress: validWallet,
        seasonId: 1,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        summary: {
          totalDays: 0,
          totalShards: 0,
          avgDailyShards: 0,
          breakdown: {
            staking: 0,
            social: 0,
            developer: 0,
            referral: 0,
          },
        },
        history: [],
        pagination: { total: 0, offset: 0, limit: 30, hasMore: false },
      });

      const result = await controller.getShardHistory(validWallet, {});

      expect(result.data).toEqual([]);
      expect(result.summary.avg_daily).toBe(0);
      expect(result.summary.period_total).toBe(0);
    });

    it('should validate season and chain combination', async () => {
      getEarningHistoryUseCase.execute.mockResolvedValue(mockEarningHistory);

      const query = { season: 1, chain: 'ethereum' as any };
      await controller.getShardHistory(validWallet, query);

      expect(getEarningHistoryUseCase.execute).toHaveBeenCalled();
    });

    it('should throw error for invalid wallet address', async () => {
      const invalidWallet = 'invalid_wallet';

      await expect(
        controller.getShardHistory(invalidWallet, {}),
      ).rejects.toThrow(HttpException);
    });

    it('should handle use case errors', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getEarningHistoryUseCase.execute.mockRejectedValue(
        new Error('History error'),
      );

      await expect(controller.getShardHistory(validWallet, {})).rejects.toThrow(
        'History error',
      );
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.invalidWalletAddress(validWallet);
      getEarningHistoryUseCase.execute.mockRejectedValue(apiError);

      await expect(controller.getShardHistory(validWallet, {})).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('isValidWalletAddress', () => {
    it('should validate correct wallet addresses', () => {
      const validWallet = '0x1234567890abcdef1234567890abcdef12345678';
      const isValid = (controller as any).isValidWalletAddress(validWallet);
      expect(isValid).toBe(true);
    });

    it('should reject invalid wallet addresses', () => {
      const invalidWallets = [
        'invalid',
        '0x123',
        '1234567890abcdef1234567890abcdef12345678',
        '0x1234567890abcdef1234567890abcdef12345678x',
        '0xgggggggggggggggggggggggggggggggggggggggg',
      ];

      invalidWallets.forEach((wallet) => {
        const isValid = (controller as any).isValidWalletAddress(wallet);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('validateSeasonChain', () => {
    it('should allow valid season 1 chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(1, 'base'),
      ).not.toThrow();
      expect(() =>
        (controller as any).validateSeasonChain(1, 'ethereum'),
      ).not.toThrow();
    });

    it('should reject invalid season 1 chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(1, 'arbitrum'),
      ).toThrow();
      expect(() =>
        (controller as any).validateSeasonChain(1, 'optimism'),
      ).toThrow();
    });

    it('should validate season 2+ chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(2, 'o'),
      ).not.toThrow();
    });

    it('should reject invalid season 2+ chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(2, 'ethereum'),
      ).toThrow();
      expect(() =>
        (controller as any).validateSeasonChain(2, 'base'),
      ).toThrow();
    });
  });

  describe('getCurrentSeasonId', () => {
    it('should return current season id', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);

      const seasonId = await (controller as any).getCurrentSeasonId();

      expect(manageSeasonUseCase.getCurrentSeason).toHaveBeenCalledWith('base');
      expect(seasonId).toBe(1);
    });

    it('should return default season id when no current season', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);

      const seasonId = await (controller as any).getCurrentSeasonId();

      expect(seasonId).toBe(1);
    });
  });

  describe('getSeasonHistory', () => {
    it('should return season history for wallet with balances', async () => {
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue([mockSeason]);
      calculateDailyShardsUseCase.execute.mockResolvedValue(mockShardBalance);

      const result = await (controller as any).getSeasonHistory(validWallet);

      expect(manageSeasonUseCase.getUpcomingSeasons).toHaveBeenCalled();
      expect(calculateDailyShardsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
        date: expect.any(Date),
      });
      expect(result).toEqual([
        {
          season_id: 1,
          season_name: 'Season 1',
          total_shards: 1100,
          staking_shards: 500,
          social_shards: 200,
          developer_shards: 300,
          referral_shards: 100,
        },
      ]);
    });

    it('should filter out seasons with zero shards', async () => {
      const zeroBalance = {
        ...mockShardBalance,
        totalShards: 0,
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
      };
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue([mockSeason]);
      calculateDailyShardsUseCase.execute.mockResolvedValue(zeroBalance);

      const result = await (controller as any).getSeasonHistory(validWallet);

      expect(result).toEqual([]);
    });

    it('should handle empty seasons list', async () => {
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue([]);

      const result = await (controller as any).getSeasonHistory(validWallet);

      expect(result).toEqual([]);
    });
  });
});
