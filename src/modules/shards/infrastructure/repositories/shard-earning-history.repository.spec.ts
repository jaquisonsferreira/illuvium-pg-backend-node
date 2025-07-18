import { Test, TestingModule } from '@nestjs/testing';
import { ShardEarningHistoryRepository } from './shard-earning-history.repository';
import {
  ShardEarningHistoryEntity,
  VaultBreakdown,
} from '../../domain/entities/shard-earning-history.entity';
import {
  ShardEarningHistory as DbShardEarningHistory,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('ShardEarningHistoryRepository', () => {
  let repository: ShardEarningHistoryRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockVaultBreakdown: VaultBreakdown[] = [
    {
      vaultId: 'vault1',
      asset: 'USDC',
      chain: 'base',
      shardsEarned: 500,
      usdValue: 1000,
    },
    {
      vaultId: 'vault2',
      asset: 'ETH',
      chain: 'base',
      shardsEarned: 1000,
      usdValue: 3000,
    },
  ];

  const mockDbHistory: DbShardEarningHistory = {
    id: '1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    season_id: 1,
    date: new Date('2024-01-15T00:00:00.000Z'),
    staking_shards: '1500',
    social_shards: '500',
    developer_shards: '750',
    referral_shards: '250',
    daily_total: '3000',
    vault_breakdown: mockVaultBreakdown,
    metadata: { source: 'automated' },
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShardEarningHistoryRepository,
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

    repository = module.get<ShardEarningHistoryRepository>(
      ShardEarningHistoryRepository,
    );
  });

  describe('findById', () => {
    it('should find history by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbHistory);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(ShardEarningHistoryEntity);
      expect(result?.id).toBe('1');
      expect(result?.walletAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.dailyTotal).toBe(3000);
    });

    it('should return null when history not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByWalletAndDate', () => {
    it('should find history by wallet and date', async () => {
      const testDate = new Date('2024-01-15T12:30:00.000Z');
      const normalizedDate = new Date('2024-01-15T00:00:00.000Z');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbHistory),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndDate(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
        testDate,
        1,
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('shard_earning_history');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'date',
        '=',
        normalizedDate,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBeInstanceOf(ShardEarningHistoryEntity);
    });

    it('should return null when no history found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndDate(
        '0xnonexistent',
        new Date(),
        1,
      );

      expect(result).toBeNull();
    });
  });

  describe('findByWallet', () => {
    it('should find history by wallet with pagination', async () => {
      // Create a mock that supports both selectAll and select chains
      const mockSelectFrom = {
        where: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbHistory]),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 10 }),
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWallet(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
        undefined,
        undefined,
        10,
        0,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(10);
      expect(mockSelectFrom.offset).toHaveBeenCalledWith(0);
      expect(result.history).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Create a mock that supports both selectAll and select chains
      const mockSelectFrom = {
        where: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbHistory]),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 5 }),
      };

      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWallet(
        '0xwallet',
        1,
        startDate,
        endDate,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'date',
        '>=',
        startDate,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('date', '<=', endDate);
      expect(result.history).toHaveLength(1);
      expect(result.total).toBe(5);
    });
  });

  describe('findByDateRange', () => {
    it('should find history by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbHistory]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByDateRange(1, startDate, endDate);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'date',
        '>=',
        startDate,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('date', '<=', endDate);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('date', 'asc');
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new history entry', async () => {
      const newHistory = ShardEarningHistoryEntity.create({
        walletAddress: '0xnewwallet',
        seasonId: 1,
        date: new Date('2024-01-20'),
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
        vaultBreakdown: [],
        metadata: { source: 'manual' },
      });

      const dbHistory = {
        ...mockDbHistory,
        id: newHistory.id,
        wallet_address: '0xnewwallet',
        daily_total: '250',
      };

      mockBaseRepository.create.mockResolvedValue(dbHistory);

      const result = await repository.create(newHistory);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: newHistory.id,
        wallet_address: '0xnewwallet',
        season_id: 1,
        date: newHistory.date,
        staking_shards: '100',
        social_shards: '50',
        developer_shards: '75',
        referral_shards: '25',
        daily_total: '250',
        vault_breakdown: [],
        metadata: { source: 'manual' },
      });
      expect(result).toBeInstanceOf(ShardEarningHistoryEntity);
      expect(result.dailyTotal).toBe(250);
    });
  });

  describe('createBatch', () => {
    it('should create multiple history entries', async () => {
      const histories = [
        ShardEarningHistoryEntity.create({
          walletAddress: '0xwallet1',
          seasonId: 1,
          date: new Date('2024-01-20'),
          stakingShards: 100,
        }),
        ShardEarningHistoryEntity.create({
          walletAddress: '0xwallet2',
          seasonId: 1,
          date: new Date('2024-01-20'),
          socialShards: 200,
        }),
      ];

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.insertInto.mockReturnValue(mockInsertInto);

      await repository.createBatch(histories);

      expect(mockDb.insertInto).toHaveBeenCalledWith('shard_earning_history');
      expect(mockInsertInto.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            wallet_address: '0xwallet1',
            staking_shards: '100',
            daily_total: '100',
          }),
          expect.objectContaining({
            wallet_address: '0xwallet2',
            social_shards: '200',
            daily_total: '200',
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
    it('should update existing history', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbHistory),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const historyToUpsert = ShardEarningHistoryEntity.create({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        seasonId: 1,
        date: new Date('2024-01-15'),
        stakingShards: 2000,
        socialShards: 600,
        developerShards: 800,
        referralShards: 300,
      });

      const mockUpdateTable = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.updateTable.mockReturnValue(mockUpdateTable);

      mockBaseRepository.findById.mockResolvedValue({
        ...mockDbHistory,
        daily_total: '3700',
      });

      const result = await repository.upsert(historyToUpsert);

      expect(mockUpdateTable.set).toHaveBeenCalled();
      expect(mockUpdateTable.where).toHaveBeenCalledWith('id', '=', '1');
      expect(result.dailyTotal).toBe(3700);
    });

    it('should create new history when not exists', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const historyToUpsert = ShardEarningHistoryEntity.create({
        walletAddress: '0xnewwallet',
        seasonId: 1,
        date: new Date('2024-01-20'),
        stakingShards: 100,
      });

      mockBaseRepository.create.mockResolvedValue({
        ...mockDbHistory,
        id: historyToUpsert.id,
        wallet_address: '0xnewwallet',
        daily_total: '100',
      });

      const result = await repository.upsert(historyToUpsert);

      expect(mockBaseRepository.create).toHaveBeenCalled();
      expect(result.dailyTotal).toBe(100);
    });
  });

  describe('getAverageDailyShards', () => {
    it('should calculate average daily shards', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ average: '1500.50' }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getAverageDailyShards(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
        30,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBe(1500.5);
    });

    it('should return 0 when no data', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ average: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getAverageDailyShards(
        '0xnonexistent',
        1,
        30,
      );

      expect(result).toBe(0);
    });
  });

  describe('getTopEarnersByDate', () => {
    it('should get top earners by date and total', async () => {
      const testDate = new Date('2024-01-15T12:00:00.000Z');
      const normalizedDate = new Date('2024-01-15T00:00:00.000Z');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbHistory]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTopEarnersByDate(testDate, 1, 10);

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'date',
        '=',
        normalizedDate,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'daily_total',
        'desc',
      );
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    it('should get top earners by specific category', async () => {
      const testDate = new Date('2024-01-15');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbHistory]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTopEarnersByDate(
        testDate,
        1,
        10,
        'developer',
      );

      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'developer_shards',
        'desc',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getSummaryByWallet', () => {
    it('should get complete summary for wallet', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({
          total_days: 30,
          total_shards: '45000',
          avg_daily_shards: '1500',
          total_staking: '22500',
          total_social: '7500',
          total_developer: '11250',
          total_referral: '3750',
        }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getSummaryByWallet(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result.totalDays).toBe(30);
      expect(result.totalShards).toBe(45000);
      expect(result.avgDailyShards).toBe(1500);
      expect(result.breakdown.staking).toBe(22500);
      expect(result.breakdown.social).toBe(7500);
      expect(result.breakdown.developer).toBe(11250);
      expect(result.breakdown.referral).toBe(3750);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({
          total_days: 31,
          total_shards: '31000',
          avg_daily_shards: '1000',
          total_staking: '15500',
          total_social: '5000',
          total_developer: '7500',
          total_referral: '3000',
        }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getSummaryByWallet(
        '0xwallet',
        1,
        startDate,
        endDate,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'date',
        '>=',
        startDate,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('date', '<=', endDate);
      expect(result.totalDays).toBe(31);
    });

    it('should handle no data gracefully', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getSummaryByWallet('0xnonexistent', 1);

      expect(result.totalDays).toBe(0);
      expect(result.totalShards).toBe(0);
      expect(result.avgDailyShards).toBe(0);
      expect(result.breakdown.staking).toBe(0);
      expect(result.breakdown.social).toBe(0);
      expect(result.breakdown.developer).toBe(0);
      expect(result.breakdown.referral).toBe(0);
    });
  });
});
