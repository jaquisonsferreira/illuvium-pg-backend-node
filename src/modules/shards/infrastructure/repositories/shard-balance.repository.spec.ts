import { Test, TestingModule } from '@nestjs/testing';
import { ShardBalanceRepository } from './shard-balance.repository';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';
import {
  ShardBalance as DbShardBalance,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('ShardBalanceRepository', () => {
  let repository: ShardBalanceRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbShardBalance: DbShardBalance = {
    id: '1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    season_id: 1,
    staking_shards: '1000',
    social_shards: '500',
    developer_shards: '750',
    referral_shards: '250',
    total_shards: '2500',
    last_calculated_at: new Date('2024-01-15'),
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-15'),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShardBalanceRepository,
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

    repository = module.get<ShardBalanceRepository>(ShardBalanceRepository);
  });

  describe('findById', () => {
    it('should find shard balance by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbShardBalance);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(ShardBalanceEntity);
      expect(result?.id).toBe('1');
      expect(result?.walletAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.totalShards).toBe(2500);
    });

    it('should return null when shard balance not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByWalletAndSeason', () => {
    it('should find shard balance by wallet and season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbShardBalance),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndSeason(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
        1,
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('shard_balances');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBeInstanceOf(ShardBalanceEntity);
      expect(result?.walletAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
    });

    it('should return null when no balance found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndSeason('0xnonexistent', 1);

      expect(result).toBeNull();
    });
  });

  describe('findByWallet', () => {
    it('should find all shard balances for a wallet', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbShardBalance]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWallet(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('season_id', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ShardBalanceEntity);
    });

    it('should return empty array when no balances found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWallet('0xnonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findBySeason', () => {
    it('should find all shard balances for a season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbShardBalance]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySeason(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'total_shards',
        'desc',
      );
      expect(result).toHaveLength(1);
      expect(result[0].seasonId).toBe(1);
    });
  });

  describe('findTopBySeason', () => {
    it('should find top balances by total shards', async () => {
      const mockSelectFrom1 = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbShardBalance]),
      };

      const mockSelectFrom2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 100 }),
      };

      mockDb.selectFrom
        .mockReturnValueOnce(mockSelectFrom1)
        .mockReturnValueOnce(mockSelectFrom2);

      const result = await repository.findTopBySeason(1, 10, 0);

      expect(mockSelectFrom1.orderBy).toHaveBeenCalledWith(
        'total_shards',
        'desc',
      );
      expect(mockSelectFrom1.limit).toHaveBeenCalledWith(10);
      expect(mockSelectFrom1.offset).toHaveBeenCalledWith(0);
      expect(result.balances).toHaveLength(1);
      expect(result.total).toBe(100);
    });

    it('should find top balances by specific category', async () => {
      const mockSelectFrom1 = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbShardBalance]),
      };

      const mockSelectFrom2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 50 }),
      };

      mockDb.selectFrom
        .mockReturnValueOnce(mockSelectFrom1)
        .mockReturnValueOnce(mockSelectFrom2);

      const result = await repository.findTopBySeason(1, 10, 0, 'developer');

      expect(mockSelectFrom1.orderBy).toHaveBeenCalledWith(
        'developer_shards',
        'desc',
      );
      expect(result.balances).toHaveLength(1);
      expect(result.total).toBe(50);
    });
  });

  describe('create', () => {
    it('should create a new shard balance', async () => {
      const newBalance = new ShardBalanceEntity(
        '2',
        '0xabcdef1234567890abcdef1234567890abcdef12',
        1,
        500,
        250,
        300,
        50,
        1100,
        new Date(),
        new Date(),
        new Date(),
      );

      const dbBalance = {
        ...mockDbShardBalance,
        id: '2',
        wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12',
        total_shards: '1100',
      };

      mockBaseRepository.create.mockResolvedValue(dbBalance);

      const result = await repository.create(newBalance);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: '2',
        wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12',
        season_id: 1,
        staking_shards: '500',
        social_shards: '250',
        developer_shards: '300',
        referral_shards: '50',
        total_shards: '1100',
        last_calculated_at: newBalance.lastCalculatedAt,
      });
      expect(result).toBeInstanceOf(ShardBalanceEntity);
      expect(result.id).toBe('2');
    });
  });

  describe('update', () => {
    it('should update an existing shard balance', async () => {
      const balanceToUpdate = new ShardBalanceEntity(
        '1',
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        1500,
        600,
        800,
        300,
        3200,
        new Date(),
        new Date(),
        new Date(),
      );

      const updatedDbBalance = {
        ...mockDbShardBalance,
        staking_shards: '1500',
        total_shards: '3200',
      };

      mockBaseRepository.update.mockResolvedValue(updatedDbBalance);

      const result = await repository.update(balanceToUpdate);

      expect(mockBaseRepository.update).toHaveBeenCalledWith('1', {
        id: '1',
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        season_id: 1,
        staking_shards: '1500',
        social_shards: '600',
        developer_shards: '800',
        referral_shards: '300',
        total_shards: '3200',
        last_calculated_at: balanceToUpdate.lastCalculatedAt,
      });
      expect(result.totalShards).toBe(3200);
    });

    it('should throw error when balance not found', async () => {
      const balanceToUpdate = new ShardBalanceEntity(
        '999',
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        1500,
        600,
        800,
        300,
        3200,
        new Date(),
        new Date(),
        new Date(),
      );

      mockBaseRepository.update.mockResolvedValue(null);

      await expect(repository.update(balanceToUpdate)).rejects.toThrow(
        'ShardBalance with id 999 not found',
      );
    });
  });

  describe('upsert', () => {
    it('should update existing balance', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbShardBalance),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const balanceToUpsert = new ShardBalanceEntity(
        'new-id',
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        2000,
        600,
        800,
        400,
        3800,
        new Date(),
        new Date(),
        new Date(),
      );

      const updatedDbBalance = {
        ...mockDbShardBalance,
        total_shards: '3800',
      };

      mockBaseRepository.update.mockResolvedValue(updatedDbBalance);

      const result = await repository.upsert(balanceToUpsert);

      expect(mockBaseRepository.update).toHaveBeenCalled();
      expect(result.totalShards).toBe(3800);
    });

    it('should create new balance when not exists', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const balanceToUpsert = new ShardBalanceEntity(
        '2',
        '0xnewwallet',
        1,
        100,
        50,
        75,
        25,
        250,
        new Date(),
        new Date(),
        new Date(),
      );

      const dbBalance = {
        ...mockDbShardBalance,
        id: '2',
        wallet_address: '0xnewwallet',
        total_shards: '250',
      };

      mockBaseRepository.create.mockResolvedValue(dbBalance);

      const result = await repository.upsert(balanceToUpsert);

      expect(mockBaseRepository.create).toHaveBeenCalled();
      expect(result.totalShards).toBe(250);
    });
  });

  describe('getTotalParticipantsBySeason', () => {
    it('should get total participants count', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 1234 }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalParticipantsBySeason(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'total_shards',
        '>',
        '0',
      );
      expect(result).toBe(1234);
    });

    it('should return 0 when no participants', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalParticipantsBySeason(1);

      expect(result).toBe(0);
    });
  });

  describe('getTotalShardsIssuedBySeason', () => {
    it('should get total shards issued', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: '1234567.89' }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalShardsIssuedBySeason(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBe(1234567.89);
    });

    it('should return 0 when no shards issued', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalShardsIssuedBySeason(1);

      expect(result).toBe(0);
    });
  });

  describe('getWalletRank', () => {
    it('should get wallet rank by total shards', async () => {
      // First call to get user balance
      const mockSelectFrom1 = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbShardBalance),
      };

      // Second call to count better wallets
      const mockSelectFrom2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 9 }),
      };

      mockDb.selectFrom
        .mockReturnValueOnce(mockSelectFrom1)
        .mockReturnValueOnce(mockSelectFrom2);

      const result = await repository.getWalletRank(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
        'total', // explicitly pass 'total' as category
      );

      expect(result).toBe(10); // 9 wallets have more shards + 1
    });

    it('should get wallet rank by specific category', async () => {
      const mockSelectFrom1 = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbShardBalance),
      };

      const mockSelectFrom2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 4 }),
      };

      mockDb.selectFrom
        .mockReturnValueOnce(mockSelectFrom1)
        .mockReturnValueOnce(mockSelectFrom2);

      const result = await repository.getWalletRank(
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        'developer',
      );

      expect(result).toBe(5);
    });

    it('should return 0 when wallet not found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getWalletRank('0xnonexistent', 1);

      expect(result).toBe(0);
    });
  });

  describe('searchByWallet', () => {
    it('should search wallets by partial address', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbShardBalance]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.searchByWallet('1234', 1, 10);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        'like',
        '%1234%',
      );
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no matches', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.searchByWallet('xyz', 1, 10);

      expect(result).toEqual([]);
    });
  });
});
