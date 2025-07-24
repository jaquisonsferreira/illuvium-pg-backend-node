import { Test, TestingModule } from '@nestjs/testing';
import { GetLeaderboardUseCase } from './get-leaderboard.use-case';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';

describe('GetLeaderboardUseCase', () => {
  let useCase: GetLeaderboardUseCase;
  let shardBalanceRepository: jest.Mocked<IShardBalanceRepository>;
  let seasonRepository: jest.Mocked<ISeasonRepository>;

  const validWallet1 = '0x1234567890abcdef1234567890abcdef12345678';
  const validWallet2 = '0x9876543210fedcba9876543210fedcba98765432';
  const validWallet3 = '0x1111222233334444555566667777888899990000';

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

  const mockShardBalance1 = new ShardBalanceEntity(
    '1',
    validWallet1,
    1,
    500,
    300,
    200,
    0,
    1000,
    new Date('2024-01-15'),
    new Date('2024-01-15'),
    new Date('2024-01-15'),
  );

  const mockShardBalance2 = new ShardBalanceEntity(
    '2',
    validWallet2,
    1,
    400,
    250,
    150,
    0,
    800,
    new Date('2024-01-15'),
    new Date('2024-01-15'),
    new Date('2024-01-15'),
  );

  const mockShardBalance3 = new ShardBalanceEntity(
    '3',
    validWallet3,
    1,
    300,
    200,
    100,
    0,
    600,
    new Date('2024-01-15'),
    new Date('2024-01-15'),
    new Date('2024-01-15'),
  );

  beforeEach(async () => {
    const mockShardBalanceRepository = {
      findTopBySeason: jest.fn(),
      findByWalletAndSeason: jest.fn(),
      getWalletRank: jest.fn(),
      getTotalParticipantsBySeason: jest.fn(),
      getTotalShardsIssuedBySeason: jest.fn(),
      findBySeason: jest.fn(),
      searchByWallet: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByWallet: jest.fn(),
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
        GetLeaderboardUseCase,
        {
          provide: 'IShardBalanceRepository',
          useValue: mockShardBalanceRepository,
        },
        {
          provide: 'ISeasonRepository',
          useValue: mockSeasonRepository,
        },
      ],
    }).compile();

    useCase = module.get<GetLeaderboardUseCase>(GetLeaderboardUseCase);
    shardBalanceRepository = module.get('IShardBalanceRepository');
    seasonRepository = module.get('ISeasonRepository');
  });

  describe('execute', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardBalanceRepository.findTopBySeason.mockResolvedValue({
        balances: [mockShardBalance1, mockShardBalance2, mockShardBalance3],
        total: 3,
      });
      shardBalanceRepository.getTotalParticipantsBySeason.mockResolvedValue(
        100,
      );
    });

    it('should return leaderboard with default parameters', async () => {
      const dto = {
        seasonId: 1,
      };

      const result = await useCase.execute(dto);

      expect(seasonRepository.findById).toHaveBeenCalledWith(1);
      expect(shardBalanceRepository.findTopBySeason).toHaveBeenCalledWith(
        1,
        100,
        0,
        'total',
      );
      expect(result).toEqual({
        seasonId: 1,
        category: 'total',
        totalParticipants: 100,
        totalEntries: 3,
        entries: [
          {
            rank: 1,
            walletAddress: validWallet1,
            wallet: validWallet1,
            totalShards: 1000,
            stakingShards: 500,
            socialShards: 300,
            developerShards: 200,
            referralShards: 0,
            lastCalculatedAt: mockShardBalance1.lastCalculatedAt,
            rankChange: 0,
            lastActivity: mockShardBalance1.lastCalculatedAt,
          },
          {
            rank: 2,
            walletAddress: validWallet2,
            wallet: validWallet2,
            totalShards: 800,
            stakingShards: 400,
            socialShards: 250,
            developerShards: 150,
            referralShards: 0,
            lastCalculatedAt: mockShardBalance2.lastCalculatedAt,
            rankChange: 0,
            lastActivity: mockShardBalance2.lastCalculatedAt,
          },
          {
            rank: 3,
            walletAddress: validWallet3,
            wallet: validWallet3,
            totalShards: 600,
            stakingShards: 300,
            socialShards: 200,
            developerShards: 100,
            referralShards: 0,
            lastCalculatedAt: mockShardBalance3.lastCalculatedAt,
            rankChange: 0,
            lastActivity: mockShardBalance3.lastCalculatedAt,
          },
        ],
        userEntry: undefined,
        pagination: {
          limit: 100,
          offset: 0,
          total: 3,
          hasMore: false,
        },
      });
    });

    it('should return leaderboard with custom parameters', async () => {
      const dto = {
        seasonId: 1,
        category: 'staking' as const,
        limit: 2,
        page: 2,
      };

      await useCase.execute(dto);

      expect(shardBalanceRepository.findTopBySeason).toHaveBeenCalledWith(
        1,
        2,
        2, // offset for page 2
        'staking',
      );
    });

    it('should include user entry when wallet address provided', async () => {
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(
        mockShardBalance2,
      );
      shardBalanceRepository.getWalletRank.mockResolvedValue(2);

      const dto = {
        seasonId: 1,
        walletAddress: validWallet2,
      };

      const result = await useCase.execute(dto);

      expect(shardBalanceRepository.findByWalletAndSeason).toHaveBeenCalledWith(
        validWallet2,
        1,
      );
      expect(shardBalanceRepository.getWalletRank).toHaveBeenCalledWith(
        validWallet2,
        1,
        'total',
      );
      expect(result.userEntry).toEqual({
        rank: 2,
        walletAddress: validWallet2,
        wallet: validWallet2,
        totalShards: 800,
        stakingShards: 400,
        socialShards: 250,
        developerShards: 150,
        referralShards: 0,
        lastCalculatedAt: mockShardBalance2.lastCalculatedAt,
        rankChange: 0,
        lastActivity: mockShardBalance2.lastCalculatedAt,
        percentile: 99, // (100 - 2 + 1) / 100 * 100
      });
    });

    it('should handle user entry when user not found', async () => {
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(null);

      const dto = {
        seasonId: 1,
        walletAddress: validWallet1,
      };

      const result = await useCase.execute(dto);

      expect(result.userEntry).toBeUndefined();
    });

    it('should calculate hasMore correctly', async () => {
      shardBalanceRepository.findTopBySeason.mockResolvedValue({
        balances: [mockShardBalance1, mockShardBalance2],
        total: 10,
      });

      const dto = {
        seasonId: 1,
        limit: 2,
        page: 1,
      };

      const result = await useCase.execute(dto);

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      const dto = {
        seasonId: 999,
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'Season 999 not found',
      );
    });

    it('should handle different categories', async () => {
      const dto = {
        seasonId: 1,
        category: 'developer' as const,
      };

      await useCase.execute(dto);

      expect(shardBalanceRepository.findTopBySeason).toHaveBeenCalledWith(
        1,
        100,
        0,
        'developer',
      );
    });

    it('should calculate correct ranking with offset', async () => {
      const dto = {
        seasonId: 1,
        limit: 2,
        page: 3, // offset = 4
      };

      const result = await useCase.execute(dto);

      expect(result.entries[0].rank).toBe(5); // 4 + 0 + 1
      expect(result.entries[1].rank).toBe(6); // 4 + 1 + 1
      expect(result.entries[2].rank).toBe(7); // 4 + 2 + 1
    });
  });

  describe('getSeasonStats', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockSeason);
      shardBalanceRepository.getTotalParticipantsBySeason.mockResolvedValue(3);
      shardBalanceRepository.getTotalShardsIssuedBySeason.mockResolvedValue(
        2400,
      );
      shardBalanceRepository.findBySeason.mockResolvedValue([
        mockShardBalance1,
        mockShardBalance2,
        mockShardBalance3,
      ]);
    });

    it('should return season statistics', async () => {
      const result = await useCase.getSeasonStats(1);

      expect(seasonRepository.findById).toHaveBeenCalledWith(1);
      expect(
        shardBalanceRepository.getTotalParticipantsBySeason,
      ).toHaveBeenCalledWith(1);
      expect(
        shardBalanceRepository.getTotalShardsIssuedBySeason,
      ).toHaveBeenCalledWith(1);
      expect(shardBalanceRepository.findBySeason).toHaveBeenCalledWith(1);

      expect(result).toEqual({
        totalParticipants: 3,
        totalShardsIssued: 2400,
        averageShardsPerParticipant: 800, // 2400 / 3
        topCategories: {
          staking: {
            total: 1200, // 500 + 400 + 300
            percentage: 50, // 1200 / 2400 * 100
          },
          social: {
            total: 750, // 300 + 250 + 200
            percentage: 31.25, // 750 / 2400 * 100
          },
          developer: {
            total: 450, // 200 + 150 + 100
            percentage: 18.75, // 450 / 2400 * 100
          },
          referral: {
            total: 0, // 0 + 0 + 0
            percentage: 0, // 0 / 2400 * 100
          },
        },
      });
    });

    it('should handle zero participants', async () => {
      shardBalanceRepository.getTotalParticipantsBySeason.mockResolvedValue(0);
      shardBalanceRepository.getTotalShardsIssuedBySeason.mockResolvedValue(0);
      shardBalanceRepository.findBySeason.mockResolvedValue([]);

      const result = await useCase.getSeasonStats(1);

      expect(result.averageShardsPerParticipant).toBe(0);
      expect(result.topCategories.staking.percentage).toBe(0);
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      await expect(useCase.getSeasonStats(999)).rejects.toThrow(
        'Season 999 not found',
      );
    });
  });

  describe('getUserPosition', () => {
    beforeEach(() => {
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(
        mockShardBalance1,
      );
      shardBalanceRepository.getWalletRank.mockResolvedValue(1);
    });

    it('should return user position', async () => {
      const dto = {
        wallet: validWallet1,
        seasonId: 1,
        timeframe: 'all',
      };

      const result = await useCase.getUserPosition(dto);

      expect(shardBalanceRepository.findByWalletAndSeason).toHaveBeenCalledWith(
        validWallet1,
        1,
      );
      expect(shardBalanceRepository.getWalletRank).toHaveBeenCalledWith(
        validWallet1,
        1,
        'total',
      );
      expect(result).toEqual({
        rank: 1,
        walletAddress: validWallet1,
        wallet: validWallet1,
        totalShards: 1000,
        stakingShards: 500,
        socialShards: 300,
        developerShards: 200,
        referralShards: 0,
        lastCalculatedAt: mockShardBalance1.lastCalculatedAt,
        rankChange: 0,
        lastActivity: mockShardBalance1.lastCalculatedAt,
      });
    });

    it('should return null when user not found', async () => {
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(null);

      const dto = {
        wallet: validWallet1,
        seasonId: 1,
        timeframe: 'all',
      };

      const result = await useCase.getUserPosition(dto);

      expect(result).toBeNull();
    });
  });

  describe('searchWalletInLeaderboard', () => {
    beforeEach(() => {
      shardBalanceRepository.searchByWallet.mockResolvedValue([
        mockShardBalance1,
        mockShardBalance2,
      ]);
      shardBalanceRepository.getWalletRank
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);
    });

    it('should search wallets in leaderboard', async () => {
      const result = await useCase.searchWalletInLeaderboard('0x123', 1, 5);

      expect(shardBalanceRepository.searchByWallet).toHaveBeenCalledWith(
        '0x123',
        1,
        5,
      );
      expect(shardBalanceRepository.getWalletRank).toHaveBeenCalledWith(
        validWallet1,
        1,
        'total',
      );
      expect(shardBalanceRepository.getWalletRank).toHaveBeenCalledWith(
        validWallet2,
        1,
        'total',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        rank: 1,
        walletAddress: validWallet1,
        wallet: validWallet1,
        totalShards: 1000,
        stakingShards: 500,
        socialShards: 300,
        developerShards: 200,
        referralShards: 0,
        lastCalculatedAt: mockShardBalance1.lastCalculatedAt,
        rankChange: 0,
        lastActivity: mockShardBalance1.lastCalculatedAt,
      });
    });

    it('should use default limit when not provided', async () => {
      await useCase.searchWalletInLeaderboard('0x123', 1);

      expect(shardBalanceRepository.searchByWallet).toHaveBeenCalledWith(
        '0x123',
        1,
        10,
      );
    });

    it('should handle empty search results', async () => {
      shardBalanceRepository.searchByWallet.mockResolvedValue([]);

      const result = await useCase.searchWalletInLeaderboard('notfound', 1);

      expect(result).toEqual([]);
    });
  });
});
