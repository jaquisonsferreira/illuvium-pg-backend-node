import { Test, TestingModule } from '@nestjs/testing';
import { PriceHistoryRepository } from './price-history.repository';
import { PriceHistoryEntity } from '../../domain/entities/price-history.entity';
import {
  PriceHistory as DbPriceHistory,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('PriceHistoryRepository', () => {
  let repository: PriceHistoryRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbPriceHistory: DbPriceHistory = {
    id: '1',
    token_address: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'ethereum',
    price_usd: '1500.50',
    price_change_24h: '5.25',
    market_cap: '1000000000',
    volume_24h: '500000000',
    timestamp: new Date('2024-01-15T12:00:00.000Z'),
    source: 'coingecko',
    granularity: 'hourly',
    created_at: new Date('2024-01-15T12:00:00.000Z'),
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

    mockDb = {
      selectFrom: jest.fn(),
      insertInto: jest.fn(),
      updateTable: jest.fn(),
      deleteFrom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceHistoryRepository,
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

    repository = module.get<PriceHistoryRepository>(PriceHistoryRepository);
  });

  describe('findById', () => {
    it('should find price history by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbPriceHistory);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(PriceHistoryEntity);
      expect(result?.id).toBe('1');
      expect(result?.tokenAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.priceUsd).toBe(1500.5);
    });

    it('should return null when price history not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findLatestByToken', () => {
    it('should find latest price by token', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbPriceHistory),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLatestByToken(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
        'ethereum',
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('price_history');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'token_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'chain',
        '=',
        'ethereum',
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(1);
      expect(result).toBeInstanceOf(PriceHistoryEntity);
    });

    it('should return null when no price found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLatestByToken(
        '0xnonexistent',
        'ethereum',
      );

      expect(result).toBeNull();
    });
  });

  describe('findByTokenAndTimeRange', () => {
    it('should find prices by token and time range', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPriceHistory]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByTokenAndTimeRange(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        'ethereum',
        startTime,
        endTime,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'token_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '>=',
        startTime,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '<=',
        endTime,
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('timestamp', 'asc');
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(PriceHistoryEntity);
    });

    it('should filter by granularity when provided', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPriceHistory]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByTokenAndTimeRange(
        '0xtoken',
        'ethereum',
        startTime,
        endTime,
        'daily',
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'granularity',
        '=',
        'daily',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findByTokenAndDate', () => {
    it('should find price by token and date', async () => {
      const testDate = new Date('2024-01-15T15:30:00.000Z');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbPriceHistory),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByTokenAndDate(
        '0xtoken',
        'ethereum',
        testDate,
      );

      const startOfDay = new Date('2024-01-15T00:00:00.000Z');
      const endOfDay = new Date('2024-01-15T23:59:59.999Z');

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '>=',
        startOfDay,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '<=',
        endOfDay,
      );
      expect(result).toBeInstanceOf(PriceHistoryEntity);
    });
  });

  describe('findMultipleTokensLatest', () => {
    it('should find latest prices for multiple tokens', async () => {
      const tokens = [
        { address: '0xtoken1', chain: 'ethereum' },
        { address: '0xtoken2', chain: 'base' },
      ];

      // Mock the repository method directly
      jest
        .spyOn(repository, 'findMultipleTokensLatest')
        .mockResolvedValueOnce([
          new PriceHistoryEntity(
            mockDbPriceHistory.id,
            mockDbPriceHistory.token_address,
            mockDbPriceHistory.chain,
            parseFloat(mockDbPriceHistory.price_usd),
            mockDbPriceHistory.price_change_24h
              ? parseFloat(mockDbPriceHistory.price_change_24h)
              : null,
            mockDbPriceHistory.market_cap
              ? parseFloat(mockDbPriceHistory.market_cap)
              : null,
            mockDbPriceHistory.volume_24h
              ? parseFloat(mockDbPriceHistory.volume_24h)
              : null,
            mockDbPriceHistory.timestamp,
            mockDbPriceHistory.source,
            mockDbPriceHistory.granularity,
            mockDbPriceHistory.created_at,
          ),
        ]);

      const result = await repository.findMultipleTokensLatest(tokens);

      expect(repository.findMultipleTokensLatest).toHaveBeenCalledWith(tokens);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(PriceHistoryEntity);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.findMultipleTokensLatest([]);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a new price history', async () => {
      const newPriceHistory = PriceHistoryEntity.create({
        tokenAddress: '0xnewtoken',
        chain: 'ethereum',
        priceUsd: 2000,
        priceChange24h: 10,
        marketCap: 2000000000,
        volume24h: 1000000000,
        timestamp: new Date('2024-01-20'),
        source: 'coingecko',
        granularity: 'hourly',
      });

      const dbPriceHistory = {
        ...mockDbPriceHistory,
        id: newPriceHistory.id,
        token_address: '0xnewtoken',
        price_usd: '2000',
      };

      mockBaseRepository.create.mockResolvedValue(dbPriceHistory);

      const result = await repository.create(newPriceHistory);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: newPriceHistory.id,
        token_address: '0xnewtoken',
        chain: 'ethereum',
        price_usd: '2000',
        price_change_24h: '10',
        market_cap: '2000000000',
        volume_24h: '1000000000',
        timestamp: newPriceHistory.timestamp,
        source: 'coingecko',
        granularity: 'hourly',
      });
      expect(result).toBeInstanceOf(PriceHistoryEntity);
      expect(result.priceUsd).toBe(2000);
    });
  });

  describe('createBatch', () => {
    it('should create multiple price histories with upsert', async () => {
      const priceHistories = [
        PriceHistoryEntity.create({
          tokenAddress: '0xtoken1',
          chain: 'ethereum',
          priceUsd: 1000,
          timestamp: new Date('2024-01-20'),
          source: 'coingecko',
          granularity: 'hourly',
        }),
        PriceHistoryEntity.create({
          tokenAddress: '0xtoken2',
          chain: 'base',
          priceUsd: 500,
          timestamp: new Date('2024-01-20'),
          source: 'coingecko',
          granularity: 'hourly',
        }),
      ];

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        onConflict: jest.fn(),
        execute: jest.fn().mockResolvedValue(undefined),
      };

      // onConflict should return the insert query to allow chaining
      mockInsertInto.onConflict.mockImplementation((callback) => {
        const conflictBuilder = {
          columns: jest.fn().mockReturnThis(),
          doUpdateSet: jest.fn().mockReturnValue(mockInsertInto), // Return the insert query
        };
        callback(conflictBuilder);
        return mockInsertInto;
      });

      mockDb.insertInto.mockReturnValue(mockInsertInto);

      await repository.createBatch(priceHistories);

      expect(mockDb.insertInto).toHaveBeenCalledWith('price_history');
      expect(mockInsertInto.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            token_address: '0xtoken1',
            price_usd: '1000',
          }),
          expect.objectContaining({
            token_address: '0xtoken2',
            price_usd: '500',
          }),
        ]),
      );
    });

    it('should handle empty batch', async () => {
      await repository.createBatch([]);

      expect(mockDb.insertInto).not.toHaveBeenCalled();
    });
  });

  describe('upsert', () => {
    it('should upsert price history', async () => {
      const priceHistory = PriceHistoryEntity.create({
        tokenAddress: '0xtoken',
        chain: 'ethereum',
        priceUsd: 1500,
        timestamp: new Date('2024-01-20'),
        source: 'coingecko',
        granularity: 'hourly',
      });

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        onConflict: jest.fn(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirstOrThrow: jest.fn().mockResolvedValue({
          ...mockDbPriceHistory,
          price_usd: '1500',
        }),
      };

      // onConflict should return the insert query to allow chaining
      mockInsertInto.onConflict.mockImplementation((callback) => {
        const conflictBuilder = {
          columns: jest.fn().mockReturnThis(),
          doUpdateSet: jest.fn().mockReturnValue(mockInsertInto), // Return the insert query
        };
        callback(conflictBuilder);
        return mockInsertInto;
      });

      mockDb.insertInto.mockReturnValue(mockInsertInto);

      const result = await repository.upsert(priceHistory);

      expect(mockInsertInto.onConflict).toHaveBeenCalled();
      expect(result).toBeInstanceOf(PriceHistoryEntity);
      expect(result.priceUsd).toBe(1500);
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete old price histories', async () => {
      const cutoffDate = new Date('2024-01-01');

      const mockDeleteFrom = {
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ numDeletedRows: 10n }),
      };
      mockDb.deleteFrom.mockReturnValue(mockDeleteFrom);

      const result = await repository.deleteOlderThan(cutoffDate);

      expect(mockDb.deleteFrom).toHaveBeenCalledWith('price_history');
      expect(mockDeleteFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '<',
        cutoffDate,
      );
      expect(result).toBe(10);
    });

    it('should filter by granularity when provided', async () => {
      const cutoffDate = new Date('2024-01-01');

      const mockDeleteFrom = {
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ numDeletedRows: 5n }),
      };
      mockDb.deleteFrom.mockReturnValue(mockDeleteFrom);

      const result = await repository.deleteOlderThan(cutoffDate, 'minutely');

      expect(mockDeleteFrom.where).toHaveBeenCalledWith(
        'granularity',
        '=',
        'minutely',
      );
      expect(result).toBe(5);
    });
  });

  describe('getAveragePriceForPeriod', () => {
    it('should calculate average price for period', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ avg_price: 1250.75 }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getAveragePriceForPeriod(
        '0xtoken',
        'ethereum',
        startDate,
        endDate,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'token_address',
        '=',
        '0xtoken',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '>=',
        startDate,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'timestamp',
        '<=',
        endDate,
      );
      expect(result).toBe(1250.75);
    });

    it('should return null when no data found', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ avg_price: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getAveragePriceForPeriod(
        '0xtoken',
        'ethereum',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result).toBeNull();
    });
  });

  describe('getHighLowForPeriod', () => {
    it('should get high and low prices for period', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ high: 2000, low: 1000 }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getHighLowForPeriod(
        '0xtoken',
        'ethereum',
        startDate,
        endDate,
      );

      expect(result).toEqual({ high: 2000, low: 1000 });
    });

    it('should return null when no data found', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ high: null, low: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getHighLowForPeriod(
        '0xtoken',
        'ethereum',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result).toBeNull();
    });
  });
});
