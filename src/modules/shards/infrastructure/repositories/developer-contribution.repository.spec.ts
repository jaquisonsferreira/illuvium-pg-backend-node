import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperContributionRepository } from './developer-contribution.repository';
import {
  DeveloperContributionEntity,
  DeveloperActionType,
} from '../../domain/entities/developer-contribution.entity';
import {
  DeveloperContribution as DbDeveloperContribution,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('DeveloperContributionRepository', () => {
  let repository: DeveloperContributionRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbContribution: DbDeveloperContribution = {
    id: '1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    season_id: 1,
    action_type: DeveloperActionType.SMART_CONTRACT_DEPLOY,
    action_details: {
      contractAddress: '0xcontract',
      transactionHash: '0xtx',
      description: 'Deployed a new smart contract',
    },
    shards_earned: '1000',
    verified: true,
    verified_at: new Date('2024-01-10'),
    verified_by: 'admin',
    distributed_at: new Date('2024-01-15'),
    created_at: new Date('2024-01-05'),
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
      insertInto: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperContributionRepository,
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

    repository = module.get<DeveloperContributionRepository>(
      DeveloperContributionRepository,
    );
  });

  describe('findById', () => {
    it('should find contribution by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbContribution);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(DeveloperContributionEntity);
      expect(result?.id).toBe('1');
      expect(result?.walletAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.shardsEarned).toBe(1000);
    });

    it('should return null when contribution not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByWallet', () => {
    it('should find contributions by wallet', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
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
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(DeveloperContributionEntity);
    });

    it('should find contributions by wallet and season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWallet(
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findByWalletAndDate', () => {
    it('should find contributions by wallet and date', async () => {
      const testDate = new Date('2024-01-05T12:00:00Z');
      const startOfDay = new Date('2024-01-05T00:00:00.000Z');
      const endOfDay = new Date('2024-01-05T23:59:59.999Z');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndDate(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        testDate,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'created_at',
        '>=',
        startOfDay,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'created_at',
        '<=',
        endOfDay,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findBySeason', () => {
    it('should find all contributions by season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySeason(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toHaveLength(1);
    });

    it('should find verified contributions', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySeason(1, true);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith('verified', '=', true);
      expect(result).toHaveLength(1);
    });

    it('should find distributed contributions', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySeason(1, undefined, true);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'distributed_at',
        'is not',
        null,
      );
      expect(result).toHaveLength(1);
    });

    it('should find undistributed contributions', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySeason(1, undefined, false);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'distributed_at',
        'is',
        null,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('findUnverified', () => {
    it('should find unverified contributions', async () => {
      const unverifiedContribution = {
        ...mockDbContribution,
        verified: false,
        verified_at: null,
        verified_by: null,
      };

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([unverifiedContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findUnverified(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith('verified', '=', false);
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('created_at', 'asc');
      expect(result[0].verified).toBe(false);
    });
  });

  describe('findVerifiedUndistributed', () => {
    it('should find verified but undistributed contributions', async () => {
      const verifiedUndistributed = {
        ...mockDbContribution,
        distributed_at: null,
      };

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([verifiedUndistributed]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findVerifiedUndistributed(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(mockSelectFrom.where).toHaveBeenCalledWith('verified', '=', true);
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'distributed_at',
        'is',
        null,
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('verified_at', 'asc');
      expect(result[0].verified).toBe(true);
      expect(result[0].distributedAt).toBeNull();
    });
  });

  describe('findByActionType', () => {
    it('should find contributions by action type', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbContribution]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByActionType(
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'action_type',
        '=',
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result[0].actionType).toBe(
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
      );
    });
  });

  describe('create', () => {
    it('should create a new contribution', async () => {
      const newContribution = DeveloperContributionEntity.create({
        walletAddress: '0xnewwallet',
        seasonId: 1,
        actionType: DeveloperActionType.GITHUB_CONTRIBUTION,
        actionDetails: { repositoryUrl: 'https://github.com/test/repo' },
        shardsEarned: 500,
      });

      const dbContribution = {
        ...mockDbContribution,
        id: newContribution.id,
        wallet_address: '0xnewwallet',
        action_type: DeveloperActionType.GITHUB_CONTRIBUTION,
        shards_earned: '500',
        verified: false,
        verified_at: null,
        verified_by: null,
        distributed_at: null,
      };

      mockBaseRepository.create.mockResolvedValue(dbContribution);

      const result = await repository.create(newContribution);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: newContribution.id,
        wallet_address: '0xnewwallet',
        season_id: 1,
        action_type: DeveloperActionType.GITHUB_CONTRIBUTION,
        action_details: { repositoryUrl: 'https://github.com/test/repo' },
        shards_earned: '500',
        verified: false,
        verified_at: null,
        verified_by: null,
        distributed_at: null,
      });
      expect(result).toBeInstanceOf(DeveloperContributionEntity);
      expect(result.shardsEarned).toBe(500);
    });
  });

  describe('update', () => {
    it('should update an existing contribution', async () => {
      const contributionToUpdate = new DeveloperContributionEntity(
        '1',
        '0x1234567890abcdef1234567890abcdef12345678',
        1,
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
        mockDbContribution.action_details as any,
        1000,
        true,
        new Date('2024-01-10'),
        'admin',
        new Date('2024-01-20'), // Updated distribution date
        new Date('2024-01-05'),
        new Date(),
      );

      const updatedDbContribution = {
        ...mockDbContribution,
        distributed_at: new Date('2024-01-20'),
      };

      mockBaseRepository.update.mockResolvedValue(updatedDbContribution);

      const result = await repository.update(contributionToUpdate);

      expect(mockBaseRepository.update).toHaveBeenCalledWith('1', {
        id: '1',
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        season_id: 1,
        action_type: DeveloperActionType.SMART_CONTRACT_DEPLOY,
        action_details: mockDbContribution.action_details,
        shards_earned: '1000',
        verified: true,
        verified_at: contributionToUpdate.verifiedAt,
        verified_by: 'admin',
        distributed_at: contributionToUpdate.distributedAt,
      });
      expect(result.distributedAt).toEqual(new Date('2024-01-20'));
    });

    it('should throw error when contribution not found', async () => {
      const contributionToUpdate = new DeveloperContributionEntity(
        '999',
        '0xwallet',
        1,
        DeveloperActionType.OTHER,
        {},
        100,
        false,
        null,
        null,
        null,
        new Date(),
        new Date(),
      );

      mockBaseRepository.update.mockResolvedValue(null);

      await expect(repository.update(contributionToUpdate)).rejects.toThrow(
        'DeveloperContribution with id 999 not found',
      );
    });
  });

  describe('createBatch', () => {
    it('should create multiple contributions', async () => {
      const contributions = [
        DeveloperContributionEntity.create({
          walletAddress: '0xwallet1',
          seasonId: 1,
          actionType: DeveloperActionType.BUG_REPORT,
          actionDetails: { issueUrl: 'https://github.com/test/issues/1' },
          shardsEarned: 100,
        }),
        DeveloperContributionEntity.create({
          walletAddress: '0xwallet2',
          seasonId: 1,
          actionType: DeveloperActionType.DOCUMENTATION,
          actionDetails: { description: 'Updated docs' },
          shardsEarned: 200,
        }),
      ];

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.insertInto.mockReturnValue(mockInsertInto);

      await repository.createBatch(contributions);

      expect(mockDb.insertInto).toHaveBeenCalledWith('developer_contributions');
      expect(mockInsertInto.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            wallet_address: '0xwallet1',
            action_type: DeveloperActionType.BUG_REPORT,
            shards_earned: '100',
          }),
          expect.objectContaining({
            wallet_address: '0xwallet2',
            action_type: DeveloperActionType.DOCUMENTATION,
            shards_earned: '200',
          }),
        ]),
      );
    });

    it('should handle empty batch', async () => {
      await repository.createBatch([]);

      expect(mockDb.insertInto).not.toHaveBeenCalled();
    });
  });

  describe('getTotalShardsByWallet', () => {
    it('should get total shards for wallet', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: '2500.50' }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalShardsByWallet(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('season_id', '=', 1);
      expect(result).toBe(2500.5);
    });

    it('should get total distributed shards only', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: '1500' }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalShardsByWallet(
        '0xwallet',
        1,
        true,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'distributed_at',
        'is not',
        null,
      );
      expect(result).toBe(1500);
    });

    it('should return 0 when no contributions', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ total: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalShardsByWallet(
        '0xnonexistent',
        1,
      );

      expect(result).toBe(0);
    });
  });

  describe('getStatsBySeason', () => {
    it('should get complete stats by season', async () => {
      const mockSelectFrom1 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ count: 100, total_shards: '50000' }),
      };

      const mockSelectFrom2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 80 }),
      };

      const mockSelectFrom3 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ count: 60 }),
      };

      const mockSelectFrom4 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([
          {
            action_type: DeveloperActionType.SMART_CONTRACT_DEPLOY,
            count: 30,
            total_shards: '15000',
          },
          {
            action_type: DeveloperActionType.GITHUB_CONTRIBUTION,
            count: 50,
            total_shards: '25000',
          },
          {
            action_type: DeveloperActionType.BUG_REPORT,
            count: 20,
            total_shards: '10000',
          },
        ]),
      };

      mockDb.selectFrom
        .mockReturnValueOnce(mockSelectFrom1)
        .mockReturnValueOnce(mockSelectFrom2)
        .mockReturnValueOnce(mockSelectFrom3)
        .mockReturnValueOnce(mockSelectFrom4);

      const result = await repository.getStatsBySeason(1);

      expect(result.totalContributions).toBe(100);
      expect(result.verifiedContributions).toBe(80);
      expect(result.distributedContributions).toBe(60);
      expect(result.totalShardsEarned).toBe(50000);
      expect(
        result.byActionType[DeveloperActionType.SMART_CONTRACT_DEPLOY],
      ).toEqual({
        count: 30,
        totalShards: 15000,
      });
      expect(
        result.byActionType[DeveloperActionType.GITHUB_CONTRIBUTION],
      ).toEqual({
        count: 50,
        totalShards: 25000,
      });
    });
  });

  describe('checkDuplicateContribution', () => {
    it('should detect duplicate contribution with same action details', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([{ id: '1' }]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      mockBaseRepository.findById.mockResolvedValue(mockDbContribution);

      const result = await repository.checkDuplicateContribution(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
        { contractAddress: '0xcontract' }, // Same contract address
        1,
      );

      expect(result).toBe(true);
    });

    it('should not detect duplicate when action details differ', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([{ id: '1' }]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      mockBaseRepository.findById.mockResolvedValue(mockDbContribution);

      const result = await repository.checkDuplicateContribution(
        '0x1234567890abcdef1234567890abcdef12345678',
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
        { contractAddress: '0xdifferentcontract' }, // Different contract
        1,
      );

      expect(result).toBe(false);
    });

    it('should not detect duplicate when no existing contributions', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.checkDuplicateContribution(
        '0xnewwallet',
        DeveloperActionType.DOCUMENTATION,
        { description: 'New docs' },
        1,
      );

      expect(result).toBe(false);
    });

    it('should detect duplicate by transaction hash', async () => {
      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([{ id: '1' }]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      mockBaseRepository.findById.mockResolvedValue(mockDbContribution);

      const result = await repository.checkDuplicateContribution(
        '0x1234567890abcdef1234567890abcdef12345678',
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
        { transactionHash: '0xtx' }, // Same transaction hash
        1,
      );

      expect(result).toBe(true);
    });
  });
});
