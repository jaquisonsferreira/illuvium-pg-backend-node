import { Test, TestingModule } from '@nestjs/testing';
import { SeasonRepository } from './season.repository';
import { SeasonEntity } from '../../domain/entities/season.entity';
import {
  Season as DbSeason,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('SeasonRepository', () => {
  let repository: SeasonRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbSeason: DbSeason = {
    id: 1,
    name: 'Season 1',
    chain: 'base',
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    status: 'active',
    config: {
      vaultRates: { usdc: 1, eth: 2, weth: 2 },
      socialConversionRate: 100,
      vaultLocked: false,
      withdrawalEnabled: true,
    },
    total_participants: 10,
    total_shards_issued: '1000',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockBaseRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    };

    mockRepositoryFactory = {
      createRepository: jest.fn().mockReturnValue(mockBaseRepository),
    } as any;

    const mockSelectFrom = {
      selectAll: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      executeTakeFirst: jest.fn(),
    };

    mockDb = {
      selectFrom: jest.fn().mockReturnValue(mockSelectFrom),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonRepository,
        {
          provide: RepositoryFactory,
          useValue: mockRepositoryFactory,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<SeasonRepository>(SeasonRepository);
  });

  describe('findById', () => {
    it('should find season by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbSeason);

      const result = await repository.findById(1);

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(SeasonEntity);
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('Season 1');
    });

    it('should return null when season not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findActive', () => {
    it('should find active season', async () => {
      const mockExecuteTakeFirst = jest.fn().mockResolvedValue(mockDbSeason);
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        executeTakeFirst: mockExecuteTakeFirst,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findActive();

      expect(mockDb.selectFrom).toHaveBeenCalledWith('seasons');
      expect(mockWhere).toHaveBeenCalledWith('status', '=', 'active');
      expect(result).toBeInstanceOf(SeasonEntity);
      expect(result?.status).toBe('active');
    });

    it('should return null when no active season', async () => {
      const mockExecuteTakeFirst = jest.fn().mockResolvedValue(null);
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        executeTakeFirst: mockExecuteTakeFirst,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findActive();

      expect(result).toBeNull();
    });
  });

  describe('findByChain', () => {
    it('should find seasons by chain', async () => {
      const mockExecute = jest.fn().mockResolvedValue([mockDbSeason]);
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        orderBy: mockOrderBy,
        execute: mockExecute,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByChain('base');

      expect(mockWhere).toHaveBeenCalledWith('chain', '=', 'base');
      expect(mockOrderBy).toHaveBeenCalledWith('id', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(SeasonEntity);
      expect(result[0].chain).toBe('base');
    });

    it('should return empty array when no seasons found', async () => {
      const mockExecute = jest.fn().mockResolvedValue([]);
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        orderBy: mockOrderBy,
        execute: mockExecute,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByChain('ethereum');

      expect(result).toEqual([]);
    });
  });

  describe('findActiveByChain', () => {
    it('should find active seasons by chain', async () => {
      const mockExecute = jest.fn().mockResolvedValue([mockDbSeason]);
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        orderBy: mockOrderBy,
        execute: mockExecute,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findActiveByChain('base');

      expect(mockWhere).toHaveBeenCalledWith('chain', '=', 'base');
      expect(mockWhere).toHaveBeenCalledWith('status', '=', 'active');
      expect(mockOrderBy).toHaveBeenCalledWith('id', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
      expect(result[0].chain).toBe('base');
    });
  });

  describe('findByStatus', () => {
    it('should find seasons by status', async () => {
      const mockExecute = jest.fn().mockResolvedValue([mockDbSeason]);
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        orderBy: mockOrderBy,
        execute: mockExecute,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByStatus('active');

      expect(mockWhere).toHaveBeenCalledWith('status', '=', 'active');
      expect(mockOrderBy).toHaveBeenCalledWith('id', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });
  });

  describe('findAll', () => {
    it('should find all seasons', async () => {
      mockBaseRepository.findAll.mockResolvedValue([mockDbSeason]);

      const result = await repository.findAll();

      expect(mockBaseRepository.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(SeasonEntity);
    });
  });

  describe('create', () => {
    it('should create a new season', async () => {
      const newSeason = new SeasonEntity(
        2,
        'Season 2',
        'ethereum',
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        'upcoming',
        {
          vaultRates: {},
          socialConversionRate: 100,
          vaultLocked: false,
          withdrawalEnabled: true,
        },
        0,
        0,
        new Date(),
        new Date(),
      );

      const dbSeason = {
        ...mockDbSeason,
        id: 2,
        name: 'Season 2',
        chain: 'ethereum',
        status: 'upcoming',
      };

      mockBaseRepository.create.mockResolvedValue(dbSeason);

      const result = await repository.create(newSeason);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: 2,
        name: 'Season 2',
        chain: 'ethereum',
        start_date: newSeason.startDate,
        end_date: newSeason.endDate,
        status: 'upcoming',
        config: newSeason.config,
        total_participants: 0,
        total_shards_issued: '0',
      });
      expect(result).toBeInstanceOf(SeasonEntity);
      expect(result.id).toBe(2);
    });
  });

  describe('update', () => {
    it('should update an existing season', async () => {
      const seasonToUpdate = new SeasonEntity(
        1,
        'Season 1 Updated',
        'base',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'completed',
        mockDbSeason.config as any,
        100,
        5000,
        new Date(),
        new Date(),
      );

      const updatedDbSeason = {
        ...mockDbSeason,
        name: 'Season 1 Updated',
        status: 'completed',
        total_participants: 100,
        total_shards_issued: '5000',
      };

      mockBaseRepository.update.mockResolvedValue(updatedDbSeason);

      const result = await repository.update(seasonToUpdate);

      expect(mockBaseRepository.update).toHaveBeenCalledWith('1', {
        id: 1,
        name: 'Season 1 Updated',
        chain: 'base',
        start_date: seasonToUpdate.startDate,
        end_date: seasonToUpdate.endDate,
        status: 'completed',
        config: seasonToUpdate.config,
        total_participants: 100,
        total_shards_issued: '5000',
      });
      expect(result.name).toBe('Season 1 Updated');
      expect(result.status).toBe('completed');
    });

    it('should throw error when season not found', async () => {
      const seasonToUpdate = new SeasonEntity(
        999,
        'Non-existent',
        'base',
        new Date(),
        new Date(),
        'active',
        {
          vaultRates: {},
          socialConversionRate: 100,
          vaultLocked: false,
          withdrawalEnabled: true,
        },
        0,
        0,
        new Date(),
        new Date(),
      );

      mockBaseRepository.update.mockResolvedValue(null);

      await expect(repository.update(seasonToUpdate)).rejects.toThrow(
        'Season with id 999 not found',
      );
    });
  });

  describe('findUpcoming', () => {
    it('should find upcoming seasons', async () => {
      const upcomingSeason = { ...mockDbSeason, status: 'upcoming' };
      const mockExecute = jest.fn().mockResolvedValue([upcomingSeason]);
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        orderBy: mockOrderBy,
        execute: mockExecute,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findUpcoming();

      expect(mockWhere).toHaveBeenCalledWith('status', '=', 'upcoming');
      expect(mockOrderBy).toHaveBeenCalledWith('start_date', 'asc');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('upcoming');
    });
  });

  describe('findCompleted', () => {
    it('should find completed seasons', async () => {
      const completedSeason = { ...mockDbSeason, status: 'completed' };
      const mockExecute = jest.fn().mockResolvedValue([completedSeason]);
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelectAll = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        selectAll: mockSelectAll,
        where: mockWhere,
        orderBy: mockOrderBy,
        execute: mockExecute,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findCompleted();

      expect(mockWhere).toHaveBeenCalledWith('status', '=', 'completed');
      expect(mockOrderBy).toHaveBeenCalledWith('end_date', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });
  });

  describe('exists', () => {
    it('should return true when season exists', async () => {
      const mockExecuteTakeFirst = jest.fn().mockResolvedValue({ id: 1 });
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        select: mockSelect,
        where: mockWhere,
        executeTakeFirst: mockExecuteTakeFirst,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.exists(1);

      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 1);
      expect(result).toBe(true);
    });

    it('should return false when season does not exist', async () => {
      const mockExecuteTakeFirst = jest.fn().mockResolvedValue(null);
      const mockWhere = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSelectFrom = {
        select: mockSelect,
        where: mockWhere,
        executeTakeFirst: mockExecuteTakeFirst,
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.exists(999);

      expect(result).toBe(false);
    });
  });
});
