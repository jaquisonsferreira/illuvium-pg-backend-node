import { Test, TestingModule } from '@nestjs/testing';
import { ReferralRepository } from './referral.repository';
import { ReferralEntity } from '../../domain/entities/referral.entity';
import {
  Referral as DbReferral,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('ReferralRepository', () => {
  let repository: ReferralRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbReferral: DbReferral = {
    id: '1',
    referrer_address: '0x1234567890abcdef1234567890abcdef12345678',
    referee_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    season_id: 1,
    status: 'active',
    activation_date: new Date('2024-01-10'),
    referee_multiplier_expires: new Date('2024-02-09'),
    total_shards_earned: '500',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-10'),
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
        ReferralRepository,
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

    repository = module.get<ReferralRepository>(ReferralRepository);
  });

  describe('findById', () => {
    it('should find referral by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbReferral);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(ReferralEntity);
      expect(result?.id).toBe('1');
      expect(result?.referrerAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.totalShardsEarned).toBe(500);
    });

    it('should return null when referral not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByRefereeAndSeason', () => {
    it('should find referral by referee and season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbReferral),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByRefereeAndSeason(
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12', // uppercase to test toLowerCase
        1,
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('referrals');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referee_address',
        '=',
        '0xabcdef1234567890abcdef1234567890abcdef12', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBeInstanceOf(ReferralEntity);
      expect(result?.refereeAddress).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef12',
      );
    });

    it('should return null when no referral found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByRefereeAndSeason(
        '0xnonexistent',
        1,
      );

      expect(result).toBeNull();
    });
  });

  describe('findByReferrerAndSeason', () => {
    it('should find referrals by referrer and season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbReferral]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByReferrerAndSeason(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referrer_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ReferralEntity);
    });

    it('should return empty array when no referrals found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByReferrerAndSeason(
        '0xnonexistent',
        1,
      );

      expect(result).toEqual([]);
    });
  });

  describe('findActiveByReferrer', () => {
    it('should find active referrals by referrer', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbReferral]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findActiveByReferrer(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referrer_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'status',
        '=',
        'active',
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'activation_date',
        'desc',
      );
      expect(result[0].status).toBe('active');
    });
  });

  describe('countByReferrerAndSeason', () => {
    it('should count referrals by referrer and season', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 5 }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.countByReferrerAndSeason(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referrer_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBe(5);
    });

    it('should return 0 when no referrals', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.countByReferrerAndSeason(
        '0xnonexistent',
        1,
      );

      expect(result).toBe(0);
    });
  });

  describe('countActiveByReferrerAndSeason', () => {
    it('should count active referrals by referrer and season', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 3 }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.countActiveByReferrerAndSeason(
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'status',
        '=',
        'active',
      );
      expect(result).toBe(3);
    });
  });

  describe('create', () => {
    it('should create a new referral', async () => {
      const newReferral = ReferralEntity.create({
        referrerAddress: '0xreferrer',
        refereeAddress: '0xreferee',
        seasonId: 1,
      });

      const dbReferral = {
        ...mockDbReferral,
        id: newReferral.id,
        referrer_address: '0xreferrer',
        referee_address: '0xreferee',
        status: 'pending',
        activation_date: null,
        referee_multiplier_expires: null,
        total_shards_earned: '0',
      };

      mockBaseRepository.create.mockResolvedValue(dbReferral);

      const result = await repository.create(newReferral);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: newReferral.id,
        referrer_address: '0xreferrer',
        referee_address: '0xreferee',
        season_id: 1,
        status: 'pending',
        activation_date: null,
        referee_multiplier_expires: null,
        total_shards_earned: '0',
      });
      expect(result).toBeInstanceOf(ReferralEntity);
      expect(result.status).toBe('pending');
    });
  });

  describe('update', () => {
    it('should update an existing referral', async () => {
      const referralToUpdate = new ReferralEntity(
        '1',
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12',
        1,
        'active',
        new Date('2024-01-10'),
        new Date('2024-02-09'),
        750, // Updated shards
        new Date('2024-01-01'),
        new Date(),
      );

      const updatedDbReferral = {
        ...mockDbReferral,
        total_shards_earned: '750',
      };

      mockBaseRepository.update.mockResolvedValue(updatedDbReferral);

      const result = await repository.update(referralToUpdate);

      expect(mockBaseRepository.update).toHaveBeenCalledWith('1', {
        id: '1',
        referrer_address: '0x1234567890abcdef1234567890abcdef12345678',
        referee_address: '0xabcdef1234567890abcdef1234567890abcdef12',
        season_id: 1,
        status: 'active',
        activation_date: referralToUpdate.activationDate,
        referee_multiplier_expires: referralToUpdate.refereeMultiplierExpires,
        total_shards_earned: '750',
      });
      expect(result.totalShardsEarned).toBe(750);
    });

    it('should throw error when referral not found', async () => {
      const referralToUpdate = new ReferralEntity(
        '999',
        '0xreferrer',
        '0xreferee',
        1,
        'pending',
        null,
        null,
        0,
        new Date(),
        new Date(),
      );

      mockBaseRepository.update.mockResolvedValue(null);

      await expect(repository.update(referralToUpdate)).rejects.toThrow(
        'Referral with id 999 not found',
      );
    });
  });

  describe('findPendingActivations', () => {
    it('should find pending referrals with sufficient referee shards', async () => {
      const pendingReferral = {
        ...mockDbReferral,
        status: 'pending',
        activation_date: null,
        referee_multiplier_expires: null,
      };

      const mockSelectFrom = {
        innerJoin: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([pendingReferral]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findPendingActivations(1, 100);

      expect(mockDb.selectFrom).toHaveBeenCalledWith('referrals');
      expect(mockSelectFrom.innerJoin).toHaveBeenCalledWith(
        'shard_balances',
        expect.any(Function),
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referrals.season_id',
        '=',
        1,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referrals.status',
        '=',
        'pending',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'shard_balances.total_shards',
        '>=',
        '100',
      );
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('findExpiringBonuses', () => {
    it('should find referrals with expiring bonuses', async () => {
      const expiryDate = new Date('2024-02-10');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbReferral]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findExpiringBonuses(1, expiryDate);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'status',
        '=',
        'active',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referee_multiplier_expires',
        '<=',
        expiryDate,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getTotalReferralShardsByReferrer', () => {
    it('should get total referral shards by referrer', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: '1250.75' }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalReferralShardsByReferrer(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'referrer_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBe(1250.75);
    });

    it('should return 0 when no shards earned', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalReferralShardsByReferrer(
        '0xnonexistent',
        1,
      );

      expect(result).toBe(0);
    });
  });
});
