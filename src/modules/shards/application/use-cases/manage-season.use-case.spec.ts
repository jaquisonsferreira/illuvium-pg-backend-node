import { Test, TestingModule } from '@nestjs/testing';
import { ManageSeasonUseCase } from './manage-season.use-case';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';

describe('ManageSeasonUseCase', () => {
  let useCase: ManageSeasonUseCase;
  let seasonRepository: jest.Mocked<ISeasonRepository>;

  const mockSeasonConfig: SeasonConfig = {
    vaultRates: { ETH: 100, USDC: 150 },
    socialConversionRate: 100,
    vaultLocked: true,
    withdrawalEnabled: false,
    redeemPeriodDays: 14,
  };

  const mockSeason = new SeasonEntity(
    1,
    'Season 1',
    'base',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    'upcoming',
    mockSeasonConfig,
    1000,
    50000,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  const mockActiveSeason = new SeasonEntity(
    2,
    'Season 2',
    'base',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    'active',
    mockSeasonConfig,
    2000,
    100000,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  beforeEach(async () => {
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
        ManageSeasonUseCase,
        {
          provide: 'ISeasonRepository',
          useValue: mockSeasonRepository,
        },
      ],
    }).compile();

    useCase = module.get<ManageSeasonUseCase>(ManageSeasonUseCase);
    seasonRepository = module.get('ISeasonRepository');
  });

  describe('createSeason', () => {
    const createSeasonDto = {
      name: 'Test Season',
      chain: 'base',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30'),
      config: {
        vaultRates: { ETH: 120, USDC: 180 },
        socialConversionRate: 110,
      },
    };

    beforeEach(() => {
      seasonRepository.findActiveByChain.mockResolvedValue([]);
      seasonRepository.create.mockResolvedValue(mockSeason);
    });

    it('should create a new season successfully', async () => {
      const futureDto = {
        ...createSeasonDto,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-06-30'),
      };

      const result = await useCase.createSeason(futureDto);

      expect(seasonRepository.findActiveByChain).toHaveBeenCalledWith('base');
      expect(seasonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Season',
          chain: 'base',
          startDate: futureDto.startDate,
          endDate: futureDto.endDate,
          status: 'upcoming',
          config: expect.objectContaining({
            vaultRates: { ETH: 120, USDC: 180 },
            socialConversionRate: 110,
            vaultLocked: true,
            withdrawalEnabled: false,
            redeemPeriodDays: 14,
          }),
        }),
      );
      expect(result).toBe(mockSeason);
    });

    it('should create season with active status when start date is in the past', async () => {
      const pastStartDate = new Date('2023-01-01');
      const futureEndDate = new Date('2026-01-01');

      const dto = {
        ...createSeasonDto,
        startDate: pastStartDate,
        endDate: futureEndDate,
      };

      await useCase.createSeason(dto);

      expect(seasonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        }),
      );
    });

    it('should create season with completed status when both dates are in the past', async () => {
      const pastStartDate = new Date('2023-01-01');
      const pastEndDate = new Date('2023-06-01');

      const dto = {
        ...createSeasonDto,
        startDate: pastStartDate,
        endDate: pastEndDate,
      };

      await useCase.createSeason(dto);

      expect(seasonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
        }),
      );
    });

    it('should create season without end date', async () => {
      const dto = {
        ...createSeasonDto,
        endDate: undefined,
      };

      await useCase.createSeason(dto);

      expect(seasonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endDate: null,
        }),
      );
    });

    it('should use default social conversion rate when not provided', async () => {
      const dto = {
        ...createSeasonDto,
        config: {
          vaultRates: { ETH: 100 },
        },
      };

      await useCase.createSeason(dto);

      expect(seasonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            socialConversionRate: 100,
          }),
        }),
      );
    });

    it('should throw error when end date is before start date', async () => {
      const dto = {
        ...createSeasonDto,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-05-01'),
      };

      await expect(useCase.createSeason(dto)).rejects.toThrow(
        'End date must be after start date',
      );
    });

    it('should throw error when dates overlap with existing season', async () => {
      const existingSeason = new SeasonEntity(
        1,
        'Existing Season',
        'base',
        new Date('2024-03-01'),
        new Date('2024-05-31'),
        'active',
        mockSeasonConfig,
        0,
        0,
        new Date(),
        new Date(),
      );

      seasonRepository.findActiveByChain.mockResolvedValue([existingSeason]);

      await expect(useCase.createSeason(createSeasonDto)).rejects.toThrow(
        'Season dates overlap with existing season "Existing Season" on base',
      );
    });
  });

  describe('updateSeason', () => {
    const updateSeasonDto = {
      id: 1,
      name: 'Updated Season',
      endDate: new Date('2024-12-31'),
      status: 'active' as const,
    };

    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockSeason);
      seasonRepository.update.mockResolvedValue(mockSeason);
    });

    it('should update season successfully', async () => {
      const result = await useCase.updateSeason(updateSeasonDto);

      expect(seasonRepository.findById).toHaveBeenCalledWith(1);
      expect(seasonRepository.update).toHaveBeenCalled();
      expect(result).toBe(mockSeason);
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      await expect(useCase.updateSeason(updateSeasonDto)).rejects.toThrow(
        'Season 1 not found',
      );
    });

    it('should throw error when end date is before start date', async () => {
      const dto = {
        ...updateSeasonDto,
        endDate: new Date('2023-12-31'), // Before season start date
      };

      await expect(useCase.updateSeason(dto)).rejects.toThrow(
        'End date must be after start date',
      );
    });

    it('should validate status transition', async () => {
      const dto = {
        id: 1,
        status: 'completed' as const,
      };

      // Mock season with upcoming status
      const upcomingSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        new Date('2024-03-31'),
        'upcoming',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(upcomingSeason);

      await expect(useCase.updateSeason(dto)).rejects.toThrow(
        'Invalid status transition from upcoming to completed',
      );
    });

    it('should update config by merging with existing config', async () => {
      const dto = {
        id: 1,
        config: {
          vaultRates: { BTC: 200 },
        },
      };

      await useCase.updateSeason(dto);

      expect(seasonRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            vaultRates: { BTC: 200 },
            socialConversionRate: 100, // From existing config
          }),
        }),
      );
    });
  });

  describe('activateSeason', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockSeason);
      seasonRepository.update.mockResolvedValue(mockActiveSeason);
    });

    it('should activate upcoming season', async () => {
      // Mock past start date
      const pastSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2023-01-01'),
        new Date('2024-03-31'),
        'upcoming',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(pastSeason);

      const result = await useCase.activateSeason(1);

      expect(seasonRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(mockActiveSeason);
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      await expect(useCase.activateSeason(1)).rejects.toThrow(
        'Season 1 not found',
      );
    });

    it('should throw error when season is not upcoming', async () => {
      seasonRepository.findById.mockResolvedValue(mockActiveSeason);

      await expect(useCase.activateSeason(2)).rejects.toThrow(
        'Can only activate upcoming seasons. Current status: active',
      );
    });

    it('should throw error when start date is in the future', async () => {
      const futureSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2026-01-01'),
        new Date('2026-03-31'),
        'upcoming',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(futureSeason);

      await expect(useCase.activateSeason(1)).rejects.toThrow(
        'Cannot activate season before start date',
      );
    });
  });

  describe('completeSeason', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockActiveSeason);
      seasonRepository.update.mockResolvedValue(mockSeason);
    });

    it('should complete active season', async () => {
      const result = await useCase.completeSeason(2);

      expect(seasonRepository.findById).toHaveBeenCalledWith(2);
      expect(result).toBe(mockSeason);
    });

    it('should set end date when completing season without end date', async () => {
      const seasonWithoutEndDate = new SeasonEntity(
        2,
        'Season 2',
        'base',
        new Date('2024-01-01'),
        null,
        'active',
        mockSeasonConfig,
        2000,
        100000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(seasonWithoutEndDate);

      await useCase.completeSeason(2);

      // Should call updateSeason with endDate set to current date
      expect(seasonRepository.update).toHaveBeenCalled();
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      await expect(useCase.completeSeason(2)).rejects.toThrow(
        'Season 2 not found',
      );
    });

    it('should throw error when season is not active', async () => {
      seasonRepository.findById.mockResolvedValue(mockSeason);

      await expect(useCase.completeSeason(1)).rejects.toThrow(
        'Can only complete active seasons. Current status: upcoming',
      );
    });
  });

  describe('getSeasonStats', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockSeason);
    });

    it('should return season stats with days remaining', async () => {
      const futureSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        new Date('2026-12-31'),
        'upcoming',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(futureSeason);

      const result = await useCase.getSeasonStats(1);

      expect(result).toEqual({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        status: 'upcoming',
        startDate: futureSeason.startDate,
        endDate: futureSeason.endDate,
        totalParticipants: 1000,
        totalShardsIssued: 50000,
        daysRemaining: expect.any(Number),
        progress: expect.any(Number),
      });
    });

    it('should return stats for season without end date', async () => {
      const seasonWithoutEndDate = new SeasonEntity(
        2,
        'Season 2',
        'base',
        new Date('2024-01-01'),
        null,
        'active',
        mockSeasonConfig,
        2000,
        100000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(seasonWithoutEndDate);

      const result = await useCase.getSeasonStats(2);

      expect(result.daysRemaining).toBe(null);
      expect(result.progress).toBeGreaterThan(0);
    });

    it('should calculate progress correctly for completed season', async () => {
      const completedSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        new Date('2024-03-31'),
        'completed',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );
      seasonRepository.findById.mockResolvedValue(completedSeason);

      const result = await useCase.getSeasonStats(1);

      expect(result.progress).toBeGreaterThan(0);
      expect(result.daysRemaining).toBe(null);
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      await expect(useCase.getSeasonStats(999)).rejects.toThrow(
        'Season 999 not found',
      );
    });
  });

  describe('getCurrentSeason', () => {
    it('should return current active season', async () => {
      seasonRepository.findActiveByChain.mockResolvedValue([mockActiveSeason]);

      const result = await useCase.getCurrentSeason('base');

      expect(seasonRepository.findActiveByChain).toHaveBeenCalledWith('base');
      expect(result).toBe(mockActiveSeason);
    });

    it('should return null when no active season', async () => {
      seasonRepository.findActiveByChain.mockResolvedValue([]);

      const result = await useCase.getCurrentSeason('base');

      expect(result).toBe(null);
    });
  });

  describe('getUpcomingSeasons', () => {
    const upcomingSeasons = [
      mockSeason,
      new SeasonEntity(
        3,
        'Season 3',
        'base',
        new Date('2024-04-01'),
        new Date('2024-06-30'),
        'upcoming',
        mockSeasonConfig,
        0,
        0,
        new Date(),
        new Date(),
      ),
    ];

    const mixedSeasons = [...upcomingSeasons, mockActiveSeason];

    it('should return upcoming seasons for specific chain', async () => {
      seasonRepository.findByChain.mockResolvedValue(mixedSeasons);

      const result = await useCase.getUpcomingSeasons('base');

      expect(seasonRepository.findByChain).toHaveBeenCalledWith('base');
      expect(result).toEqual(upcomingSeasons);
    });

    it('should return upcoming seasons for all chains', async () => {
      seasonRepository.findAll.mockResolvedValue(mixedSeasons);

      const result = await useCase.getUpcomingSeasons();

      expect(seasonRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(upcomingSeasons);
    });
  });

  describe('checkAndUpdateSeasonStatuses', () => {
    it('should activate upcoming seasons that should start', async () => {
      const pastUpcomingSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2023-01-01'),
        new Date('2024-03-31'),
        'upcoming',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );

      seasonRepository.findByChain.mockResolvedValue([]);
      seasonRepository.findAll.mockResolvedValue([pastUpcomingSeason]);
      seasonRepository.findByStatus.mockResolvedValue([]);
      seasonRepository.findById.mockResolvedValue(pastUpcomingSeason);
      seasonRepository.update.mockResolvedValue(mockActiveSeason);

      const result = await useCase.checkAndUpdateSeasonStatuses();

      expect(result).toBe(1);
    });

    it('should complete active seasons that should end', async () => {
      const pastActiveSeason = new SeasonEntity(
        2,
        'Season 2',
        'base',
        new Date('2024-01-01'),
        new Date('2023-12-31'),
        'active',
        mockSeasonConfig,
        2000,
        100000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );

      seasonRepository.findByChain.mockResolvedValue([]);
      seasonRepository.findAll.mockResolvedValue([]);
      seasonRepository.findByStatus.mockResolvedValue([pastActiveSeason]);
      seasonRepository.findById.mockResolvedValue(pastActiveSeason);
      seasonRepository.update.mockResolvedValue(mockSeason);

      const result = await useCase.checkAndUpdateSeasonStatuses();

      expect(result).toBe(1);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const pastUpcomingSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2023-01-01'),
        new Date('2024-03-31'),
        'upcoming',
        mockSeasonConfig,
        1000,
        50000,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );

      seasonRepository.findByChain.mockResolvedValue([pastUpcomingSeason]);
      seasonRepository.findAll.mockResolvedValue([pastUpcomingSeason]);
      seasonRepository.findByStatus.mockResolvedValue([]);
      seasonRepository.findById.mockResolvedValue(null); // This will cause an error

      const result = await useCase.checkAndUpdateSeasonStatuses();

      expect(result).toBe(0); // No seasons updated due to errors
    });

    it('should return 0 when no seasons need updating', async () => {
      seasonRepository.findByChain.mockResolvedValue([]);
      seasonRepository.findAll.mockResolvedValue([]);
      seasonRepository.findByStatus.mockResolvedValue([]);

      const result = await useCase.checkAndUpdateSeasonStatuses();

      expect(result).toBe(0);
    });
  });

  describe('datesOverlap', () => {
    it('should detect overlapping dates', () => {
      const start1 = new Date('2024-01-01');
      const end1 = new Date('2024-03-31');
      const start2 = new Date('2024-02-01');
      const end2 = new Date('2024-04-30');

      const result = (useCase as any).datesOverlap(start1, end1, start2, end2);

      expect(result).toBe(true);
    });

    it('should handle null end dates', () => {
      const start1 = new Date('2024-01-01');
      const end1 = null;
      const start2 = new Date('2024-02-01');
      const end2 = new Date('2024-04-30');

      const result = (useCase as any).datesOverlap(start1, end1, start2, end2);

      expect(result).toBe(true);
    });

    it('should detect non-overlapping dates', () => {
      const start1 = new Date('2024-01-01');
      const end1 = new Date('2024-03-31');
      const start2 = new Date('2024-04-01');
      const end2 = new Date('2024-06-30');

      const result = (useCase as any).datesOverlap(start1, end1, start2, end2);

      expect(result).toBe(false);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid status transitions', () => {
      expect(() => {
        (useCase as any).validateStatusTransition('upcoming', 'active');
      }).not.toThrow();

      expect(() => {
        (useCase as any).validateStatusTransition('active', 'completed');
      }).not.toThrow();
    });

    it('should reject invalid status transitions', () => {
      expect(() => {
        (useCase as any).validateStatusTransition('upcoming', 'completed');
      }).toThrow('Invalid status transition from upcoming to completed');

      expect(() => {
        (useCase as any).validateStatusTransition('completed', 'active');
      }).toThrow('Invalid status transition from completed to active');
    });

    it('should handle unknown status', () => {
      expect(() => {
        (useCase as any).validateStatusTransition('unknown', 'active');
      }).toThrow('Invalid status transition from unknown to active');
    });
  });
});
