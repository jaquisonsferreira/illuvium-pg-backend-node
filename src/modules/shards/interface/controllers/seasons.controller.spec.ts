import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { SeasonsController } from './seasons.controller';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { ApiError } from '../dto';

describe('SeasonsController', () => {
  let controller: SeasonsController;
  let manageSeasonUseCase: jest.Mocked<ManageSeasonUseCase>;

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

  const mockSeasonStats = {
    id: 1,
    name: 'Season 1',
    chain: 'base',
    status: 'active',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-03-31'),
    totalParticipants: 1000,
    totalShardsIssued: 50000,
    daysRemaining: 30,
    progress: 75,
  };

  beforeEach(async () => {
    const mockManageSeasonUseCase = {
      getUpcomingSeasons: jest.fn(),
      getCurrentSeason: jest.fn(),
      getSeasonStats: jest.fn(),
      createSeason: jest.fn(),
      updateSeason: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonsController],
      providers: [
        {
          provide: ManageSeasonUseCase,
          useValue: mockManageSeasonUseCase,
        },
      ],
    }).compile();

    controller = module.get<SeasonsController>(SeasonsController);
    manageSeasonUseCase = module.get(ManageSeasonUseCase);
  });

  describe('getSeasons', () => {
    it('should return list of seasons with current season', async () => {
      const mockSeasons = [mockSeason];
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue(mockSeasons);
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);

      const result = await controller.getSeasons();

      expect(manageSeasonUseCase.getUpcomingSeasons).toHaveBeenCalled();
      expect(manageSeasonUseCase.getCurrentSeason).toHaveBeenCalledWith('base');
      expect(result).toEqual({
        data: [
          {
            season_id: 1,
            name: 'Season 1',
            description: '',
            start_date: '2024-01-01T00:00:00.000Z',
            end_date: '2024-03-31T00:00:00.000Z',
            primary_chain: 'base',
            is_active: true,
            vault_rates: { ETH: 100, USDC: 150 },
            total_shards_distributed: 50000,
            active_participants: 1000,
            social_conversion_rate: 100,
            referral_config: {},
          },
        ],
        current_season_id: 1,
      });
    });

    it('should return default season id when no current season', async () => {
      const mockSeasons = [mockSeason];
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue(mockSeasons);
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);

      const result = await controller.getSeasons();

      expect(result.current_season_id).toBe(1);
    });

    it('should handle empty seasons list', async () => {
      manageSeasonUseCase.getUpcomingSeasons.mockResolvedValue([]);
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);

      const result = await controller.getSeasons();

      expect(result.data).toEqual([]);
      expect(result.current_season_id).toBe(1);
    });

    it('should handle errors', async () => {
      manageSeasonUseCase.getUpcomingSeasons.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getSeasons()).rejects.toThrow(HttpException);
    });
  });

  describe('getSeason', () => {
    const seasonId = 1;

    it('should return season by id', async () => {
      manageSeasonUseCase.getSeasonStats.mockResolvedValue(mockSeasonStats);

      const result = await controller.getSeason(seasonId);

      expect(manageSeasonUseCase.getSeasonStats).toHaveBeenCalledWith(seasonId);
      expect(result).toEqual({
        season_id: 1,
        name: 'Season 1',
        description: '',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-03-31T00:00:00.000Z',
        primary_chain: 'base',
        is_active: true,
        vault_rates: {},
        total_shards_distributed: 50000,
        active_participants: 1000,
        social_conversion_rate: 100,
        referral_config: {},
      });
    });

    it('should throw error when season not found', async () => {
      manageSeasonUseCase.getSeasonStats.mockResolvedValue(null as any);

      await expect(controller.getSeason(seasonId)).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle use case errors', async () => {
      manageSeasonUseCase.getSeasonStats.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getSeason(seasonId)).rejects.toThrow(
        'Database error',
      );
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.seasonNotFound(seasonId);
      manageSeasonUseCase.getSeasonStats.mockRejectedValue(apiError);

      await expect(controller.getSeason(seasonId)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createSeason', () => {
    const createSeasonDto = {
      name: 'New Season',
      description: 'A new season for testing',
      start_date: '2024-04-01T00:00:00.000Z',
      end_date: '2024-06-30T00:00:00.000Z',
      primary_chain: 'base' as any,
      vault_rates: { ETH: 120, USDC: 180 },
      social_conversion_rate: 110,
      referral_config: { max_referrals: 10 },
    };

    it('should create season successfully', async () => {
      const newSeason = new SeasonEntity(
        2,
        'New Season',
        'base',
        new Date('2024-04-01'),
        new Date('2024-06-30'),
        'upcoming',
        {
          vaultRates: { ETH: 120, USDC: 180 },
          socialConversionRate: 110,
          vaultLocked: false,
          withdrawalEnabled: true,
          redeemPeriodDays: 30,
        },
        0,
        0,
        new Date(),
        new Date(),
      );

      manageSeasonUseCase.createSeason.mockResolvedValue(newSeason);

      const result = await controller.createSeason(createSeasonDto);

      expect(manageSeasonUseCase.createSeason).toHaveBeenCalledWith({
        name: 'New Season',
        chain: 'base',
        startDate: new Date('2024-04-01T00:00:00.000Z'),
        endDate: new Date('2024-06-30T00:00:00.000Z'),
        config: {
          vaultRates: { ETH: 120, USDC: 180 },
          socialConversionRate: 110,
          referralConfig: { max_referrals: 10 },
        },
      });
      expect(result).toEqual({
        season_id: 2,
        name: 'New Season',
        description: '',
        start_date: '2024-04-01T00:00:00.000Z',
        end_date: '2024-06-30T00:00:00.000Z',
        primary_chain: 'base',
        is_active: false,
        vault_rates: { ETH: 120, USDC: 180 },
        total_shards_distributed: 0,
        active_participants: 0,
        social_conversion_rate: 110,
        referral_config: {},
      });
    });

    it('should handle creation errors', async () => {
      manageSeasonUseCase.createSeason.mockRejectedValue(
        new Error('Invalid date range'),
      );

      await expect(controller.createSeason(createSeasonDto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateSeason', () => {
    const seasonId = 1;
    const updateSeasonDto = {
      name: 'Updated Season',
      end_date: '2024-12-31T00:00:00.000Z',
      vault_rates: { ETH: 130, USDC: 200 },
    };

    it('should update season successfully', async () => {
      const updatedSeason = new SeasonEntity(
        1,
        'Updated Season',
        'base',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'active',
        {
          vaultRates: { ETH: 130, USDC: 200 },
          socialConversionRate: 100,
          vaultLocked: false,
          withdrawalEnabled: true,
          redeemPeriodDays: 30,
        },
        1000,
        50000,
        new Date('2024-01-01'),
        new Date(),
      );

      manageSeasonUseCase.updateSeason.mockResolvedValue(updatedSeason);

      const result = await controller.updateSeason(seasonId, updateSeasonDto);

      expect(manageSeasonUseCase.updateSeason).toHaveBeenCalledWith({
        id: seasonId,
        name: 'Updated Season',
        endDate: new Date('2024-12-31T00:00:00.000Z'),
        config: {
          vaultRates: { ETH: 130, USDC: 200 },
          socialConversionRate: 100,
        },
      });
      expect(result).toEqual({
        season_id: 1,
        name: 'Updated Season',
        description: '',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-12-31T00:00:00.000Z',
        primary_chain: 'base',
        is_active: true,
        vault_rates: { ETH: 130, USDC: 200 },
        total_shards_distributed: 50000,
        active_participants: 1000,
        social_conversion_rate: 100,
        referral_config: {},
      });
    });

    it('should handle partial update without end_date and vault_rates', async () => {
      const partialUpdate = { name: 'Partial Update' };
      const updatedSeason = new SeasonEntity(
        1,
        'Partial Update',
        'base',
        new Date('2024-01-01'),
        new Date('2024-03-31'),
        'active',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date(),
      );

      manageSeasonUseCase.updateSeason.mockResolvedValue(updatedSeason);

      await controller.updateSeason(seasonId, partialUpdate);

      expect(manageSeasonUseCase.updateSeason).toHaveBeenCalledWith({
        id: seasonId,
        name: 'Partial Update',
        endDate: undefined,
        config: undefined,
      });
    });

    it('should throw error when season not found', async () => {
      manageSeasonUseCase.updateSeason.mockResolvedValue(null as any);

      await expect(
        controller.updateSeason(seasonId, updateSeasonDto),
      ).rejects.toThrow(HttpException);
    });

    it('should handle update errors', async () => {
      manageSeasonUseCase.updateSeason.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.updateSeason(seasonId, updateSeasonDto),
      ).rejects.toThrow('Database error');
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.seasonNotFound(seasonId);
      manageSeasonUseCase.updateSeason.mockRejectedValue(apiError);

      await expect(
        controller.updateSeason(seasonId, updateSeasonDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('mapSeasonToDto', () => {
    it('should map season entity to DTO with all fields', () => {
      const seasonWithDescription = {
        ...mockSeason,
        description: 'Test season description',
      };

      const result = (controller as any).mapSeasonToDto(seasonWithDescription);

      expect(result).toEqual({
        season_id: 1,
        name: 'Season 1',
        description: 'Test season description',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-03-31T00:00:00.000Z',
        primary_chain: 'base',
        is_active: true,
        vault_rates: { ETH: 100, USDC: 150 },
        total_shards_distributed: 50000,
        active_participants: 1000,
        social_conversion_rate: 100,
        referral_config: {},
      });
    });

    it('should handle missing optional fields', () => {
      const minimalSeason = {
        id: 2,
        name: 'Minimal Season',
        status: 'upcoming',
      };

      const result = (controller as any).mapSeasonToDto(minimalSeason);

      expect(result).toEqual({
        season_id: 2,
        name: 'Minimal Season',
        description: '',
        start_date: expect.any(String),
        end_date: null,
        primary_chain: 'base',
        is_active: false,
        vault_rates: {},
        total_shards_distributed: 0,
        active_participants: 0,
        social_conversion_rate: 100,
        referral_config: {},
      });
    });

    it('should handle inactive season status', () => {
      const inactiveSeason = {
        ...mockSeason,
        status: 'completed',
      };

      const result = (controller as any).mapSeasonToDto(inactiveSeason);

      expect(result.is_active).toBe(false);
    });
  });
});
