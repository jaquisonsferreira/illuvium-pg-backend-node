import { Test, TestingModule } from '@nestjs/testing';
import { GetEarningHistoryUseCase } from './get-earning-history.use-case';
import { IShardEarningHistoryRepository } from '../../domain/repositories/shard-earning-history.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { ShardEarningHistoryEntity } from '../../domain/entities/shard-earning-history.entity';

describe('GetEarningHistoryUseCase', () => {
  let useCase: GetEarningHistoryUseCase;
  let shardEarningHistoryRepository: jest.Mocked<IShardEarningHistoryRepository>;
  let seasonRepository: jest.Mocked<ISeasonRepository>;

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

  const mockHistoryEntry = new ShardEarningHistoryEntity(
    '1',
    validWallet,
    1,
    new Date('2024-01-15'),
    100,
    50,
    25,
    10,
    185,
    [
      {
        vaultId: '0xvault123',
        chain: 'base',
        asset: 'ETH',
        usdValue: 3000,
        shardsEarned: 100,
      },
    ],
    { processed: true },
    new Date('2024-01-15'),
  );

  const mockSummary = {
    totalDays: 15,
    totalShards: 2775,
    avgDailyShards: 185,
    breakdown: {
      staking: 1500,
      social: 750,
      developer: 375,
      referral: 150,
    },
  };

  beforeEach(async () => {
    const mockShardEarningHistoryRepository = {
      findByWallet: jest.fn(),
      getSummaryByWallet: jest.fn(),
      getAverageDailyShards: jest.fn(),
      findByWalletAndDate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockSeasonRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      findByChain: jest.fn(),
      findActiveByChain: jest.fn(),
      findByStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEarningHistoryUseCase,
        {
          provide: 'IShardEarningHistoryRepository',
          useValue: mockShardEarningHistoryRepository,
        },
        {
          provide: 'ISeasonRepository',
          useValue: mockSeasonRepository,
        },
      ],
    }).compile();

    useCase = module.get<GetEarningHistoryUseCase>(GetEarningHistoryUseCase);
    shardEarningHistoryRepository = module.get(
      'IShardEarningHistoryRepository',
    );
    seasonRepository = module.get('ISeasonRepository');
  });

  describe('execute', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [mockHistoryEntry],
        total: 1,
      });
      shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue(
        mockSummary,
      );
    });

    it('should return earning history with default pagination', async () => {
      const dto = {
        walletAddress: validWallet,
      };

      const result = await useCase.execute(dto);

      expect(shardEarningHistoryRepository.findByWallet).toHaveBeenCalledWith(
        validWallet,
        undefined,
        undefined,
        undefined,
        30,
        0,
      );
      expect(
        shardEarningHistoryRepository.getSummaryByWallet,
      ).toHaveBeenCalledWith(validWallet, 0, undefined, undefined);
      expect(result).toEqual({
        walletAddress: validWallet,
        seasonId: undefined,
        dateRange: {
          start: mockHistoryEntry.date,
          end: mockHistoryEntry.date,
        },
        summary: mockSummary,
        history: [
          {
            date: mockHistoryEntry.date,
            stakingShards: 100,
            socialShards: 50,
            developerShards: 25,
            referralShards: 10,
            dailyTotal: 185,
            vaultBreakdown: [
              {
                vaultAddress: '0xvault123',
                chain: 'base',
                tokenSymbol: 'ETH',
                balance: 0,
                usdValue: 3000,
                shardsEarned: 100,
              },
            ],
            metadata: { processed: true },
          },
        ],
        pagination: {
          limit: 30,
          offset: 0,
          total: 1,
          hasMore: false,
        },
      });
    });

    it('should return earning history with custom pagination', async () => {
      const dto = {
        walletAddress: validWallet,
        seasonId: 1,
        limit: 10,
        offset: 5,
      };

      await useCase.execute(dto);

      expect(seasonRepository.findById).toHaveBeenCalledWith(1);
      expect(shardEarningHistoryRepository.findByWallet).toHaveBeenCalledWith(
        validWallet,
        1,
        undefined,
        undefined,
        10,
        5,
      );
    });

    it('should return earning history with date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const dto = {
        walletAddress: validWallet,
        seasonId: 1,
        startDate,
        endDate,
      };

      await useCase.execute(dto);

      expect(shardEarningHistoryRepository.findByWallet).toHaveBeenCalledWith(
        validWallet,
        1,
        startDate,
        endDate,
        30,
        0,
      );
      expect(
        shardEarningHistoryRepository.getSummaryByWallet,
      ).toHaveBeenCalledWith(validWallet, 1, startDate, endDate);
    });

    it('should handle empty history', async () => {
      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [],
        total: 0,
      });

      const dto = {
        walletAddress: validWallet,
      };

      const result = await useCase.execute(dto);

      expect(result.history).toEqual([]);
      expect(result.dateRange.start).toBe(null);
      expect(result.dateRange.end).toBe(null);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should calculate hasMore correctly', async () => {
      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [mockHistoryEntry],
        total: 100,
      });

      const dto = {
        walletAddress: validWallet,
        limit: 10,
        offset: 5,
      };

      const result = await useCase.execute(dto);

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      const dto = {
        walletAddress: validWallet,
        seasonId: 999,
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'Season 999 not found',
      );
    });

    it('should map vault breakdown correctly', async () => {
      const complexVaultBreakdown = new ShardEarningHistoryEntity(
        '2',
        validWallet,
        1,
        new Date('2024-01-16'),
        100,
        50,
        25,
        10,
        185,
        [
          {
            vaultId: '0xvault1',
            chain: 'ethereum',
            asset: 'USDC',
            usdValue: 1000,
            shardsEarned: 50,
          },
          {
            vaultId: '0xvault2',
            chain: 'base',
            asset: 'ETH',
            usdValue: 2000,
            shardsEarned: 75,
          },
        ],
        { processed: true },
        new Date('2024-01-16'),
      );

      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [complexVaultBreakdown],
        total: 1,
      });

      const dto = {
        walletAddress: validWallet,
      };

      const result = await useCase.execute(dto);

      expect(result.history[0].vaultBreakdown).toEqual([
        {
          vaultAddress: '0xvault1',
          chain: 'ethereum',
          tokenSymbol: 'USDC',
          balance: 0,
          usdValue: 1000,
          shardsEarned: 50,
        },
        {
          vaultAddress: '0xvault2',
          chain: 'base',
          tokenSymbol: 'ETH',
          balance: 0,
          usdValue: 2000,
          shardsEarned: 75,
        },
      ]);
    });
  });

  describe('getDailyAverages', () => {
    beforeEach(() => {
      shardEarningHistoryRepository.getAverageDailyShards
        .mockResolvedValueOnce(185) // current average
        .mockResolvedValueOnce(150); // previous average
      shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue(
        mockSummary,
      );
    });

    it('should calculate daily averages with upward trend', async () => {
      const dto = {
        walletAddress: validWallet,
        seasonId: 1,
        days: 7,
      };

      const result = await useCase.getDailyAverages(dto);

      expect(
        shardEarningHistoryRepository.getAverageDailyShards,
      ).toHaveBeenCalledWith(validWallet, 1, 7);
      expect(
        shardEarningHistoryRepository.getAverageDailyShards,
      ).toHaveBeenCalledWith(validWallet, 1, 14);
      expect(result).toEqual({
        walletAddress: validWallet,
        seasonId: 1,
        period: 7,
        averages: {
          daily: 185,
          staking: 100, // 1500 / 15
          social: 50, // 750 / 15
          developer: 25, // 375 / 15
          referral: 10, // 150 / 15
        },
        trend: {
          direction: 'up',
          percentage: 23.33, // ((185 - 150) / 150) * 100
        },
      });
    });

    it('should calculate daily averages with downward trend', async () => {
      shardEarningHistoryRepository.getAverageDailyShards
        .mockReset()
        .mockResolvedValueOnce(120) // current average
        .mockResolvedValueOnce(150); // previous average

      const dto = {
        walletAddress: validWallet,
        seasonId: 1,
        days: 14,
      };

      const result = await useCase.getDailyAverages(dto);

      expect(result.trend.direction).toBe('down');
      expect(result.trend.percentage).toBe(-20); // ((120 - 150) / 150) * 100
    });

    it('should calculate daily averages with stable trend', async () => {
      shardEarningHistoryRepository.getAverageDailyShards
        .mockReset()
        .mockResolvedValueOnce(152) // current average
        .mockResolvedValueOnce(150); // previous average

      const dto = {
        walletAddress: validWallet,
        seasonId: 1,
        days: 30,
      };

      const result = await useCase.getDailyAverages(dto);

      expect(result.trend.direction).toBe('stable');
      expect(result.trend.percentage).toBe(1.33); // ((152 - 150) / 150) * 100
    });

    it('should handle zero previous average', async () => {
      shardEarningHistoryRepository.getAverageDailyShards
        .mockReset()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0);

      const dto = {
        walletAddress: validWallet,
        seasonId: 1,
        days: 7,
      };

      const result = await useCase.getDailyAverages(dto);

      expect(result.trend.direction).toBe('stable');
      expect(result.trend.percentage).toBe(0);
    });
  });

  describe('getTopEarningDays', () => {
    const mockMultipleEntries = [
      new ShardEarningHistoryEntity(
        '10',
        validWallet,
        1,
        new Date('2024-01-10'),
        80,
        20,
        0,
        0,
        100,
        [],
        {},
        new Date(),
      ),
      new ShardEarningHistoryEntity(
        '11',
        validWallet,
        1,
        new Date('2024-01-11'),
        150,
        30,
        20,
        0,
        200,
        [],
        {},
        new Date(),
      ),
      new ShardEarningHistoryEntity(
        '12',
        validWallet,
        1,
        new Date('2024-01-12'),
        120,
        20,
        10,
        0,
        150,
        [],
        {},
        new Date(),
      ),
      new ShardEarningHistoryEntity(
        '13',
        validWallet,
        1,
        new Date('2024-01-13'),
        250,
        30,
        20,
        0,
        300,
        [],
        {},
        new Date(),
      ),
      new ShardEarningHistoryEntity(
        '14',
        validWallet,
        1,
        new Date('2024-01-14'),
        60,
        10,
        5,
        0,
        75,
        [],
        {},
        new Date(),
      ),
    ];

    beforeEach(() => {
      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: mockMultipleEntries,
        total: 5,
      });
    });

    it('should return top earning days sorted by daily total', async () => {
      const result = await useCase.getTopEarningDays(validWallet, 1, 3);

      expect(shardEarningHistoryRepository.findByWallet).toHaveBeenCalledWith(
        validWallet,
        1,
        undefined,
        undefined,
        1000,
        0,
      );
      expect(result).toHaveLength(3);
      expect(result[0].dailyTotal).toBe(300);
      expect(result[1].dailyTotal).toBe(200);
      expect(result[2].dailyTotal).toBe(150);
    });

    it('should return all days when limit exceeds available data', async () => {
      const result = await useCase.getTopEarningDays(validWallet, 1, 10);

      expect(result).toHaveLength(5);
      expect(result[0].dailyTotal).toBe(300);
      expect(result[4].dailyTotal).toBe(75);
    });

    it('should map vault breakdown correctly', async () => {
      const entryWithVaults = new ShardEarningHistoryEntity(
        'v1',
        validWallet,
        1,
        new Date('2024-01-10'),
        100,
        50,
        25,
        10,
        185,
        [
          {
            vaultId: '0xvault123',
            chain: 'base',
            asset: 'ETH',
            usdValue: 3000,
            shardsEarned: 100,
          },
        ],
        {},
        new Date(),
      );

      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [entryWithVaults],
        total: 1,
      });

      const result = await useCase.getTopEarningDays(validWallet, 1, 1);

      expect(result[0].vaultBreakdown).toEqual([
        {
          vaultAddress: '0xvault123',
          chain: 'base',
          tokenSymbol: 'ETH',
          balance: 0,
          usdValue: 3000,
          shardsEarned: 100,
        },
      ]);
    });
  });

  describe('getEarningStreaks', () => {
    it('should calculate earning streaks correctly', async () => {
      const consecutiveEntries = [
        new ShardEarningHistoryEntity(
          '10',
          validWallet,
          1,
          new Date('2024-01-10'),
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
        new ShardEarningHistoryEntity(
          '11',
          validWallet,
          1,
          new Date('2024-01-11'),
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
        new ShardEarningHistoryEntity(
          '12',
          validWallet,
          1,
          new Date('2024-01-12'),
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
        new ShardEarningHistoryEntity(
          '15',
          validWallet,
          1,
          new Date('2024-01-15'),
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
        new ShardEarningHistoryEntity(
          '16',
          validWallet,
          1,
          new Date('2024-01-16'),
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
      ];

      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: consecutiveEntries,
        total: 5,
      });

      const result = await useCase.getEarningStreaks(validWallet, 1);

      expect(shardEarningHistoryRepository.findByWallet).toHaveBeenCalledWith(
        validWallet,
        1,
        undefined,
        undefined,
        365,
        0,
      );
      expect(result.longestStreak).toBe(3); // Jan 10-12
      expect(result.totalActiveDays).toBe(5);
      expect(result.lastActiveDate).toEqual(new Date('2024-01-16'));
    });

    it('should handle current streak when last active was today or yesterday', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const recentEntries = [
        new ShardEarningHistoryEntity(
          'y',
          validWallet,
          1,
          yesterday,
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
        new ShardEarningHistoryEntity(
          't',
          validWallet,
          1,
          today,
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
      ];

      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: recentEntries,
        total: 2,
      });

      const result = await useCase.getEarningStreaks(validWallet, 1);

      expect(result.currentStreak).toBe(2);
    });

    it('should reset current streak when last active was too long ago', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5);

      const oldEntries = [
        new ShardEarningHistoryEntity(
          'old',
          validWallet,
          1,
          oldDate,
          100,
          50,
          25,
          10,
          185,
          [],
          {},
          new Date(),
        ),
      ];

      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: oldEntries,
        total: 1,
      });

      const result = await useCase.getEarningStreaks(validWallet, 1);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(1);
    });

    it('should handle empty history', async () => {
      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [],
        total: 0,
      });

      const result = await useCase.getEarningStreaks(validWallet, 1);

      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        lastActiveDate: null,
      });
    });

    it('should handle single day history', async () => {
      shardEarningHistoryRepository.findByWallet.mockResolvedValue({
        history: [mockHistoryEntry],
        total: 1,
      });

      const result = await useCase.getEarningStreaks(validWallet, 1);

      expect(result.longestStreak).toBe(1);
      expect(result.totalActiveDays).toBe(1);
    });
  });
});
