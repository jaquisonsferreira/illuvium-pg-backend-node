import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { ApiError } from '../dto';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let getLeaderboardUseCase: jest.Mocked<GetLeaderboardUseCase>;
  let manageSeasonUseCase: jest.Mocked<ManageSeasonUseCase>;

  const mockLeaderboardEntry = {
    rank: 1,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    wallet: '0x1234567890abcdef1234567890abcdef12345678',
    totalShards: 1000,
    stakingShards: 300,
    socialShards: 200,
    developerShards: 400,
    referralShards: 100,
    lastCalculatedAt: new Date('2024-01-15T10:00:00Z'),
    rankChange: 5,
    lastActivity: new Date('2024-01-15T10:00:00Z'),
  };

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

  beforeEach(async () => {
    const mockGetLeaderboardUseCase = {
      execute: jest.fn(),
      getUserPosition: jest.fn(),
    };

    const mockManageSeasonUseCase = {
      getCurrentSeason: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        {
          provide: GetLeaderboardUseCase,
          useValue: mockGetLeaderboardUseCase,
        },
        {
          provide: ManageSeasonUseCase,
          useValue: mockManageSeasonUseCase,
        },
      ],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    getLeaderboardUseCase = module.get(GetLeaderboardUseCase);
    manageSeasonUseCase = module.get(ManageSeasonUseCase);
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with default parameters', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 1,
        totalEntries: 1,
        entries: [mockLeaderboardEntry],
        pagination: {
          limit: 100,
          offset: 0,
          total: 1,
          hasMore: false,
        },
      });

      const query = {};
      const result = await controller.getLeaderboard(query);

      expect(getLeaderboardUseCase.execute).toHaveBeenCalledWith({
        seasonId: 1,
        page: 1,
        limit: 100,
        search: undefined,
      });
      expect(result).toEqual({
        season_id: 1,
        timeframe: 'all_time',
        data: [
          {
            rank: 1,
            wallet: '0x1234567890abcdef1234567890abcdef12345678',
            total_shards: 1000,
            staking_shards: 300,
            social_shards: 200,
            developer_shards: 400,
            referral_shards: 100,
            rank_change: 5,
            last_activity: '2024-01-15T10:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 100,
          totalItems: 1,
          totalPages: 1,
        },
        user_position: undefined,
        last_updated: expect.any(String),
      });
    });

    it('should return leaderboard with custom parameters', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 1,
        totalEntries: 1,
        entries: [mockLeaderboardEntry],
        pagination: {
          limit: 100,
          offset: 0,
          total: 1,
          hasMore: false,
        },
      });

      const query = {
        page: 2,
        limit: 50,
        timeframe: '30d' as any,
        search: 'test',
        season: 2,
      };
      await controller.getLeaderboard(query);

      expect(getLeaderboardUseCase.execute).toHaveBeenCalledWith({
        seasonId: 2,
        page: 2,
        limit: 50,
        search: 'test',
      });
    });

    it('should include user position when requested', async () => {
      const wallet = '0x1234567890abcdef1234567890abcdef12345678';
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 1,
        totalEntries: 1,
        entries: [mockLeaderboardEntry],
        pagination: {
          limit: 100,
          offset: 0,
          total: 1,
          hasMore: false,
        },
      });
      getLeaderboardUseCase.getUserPosition.mockResolvedValue({
        rank: 5,
        walletAddress: wallet,
        wallet: wallet,
        totalShards: 750,
        stakingShards: 250,
        socialShards: 150,
        developerShards: 300,
        referralShards: 50,
        lastCalculatedAt: new Date('2024-01-15'),
      });

      const query = {
        user_wallet: wallet,
        include_user_position: true,
      };
      const result = await controller.getLeaderboard(query);

      expect(getLeaderboardUseCase.getUserPosition).toHaveBeenCalledWith({
        wallet,
        seasonId: 1,
        timeframe: 'all_time',
      });
      expect(result.user_position).toEqual({
        wallet,
        rank: 5,
        total_shards: 750,
        staking_shards: 250,
        social_shards: 150,
        developer_shards: 300,
        referral_shards: 50,
      });
    });

    it('should handle pagination correctly', async () => {
      const entries = Array(5).fill(mockLeaderboardEntry);
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 250,
        totalEntries: 250,
        entries,
        pagination: {
          limit: 50,
          offset: 100,
          total: 250,
          hasMore: true,
        },
      });

      const query = { page: 3, limit: 50 };
      const result = await controller.getLeaderboard(query);

      expect(result.data[0].rank).toBe(101); // (3-1) * 50 + 1
      expect(result.pagination).toEqual({
        page: 3,
        limit: 50,
        totalItems: 250,
        totalPages: 5,
      });
    });

    it('should throw error for invalid wallet address', async () => {
      const query = {
        user_wallet: 'invalid_wallet',
      };

      await expect(controller.getLeaderboard(query)).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle no user position found', async () => {
      const wallet = '0x1234567890abcdef1234567890abcdef12345678';
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 1,
        totalEntries: 1,
        entries: [mockLeaderboardEntry],
        pagination: {
          limit: 100,
          offset: 0,
          total: 1,
          hasMore: false,
        },
      });
      getLeaderboardUseCase.getUserPosition.mockResolvedValue(null);

      const query = {
        user_wallet: wallet,
        include_user_position: true,
      };
      const result = await controller.getLeaderboard(query);

      expect(result.user_position).toBeUndefined();
    });

    it('should use default season when current season not found', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 0,
        totalEntries: 0,
        entries: [],
        pagination: {
          limit: 100,
          offset: 0,
          total: 0,
          hasMore: false,
        },
      });

      const query = {};
      await controller.getLeaderboard(query);

      expect(getLeaderboardUseCase.execute).toHaveBeenCalledWith({
        seasonId: 1,
        page: 1,
        limit: 100,
        search: undefined,
      });
    });

    it('should handle empty leaderboard', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 0,
        totalEntries: 0,
        entries: [],
        pagination: {
          limit: 100,
          offset: 0,
          total: 0,
          hasMore: false,
        },
      });

      const query = {};
      const result = await controller.getLeaderboard(query);

      expect(result.data).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should handle entries without last activity', async () => {
      const entryWithoutActivity = {
        ...mockLeaderboardEntry,
        lastActivity: undefined,
      };
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      getLeaderboardUseCase.execute.mockResolvedValue({
        seasonId: 1,
        category: 'all',
        totalParticipants: 1,
        totalEntries: 1,
        entries: [entryWithoutActivity],
        pagination: {
          limit: 100,
          offset: 0,
          total: 1,
          hasMore: false,
        },
      });

      const query = {};
      const result = await controller.getLeaderboard(query);

      expect(result.data[0].last_activity).toBeUndefined();
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.invalidWalletAddress('invalid');
      manageSeasonUseCase.getCurrentSeason.mockRejectedValue(apiError);

      const query = {};

      await expect(controller.getLeaderboard(query)).rejects.toThrow(
        HttpException,
      );
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const genericError = new Error('Generic error');
      manageSeasonUseCase.getCurrentSeason.mockRejectedValue(genericError);

      const query = {};

      await expect(controller.getLeaderboard(query)).rejects.toThrow(
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

  describe('getUserPosition', () => {
    it('should return user position when found', async () => {
      const userStats = {
        rank: 10,
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        totalShards: 500,
        stakingShards: 100,
        socialShards: 150,
        developerShards: 200,
        referralShards: 50,
        lastCalculatedAt: new Date('2024-01-15'),
      };
      getLeaderboardUseCase.getUserPosition.mockResolvedValue(userStats);

      const result = await (controller as any).getUserPosition(
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        'all_time',
      );

      expect(getLeaderboardUseCase.getUserPosition).toHaveBeenCalledWith({
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        seasonId: 1,
        timeframe: 'all_time',
      });
      expect(result).toEqual({
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        rank: 10,
        total_shards: 500,
        staking_shards: 100,
        social_shards: 150,
        developer_shards: 200,
        referral_shards: 50,
      });
    });

    it('should return undefined when user not found', async () => {
      getLeaderboardUseCase.getUserPosition.mockResolvedValue(null);

      const result = await (controller as any).getUserPosition(
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        'all_time',
      );

      expect(result).toBeUndefined();
    });
  });
});
