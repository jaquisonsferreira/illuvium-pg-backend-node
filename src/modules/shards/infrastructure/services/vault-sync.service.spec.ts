import { Test, TestingModule } from '@nestjs/testing';
import { VaultSyncService } from './vault-sync.service';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import { SubgraphService } from './subgraph.service';
import { AlchemyShardsService } from './alchemy-shards.service';
import { CoinGeckoService } from './coingecko.service';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { SHARD_QUEUES } from '../../constants';

describe('VaultSyncService', () => {
  let service: VaultSyncService;
  let vaultSyncQueue: jest.Mocked<Queue>;
  let subgraphService: jest.Mocked<SubgraphService>;
  let coinGeckoService: jest.Mocked<CoinGeckoService>;
  let vaultPositionRepository: jest.Mocked<IVaultPositionRepository>;

  const mockVaultData = {
    id: '0xvault123',
    totalAssets: '1000000000000000000000',
    totalSupply: '900000000000000000000',
    asset: {
      id: '0xasset123',
      symbol: 'ETH',
      decimals: 18,
    },
  };

  const mockVaultPosition = {
    id: '0xposition123',
    vault: mockVaultData,
    account: '0xwallet123',
    shares: '100000000000000000000',
    lastUpdated: '1642000000',
  };

  const mockVaultPositionEntity = new VaultPositionEntity(
    '1',
    '0xwallet123',
    '0xvault123',
    'ETH',
    'base',
    '111111111111111111111',
    '100000000000000000000',
    3333.33,
    4, // Default lock weeks
    new Date('2024-01-15'),
    12345678,
    new Date('2024-01-15'),
  );

  beforeEach(async () => {
    const mockVaultSyncQueue = {
      add: jest.fn(),
    };

    const mockSubgraphService = {
      getEligibleVaults: jest.fn(),
      getBlockByTimestamp: jest.fn(),
      getVaultData: jest.fn(),
      getVaultPositions: jest.fn(),
      getUserVaultPositions: jest.fn(),
    };

    const mockAlchemyShardsService = {
      getEligibleVaults: jest.fn(),
      getBlockByTimestamp: jest.fn(),
      getVaultData: jest.fn(),
      getVaultPositions: jest.fn(),
      getUserVaultPositions: jest.fn(),
    };

    const mockCoinGeckoService = {
      getTokenPrice: jest.fn(),
      getMultipleTokenPrices: jest.fn(),
    };

    const mockVaultPositionRepository = {
      deleteByDateAndChain: jest.fn(),
      createBatch: jest.fn(),
      upsert: jest.fn(),
      findByWalletAndDate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultSyncService,
        {
          provide: getQueueToken(SHARD_QUEUES.VAULT_SYNC),
          useValue: mockVaultSyncQueue,
        },
        {
          provide: SubgraphService,
          useValue: mockSubgraphService,
        },
        {
          provide: AlchemyShardsService,
          useValue: mockAlchemyShardsService,
        },
        {
          provide: CoinGeckoService,
          useValue: mockCoinGeckoService,
        },
        {
          provide: 'IVaultPositionRepository',
          useValue: mockVaultPositionRepository,
        },
      ],
    }).compile();

    service = module.get<VaultSyncService>(VaultSyncService);
    vaultSyncQueue = module.get(getQueueToken(SHARD_QUEUES.VAULT_SYNC));
    subgraphService = module.get(SubgraphService);
    module.get(AlchemyShardsService);
    coinGeckoService = module.get(CoinGeckoService);
    vaultPositionRepository = module.get('IVaultPositionRepository');
  });

  describe('scheduleDailyVaultSync', () => {
    it('should schedule sync for all supported chains', async () => {
      subgraphService.getEligibleVaults.mockResolvedValue([
        '0xvault1',
        '0xvault2',
      ]);
      vaultPositionRepository.deleteByDateAndChain.mockResolvedValue(5);
      vaultSyncQueue.add.mockResolvedValue({} as any);

      const syncChainVaultsSpy = jest
        .spyOn(service, 'syncChainVaults')
        .mockResolvedValue();

      await service.scheduleDailyVaultSync();

      expect(syncChainVaultsSpy).toHaveBeenCalledTimes(4); // base, ethereum, arbitrum, optimism
      expect(syncChainVaultsSpy).toHaveBeenCalledWith('base', expect.any(Date));
      expect(syncChainVaultsSpy).toHaveBeenCalledWith(
        'ethereum',
        expect.any(Date),
      );
      expect(syncChainVaultsSpy).toHaveBeenCalledWith(
        'arbitrum',
        expect.any(Date),
      );
      expect(syncChainVaultsSpy).toHaveBeenCalledWith(
        'optimism',
        expect.any(Date),
      );
    });
  });

  describe('syncChainVaults', () => {
    const snapshotDate = new Date('2024-01-15T00:00:00.000Z');

    it('should sync vaults for a chain', async () => {
      const eligibleVaults = ['0xvault1', '0xvault2'];
      subgraphService.getEligibleVaults.mockResolvedValue(eligibleVaults);
      vaultPositionRepository.deleteByDateAndChain.mockResolvedValue(5);
      vaultSyncQueue.add.mockResolvedValue({} as any);

      await service.syncChainVaults('base', snapshotDate);

      expect(subgraphService.getEligibleVaults).toHaveBeenCalledWith('base');
      expect(vaultPositionRepository.deleteByDateAndChain).toHaveBeenCalledWith(
        snapshotDate,
        'base',
      );
      expect(vaultSyncQueue.add).toHaveBeenCalledTimes(2);
      expect(vaultSyncQueue.add).toHaveBeenCalledWith(
        'sync-vault',
        {
          chain: 'base',
          vaultAddress: '0xvault1',
          snapshotDate,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    });

    it('should handle no eligible vaults', async () => {
      subgraphService.getEligibleVaults.mockResolvedValue([]);

      await service.syncChainVaults('base', snapshotDate);

      expect(
        vaultPositionRepository.deleteByDateAndChain,
      ).not.toHaveBeenCalled();
      expect(vaultSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      subgraphService.getEligibleVaults.mockRejectedValue(
        new Error('Subgraph error'),
      );

      await expect(
        service.syncChainVaults('base', snapshotDate),
      ).rejects.toThrow('Subgraph error');
    });
  });

  describe('processVaultSync', () => {
    const job = {
      chain: 'base',
      vaultAddress: '0xvault123',
      snapshotDate: new Date('2024-01-15T00:00:00.000Z'),
    };

    it('should process vault sync job successfully', async () => {
      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getVaultData.mockResolvedValue(mockVaultData);
      subgraphService.getVaultPositions.mockResolvedValue([mockVaultPosition]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);
      vaultPositionRepository.createBatch.mockResolvedValue(undefined);

      await service.processVaultSync(job);

      expect(subgraphService.getBlockByTimestamp).toHaveBeenCalledWith(
        'base',
        expect.any(Number),
      );
      expect(subgraphService.getVaultData).toHaveBeenCalledWith(
        '0xvault123',
        'base',
      );
      expect(subgraphService.getVaultPositions).toHaveBeenCalledWith(
        '0xvault123',
        'base',
        12345678,
      );
      expect(coinGeckoService.getTokenPrice).toHaveBeenCalledWith('ETH');
      expect(vaultPositionRepository.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            walletAddress: '0xwallet123',
            vaultAddress: '0xvault123',
            assetSymbol: 'ETH',
            chain: 'base',
          }),
        ]),
      );
    });

    it('should use provided block number', async () => {
      const jobWithBlock = { ...job, blockNumber: 987654321 };
      subgraphService.getVaultData.mockResolvedValue(mockVaultData);
      subgraphService.getVaultPositions.mockResolvedValue([mockVaultPosition]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);
      vaultPositionRepository.createBatch.mockResolvedValue(undefined);

      await service.processVaultSync(jobWithBlock);

      expect(subgraphService.getBlockByTimestamp).not.toHaveBeenCalled();
      expect(subgraphService.getVaultPositions).toHaveBeenCalledWith(
        '0xvault123',
        'base',
        987654321,
      );
    });

    it('should handle no vault data', async () => {
      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getVaultData.mockResolvedValue(null);
      subgraphService.getVaultPositions.mockResolvedValue([]);

      await service.processVaultSync(job);

      expect(vaultPositionRepository.createBatch).not.toHaveBeenCalled();
    });

    it('should handle zero total supply', async () => {
      const zeroSupplyVault = {
        ...mockVaultData,
        totalSupply: '0',
      };
      const zeroSupplyPosition = {
        ...mockVaultPosition,
        vault: zeroSupplyVault,
      };

      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getVaultData.mockResolvedValue(zeroSupplyVault);
      subgraphService.getVaultPositions.mockResolvedValue([zeroSupplyPosition]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);

      await service.processVaultSync(job);

      expect(vaultPositionRepository.createBatch).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      subgraphService.getBlockByTimestamp.mockRejectedValue(
        new Error('Block error'),
      );

      await expect(service.processVaultSync(job)).rejects.toThrow(
        'Block error',
      );
    });
  });

  describe('syncWalletPositions', () => {
    const walletAddress = '0xwallet123';
    const seasonId = 1;
    const chain = 'base';
    const snapshotDate = new Date('2024-01-15T00:00:00.000Z');

    it('should sync wallet positions successfully', async () => {
      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getUserVaultPositions.mockResolvedValue([
        mockVaultPosition,
      ]);
      coinGeckoService.getMultipleTokenPrices.mockResolvedValue(
        new Map([['ETH', 3000]]),
      );
      vaultPositionRepository.upsert.mockResolvedValue(mockVaultPositionEntity);

      const result = await service.syncWalletPositions(
        walletAddress,
        seasonId,
        chain,
        snapshotDate,
      );

      expect(subgraphService.getBlockByTimestamp).toHaveBeenCalledWith(
        chain,
        expect.any(Number),
      );
      expect(subgraphService.getUserVaultPositions).toHaveBeenCalledWith(
        walletAddress,
        chain,
        12345678,
      );
      expect(coinGeckoService.getMultipleTokenPrices).toHaveBeenCalledWith([
        'ETH',
      ]);
      expect(vaultPositionRepository.upsert).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        walletAddress,
        vaultAddress: mockVaultData.id,
        assetSymbol: 'ETH',
        chain,
      });
    });

    it('should handle zero total supply in wallet positions', async () => {
      const zeroSupplyPosition = {
        ...mockVaultPosition,
        vault: { ...mockVaultData, totalSupply: '0' },
      };

      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getUserVaultPositions.mockResolvedValue([
        zeroSupplyPosition,
      ]);
      coinGeckoService.getMultipleTokenPrices.mockResolvedValue(
        new Map([['ETH', 3000]]),
      );

      const result = await service.syncWalletPositions(
        walletAddress,
        seasonId,
        chain,
        snapshotDate,
      );

      expect(result).toHaveLength(0);
      expect(vaultPositionRepository.upsert).not.toHaveBeenCalled();
    });

    it('should handle empty positions', async () => {
      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getUserVaultPositions.mockResolvedValue([]);
      coinGeckoService.getMultipleTokenPrices.mockResolvedValue(new Map());

      const result = await service.syncWalletPositions(
        walletAddress,
        seasonId,
        chain,
        snapshotDate,
      );

      expect(result).toHaveLength(0);
      expect(vaultPositionRepository.upsert).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      subgraphService.getBlockByTimestamp.mockRejectedValue(
        new Error('Block error'),
      );

      await expect(
        service.syncWalletPositions(
          walletAddress,
          seasonId,
          chain,
          snapshotDate,
        ),
      ).rejects.toThrow('Block error');
    });
  });

  describe('getHistoricalVaultValue', () => {
    it('should return vault value for specific date', async () => {
      const date = new Date('2024-01-15');
      const positions = [mockVaultPositionEntity];
      vaultPositionRepository.findByWalletAndDate.mockResolvedValue(positions);

      const result = await service.getHistoricalVaultValue(
        '0xwallet123',
        '0xvault123',
        date,
      );

      expect(vaultPositionRepository.findByWalletAndDate).toHaveBeenCalledWith(
        '0xwallet123',
        date,
      );
      expect(result).toBe(3333.33);
    });

    it('should return 0 for non-existent vault', async () => {
      vaultPositionRepository.findByWalletAndDate.mockResolvedValue([]);

      const result = await service.getHistoricalVaultValue(
        '0xwallet123',
        '0xnonexistent',
        new Date(),
      );

      expect(result).toBe(0);
    });

    it('should handle case insensitive vault address', async () => {
      const positions = [mockVaultPositionEntity];
      vaultPositionRepository.findByWalletAndDate.mockResolvedValue(positions);

      const result = await service.getHistoricalVaultValue(
        '0xwallet123',
        '0xVAULT123', // uppercase
        new Date('2024-01-15'),
      );

      expect(result).toBe(3333.33);
    });
  });

  describe('getTotalVaultValue', () => {
    it('should return total vault value for chain', async () => {
      const positions = [
        mockVaultPositionEntity,
        new VaultPositionEntity(
          '2',
          '0xwallet123',
          '0xvault456',
          'USDC',
          'base',
          '1000000000',
          '1000000000',
          1000,
          4, // Default lock weeks
          new Date('2024-01-15'),
          12345678,
          new Date('2024-01-15'),
        ),
        new VaultPositionEntity(
          '3',
          '0xwallet123',
          '0xvault789',
          'DAI',
          'ethereum', // different chain
          '500000000000000000000',
          '500000000000000000000',
          500,
          4, // Default lock weeks
          new Date('2024-01-15'),
          12345678,
          new Date('2024-01-15'),
        ),
      ];

      vaultPositionRepository.findByWalletAndDate.mockResolvedValue(positions);

      const result = await service.getTotalVaultValue(
        '0xwallet123',
        'base',
        new Date('2024-01-15'),
      );

      expect(result).toBe(4333.33); // 3333.33 + 1000
    });

    it('should return 0 for no positions', async () => {
      vaultPositionRepository.findByWalletAndDate.mockResolvedValue([]);

      const result = await service.getTotalVaultValue(
        '0xwallet123',
        'base',
        new Date(),
      );

      expect(result).toBe(0);
    });
  });

  describe('getVaultPosition', () => {
    it('should return current vault position', async () => {
      subgraphService.getUserVaultPositions.mockResolvedValue([
        mockVaultPosition,
      ]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);

      const result = await service.getVaultPosition(
        '0xwallet123',
        '0xvault123',
        'base',
        12345678,
      );

      expect(subgraphService.getUserVaultPositions).toHaveBeenCalledWith(
        '0xwallet123',
        'base',
        12345678,
      );
      expect(coinGeckoService.getTokenPrice).toHaveBeenCalledWith('ETH');
      expect(result).not.toBeNull();
      expect(result?.walletAddress).toBe('0xwallet123');
      expect(result?.vaultAddress).toBe('0xvault123');
      expect(result?.assetSymbol).toBe('ETH');
      expect(result?.chain).toBe('base');
    });

    it('should return null for non-existent position', async () => {
      subgraphService.getUserVaultPositions.mockResolvedValue([]);

      const result = await service.getVaultPosition(
        '0xwallet123',
        '0xnonexistent',
        'base',
      );

      expect(result).toBeNull();
    });

    it('should return null for zero total supply', async () => {
      const zeroSupplyPosition = {
        ...mockVaultPosition,
        vault: { ...mockVaultData, totalSupply: '0' },
      };
      subgraphService.getUserVaultPositions.mockResolvedValue([
        zeroSupplyPosition,
      ]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);

      const result = await service.getVaultPosition(
        '0xwallet123',
        '0xvault123',
        'base',
      );

      expect(result).toBeNull();
    });

    it('should handle case insensitive vault address matching', async () => {
      const upperCasePosition = {
        ...mockVaultPosition,
        vault: { ...mockVaultData, id: '0xVAULT123' },
      };
      subgraphService.getUserVaultPositions.mockResolvedValue([
        upperCasePosition,
      ]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);

      const result = await service.getVaultPosition(
        '0xwallet123',
        '0xvault123', // lowercase
        'base',
      );

      expect(result).not.toBeNull();
      expect(result?.vaultAddress).toBe('0xvault123');
    });

    it('should use blockNumber 0 when not provided', async () => {
      subgraphService.getUserVaultPositions.mockResolvedValue([
        mockVaultPosition,
      ]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);

      const result = await service.getVaultPosition(
        '0xwallet123',
        '0xvault123',
        'base',
      );

      expect(result?.blockNumber).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle BigInt calculations correctly', async () => {
      const job = {
        chain: 'base',
        vaultAddress: '0xvault123',
        snapshotDate: new Date('2024-01-15T00:00:00.000Z'),
      };

      const largeVaultData = {
        ...mockVaultData,
        totalAssets: '999999999999999999999999999999',
        totalSupply: '999999999999999999999999999999',
      };
      const largePosition = {
        ...mockVaultPosition,
        shares: '123456789123456789123456789',
        vault: largeVaultData,
      };

      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getVaultData.mockResolvedValue(largeVaultData);
      subgraphService.getVaultPositions.mockResolvedValue([largePosition]);
      coinGeckoService.getTokenPrice.mockResolvedValue(3000);
      vaultPositionRepository.createBatch.mockResolvedValue(undefined);

      await service.processVaultSync(job);

      expect(vaultPositionRepository.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            balance: '123456789123456789123456789',
            shares: '123456789123456789123456789',
          }),
        ]),
      );
    });

    it('should handle missing token prices', async () => {
      subgraphService.getBlockByTimestamp.mockResolvedValue(12345678);
      subgraphService.getUserVaultPositions.mockResolvedValue([
        mockVaultPosition,
      ]);
      coinGeckoService.getMultipleTokenPrices.mockResolvedValue(new Map()); // empty prices
      vaultPositionRepository.upsert.mockResolvedValue(mockVaultPositionEntity);

      const result = await service.syncWalletPositions(
        '0xwallet123',
        1,
        'base',
        new Date('2024-01-15'),
      );

      expect(result[0].usdValue).toBe(0); // Should default to 0 when price not found
    });
  });
});
