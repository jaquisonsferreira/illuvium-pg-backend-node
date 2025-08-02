import { Test, TestingModule } from '@nestjs/testing';
import { VaultPositionRepository } from './vault-position.repository';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import {
  VaultPosition as DbVaultPosition,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('VaultPositionRepository', () => {
  let repository: VaultPositionRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbPosition: DbVaultPosition = {
    id: '1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    vault_address: '0xvault1234567890abcdef1234567890abcdef1234',
    asset_symbol: 'USDC',
    chain: 'base',
    balance: '1000000000', // 1000 USDC with 6 decimals
    shares: '1000000000',
    usd_value: '1000',
    lock_weeks: 4, // Default lock weeks
    snapshot_date: new Date('2024-01-15T00:00:00.000Z'),
    block_number: '12345678',
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
        VaultPositionRepository,
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

    repository = module.get<VaultPositionRepository>(VaultPositionRepository);
  });

  describe('findById', () => {
    it('should find position by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbPosition);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(VaultPositionEntity);
      expect(result?.id).toBe('1');
      expect(result?.walletAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.usdValue).toBe(1000);
    });

    it('should return null when position not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByWalletAndDate', () => {
    it('should find positions by wallet and date', async () => {
      const testDate = new Date('2024-01-15T12:30:00.000Z');
      const normalizedDate = new Date('2024-01-15T00:00:00.000Z');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndDate(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
        testDate,
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('vault_positions');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '=',
        normalizedDate,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(VaultPositionEntity);
    });
  });

  describe('findByWalletAndSeason', () => {
    it('should find positions by wallet and season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletAndSeason(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'snapshot_date',
        'desc',
      );
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });
  });

  describe('findByWalletVaultAndSeason', () => {
    it('should find position by wallet, vault and season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbPosition),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletVaultAndSeason(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        '0xVAULT1234567890ABCDEF1234567890ABCDEF1234', // uppercase to test toLowerCase
        1,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'vault_address',
        '=',
        '0xvault1234567890abcdef1234567890abcdef1234', // should be lowercase
      );
      expect(result).toBeInstanceOf(VaultPositionEntity);
    });

    it('should return null when no position found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByWalletVaultAndSeason(
        '0xnonexistent',
        '0xvault',
        1,
      );

      expect(result).toBeNull();
    });
  });

  describe('findActiveBySeason', () => {
    it('should find active positions by season', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findActiveBySeason(1);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('usd_value', '>', '0');
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'snapshot_date',
        'desc',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findStalePositions', () => {
    it('should find stale positions', async () => {
      const maxAge = new Date('2024-01-01');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findStalePositions(maxAge);

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '<',
        maxAge,
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by chain when provided', async () => {
      const maxAge = new Date('2024-01-01');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findStalePositions(maxAge, 'base');

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '<',
        maxAge,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith('chain', '=', 'base');
      expect(result).toHaveLength(1);
    });
  });

  describe('findByVaultAndDate', () => {
    it('should find positions by vault and date', async () => {
      const testDate = new Date('2024-01-15T12:00:00.000Z');
      const normalizedDate = new Date('2024-01-15T00:00:00.000Z');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByVaultAndDate(
        '0xVAULT1234567890ABCDEF1234567890ABCDEF1234',
        testDate,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'vault_address',
        '=',
        '0xvault1234567890abcdef1234567890abcdef1234',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '=',
        normalizedDate,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findLatestByWallet', () => {
    it('should find latest positions by wallet', async () => {
      const latestDate = new Date('2024-01-15');

      const mockSelectFrom = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ latest_date: latestDate }),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLatestByWallet(
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'wallet_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '=',
        latestDate,
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by chain when provided', async () => {
      const latestDate = new Date('2024-01-15');

      const mockSelectFrom = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ latest_date: latestDate }),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLatestByWallet('0xwallet', 'base');

      expect(mockSelectFrom.where).toHaveBeenCalledWith('chain', '=', 'base');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no positions found', async () => {
      const mockSelectFrom = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ latest_date: null }),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLatestByWallet('0xnonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a new vault position', async () => {
      const newPosition = VaultPositionEntity.create({
        walletAddress: '0xnewwallet',
        vaultAddress: '0xnewvault',
        assetSymbol: 'WETH',
        chain: 'base',
        balance: '2000000000000000000', // 2 WETH
        shares: '2000000000000000000',
        usdValue: 5000,
        lockWeeks: 4, // Default lock weeks
        snapshotDate: new Date('2024-01-20'),
        blockNumber: 12345679,
      });

      const dbPosition = {
        ...mockDbPosition,
        id: newPosition.id,
        wallet_address: '0xnewwallet',
        vault_address: '0xnewvault',
        asset_symbol: 'WETH',
        usd_value: '5000',
      };

      mockBaseRepository.create.mockResolvedValue(dbPosition);

      const result = await repository.create(newPosition);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: newPosition.id,
        wallet_address: '0xnewwallet',
        vault_address: '0xnewvault',
        asset_symbol: 'WETH',
        chain: 'base',
        balance: '2000000000000000000',
        shares: '2000000000000000000',
        usd_value: '5000',
        lock_weeks: 4,
        snapshot_date: newPosition.snapshotDate,
        block_number: '12345679',
      });
      expect(result).toBeInstanceOf(VaultPositionEntity);
      expect(result.usdValue).toBe(5000);
    });
  });

  describe('createBatch', () => {
    it('should create multiple positions', async () => {
      const positions = [
        VaultPositionEntity.create({
          walletAddress: '0xwallet1',
          vaultAddress: '0xvault1',
          assetSymbol: 'USDC',
          chain: 'base',
          balance: '1000000',
          shares: '1000000',
          usdValue: 1,
          lockWeeks: 4, // Default lock weeks
          snapshotDate: new Date('2024-01-20'),
          blockNumber: 12345680,
        }),
        VaultPositionEntity.create({
          walletAddress: '0xwallet2',
          vaultAddress: '0xvault2',
          assetSymbol: 'WETH',
          chain: 'base',
          balance: '1000000000000000000',
          shares: '1000000000000000000',
          usdValue: 2500,
          lockWeeks: 4, // Default lock weeks
          snapshotDate: new Date('2024-01-20'),
          blockNumber: 12345680,
        }),
      ];

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.insertInto.mockReturnValue(mockInsertInto);

      await repository.createBatch(positions);

      expect(mockDb.insertInto).toHaveBeenCalledWith('vault_positions');
      expect(mockInsertInto.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            wallet_address: '0xwallet1',
            asset_symbol: 'USDC',
            usd_value: '1',
          }),
          expect.objectContaining({
            wallet_address: '0xwallet2',
            asset_symbol: 'WETH',
            usd_value: '2500',
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
    it('should update existing position', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbPosition),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const positionToUpsert = VaultPositionEntity.create({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        vaultAddress: '0xvault1234567890abcdef1234567890abcdef1234',
        assetSymbol: 'USDC',
        chain: 'base',
        balance: '2000000000', // Updated balance
        shares: '2000000000',
        usdValue: 2000,
        lockWeeks: 4, // Default lock weeks
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 12345679,
      });

      const mockUpdateTable = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.updateTable.mockReturnValue(mockUpdateTable);

      mockBaseRepository.findById.mockResolvedValue({
        ...mockDbPosition,
        balance: '2000000000',
        usd_value: '2000',
      });

      const result = await repository.upsert(positionToUpsert);

      expect(mockUpdateTable.set).toHaveBeenCalled();
      expect(mockUpdateTable.where).toHaveBeenCalledWith('id', '=', '1');
      expect(result.usdValue).toBe(2000);
    });

    it('should create new position when not exists', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const positionToUpsert = VaultPositionEntity.create({
        walletAddress: '0xnewwallet',
        vaultAddress: '0xnewvault',
        assetSymbol: 'DAI',
        chain: 'base',
        balance: '1000000000000000000000',
        shares: '1000000000000000000000',
        usdValue: 1000,
        lockWeeks: 4, // Default lock weeks
        snapshotDate: new Date('2024-01-20'),
        blockNumber: 12345680,
      });

      mockBaseRepository.create.mockResolvedValue({
        ...mockDbPosition,
        id: positionToUpsert.id,
        wallet_address: '0xnewwallet',
        vault_address: '0xnewvault',
        asset_symbol: 'DAI',
      });

      const result = await repository.upsert(positionToUpsert);

      expect(mockBaseRepository.create).toHaveBeenCalled();
      expect(result.assetSymbol).toBe('DAI');
    });
  });

  describe('update', () => {
    it('should update an existing position', async () => {
      const positionToUpdate = new VaultPositionEntity(
        '1',
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xvault1234567890abcdef1234567890abcdef1234',
        'USDC',
        'base',
        '3000000000', // Updated balance
        '3000000000',
        3000,
        4, // Default lock weeks
        new Date('2024-01-15'),
        12345678,
        new Date(),
      );

      const mockUpdateTable = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.updateTable.mockReturnValue(mockUpdateTable);

      mockBaseRepository.findById.mockResolvedValue({
        ...mockDbPosition,
        balance: '3000000000',
        usd_value: '3000',
      });

      const result = await repository.update(positionToUpdate);

      expect(mockUpdateTable.set).toHaveBeenCalled();
      expect(mockUpdateTable.where).toHaveBeenCalledWith('id', '=', '1');
      expect(result.usdValue).toBe(3000);
    });

    it('should throw error when position not found', async () => {
      const positionToUpdate = new VaultPositionEntity(
        '999',
        '0xwallet',
        '0xvault',
        'ETH',
        'base',
        '0',
        '0',
        0,
        4, // Default lock weeks
        new Date(),
        0,
        new Date(),
      );

      const mockUpdateTable = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.updateTable.mockReturnValue(mockUpdateTable);

      mockBaseRepository.findById.mockResolvedValue(null);

      await expect(repository.update(positionToUpdate)).rejects.toThrow(
        'Vault position with id 999 not found',
      );
    });
  });

  describe('delete', () => {
    it('should delete a position', async () => {
      const mockDeleteFrom = {
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.deleteFrom.mockReturnValue(mockDeleteFrom);

      await repository.delete('1');

      expect(mockDb.deleteFrom).toHaveBeenCalledWith('vault_positions');
      expect(mockDeleteFrom.where).toHaveBeenCalledWith('id', '=', '1');
    });
  });

  describe('deleteByDateAndChain', () => {
    it('should delete positions by date and chain', async () => {
      const testDate = new Date('2024-01-15T12:00:00.000Z');
      const normalizedDate = new Date('2024-01-15T00:00:00.000Z');

      const mockDeleteFrom = {
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ numDeletedRows: 5n }),
      };
      mockDb.deleteFrom.mockReturnValue(mockDeleteFrom);

      const result = await repository.deleteByDateAndChain(testDate, 'base');

      expect(mockDeleteFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '=',
        normalizedDate,
      );
      expect(mockDeleteFrom.where).toHaveBeenCalledWith('chain', '=', 'base');
      expect(result).toBe(5);
    });
  });

  describe('getTotalValueLocked', () => {
    it('should calculate total value locked by chain and date', async () => {
      const testDate = new Date('2024-01-15');
      const normalizedDate = new Date('2024-01-15T00:00:00.000Z');

      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([
          { asset_symbol: 'USDC', total_value: '5000000' },
          { asset_symbol: 'WETH', total_value: '3000000' },
          { asset_symbol: 'DAI', total_value: '2000000' },
        ]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTotalValueLocked('base', testDate);

      expect(mockSelectFrom.where).toHaveBeenCalledWith('chain', '=', 'base');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'snapshot_date',
        '=',
        normalizedDate,
      );
      expect(mockSelectFrom.groupBy).toHaveBeenCalledWith('asset_symbol');
      expect(result.totalUsdValue).toBe(10000000);
      expect(result.byAsset).toEqual({
        USDC: 5000000,
        WETH: 3000000,
        DAI: 2000000,
      });
    });
  });

  describe('getUniqueWalletCount', () => {
    it('should get unique wallet count', async () => {
      const testDate = new Date('2024-01-15');

      const mockSelectFrom = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        execute: jest
          .fn()
          .mockResolvedValue([
            { wallet_address: '0xwallet1' },
            { wallet_address: '0xwallet2' },
            { wallet_address: '0xwallet3' },
          ]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getUniqueWalletCount('base', testDate);

      expect(mockSelectFrom.select).toHaveBeenCalledWith('wallet_address');
      expect(mockSelectFrom.distinct).toHaveBeenCalled();
      expect(result).toBe(3);
    });
  });

  describe('getTopPositionsByValue', () => {
    it('should get top positions by value', async () => {
      const testDate = new Date('2024-01-15');

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbPosition]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.getTopPositionsByValue(
        'base',
        testDate,
        10,
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith('chain', '=', 'base');
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('usd_value', 'desc');
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(VaultPositionEntity);
    });
  });
});
