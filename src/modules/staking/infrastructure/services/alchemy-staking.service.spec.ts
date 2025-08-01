import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlchemyStakingService } from './alchemy-staking.service';
import { Alchemy, Network } from 'alchemy-sdk';
import { ChainType } from '../../domain/types/staking-types';

jest.mock('alchemy-sdk');

describe('AlchemyStakingService', () => {
  let service: AlchemyStakingService;
  let configService: jest.Mocked<ConfigService>;
  let mockAlchemy: jest.Mocked<Alchemy>;

  beforeEach(async () => {
    const mockAlchemyCore = {
      getBlockNumber: jest.fn(),
      getBlock: jest.fn(),
      getTokenBalances: jest.fn(),
      getLogs: jest.fn(),
      getTransactionReceipt: jest.fn(),
    };

    mockAlchemy = {
      core: mockAlchemyCore,
      config: { url: 'https://base-sepolia.g.alchemy.com/v2/test' },
    } as any;

    Alchemy.mockImplementation(() => mockAlchemy);

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'ALCHEMY_API_KEY_BASE':
            return 'test-api-key-base';
          case 'ALCHEMY_API_KEY_OBELISK':
            return 'test-api-key-obelisk';
          case 'NODE_ENV':
            return 'test';
          case 'KNOWN_VAULT_ADDRESSES_BASE':
            return ['0x1234567890123456789012345678901234567890'];
          default:
            return defaultValue;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlchemyStakingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AlchemyStakingService>(AlchemyStakingService);
    configService = module.get(ConfigService);
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize Alchemy clients for supported chains', () => {
      expect(Alchemy).toHaveBeenCalledWith({
        apiKey: 'test-api-key-base',
        network: Network.BASE_SEPOLIA,
      });
    });

    it('should configure correct network based on environment', () => {
      expect(configService.get).toHaveBeenCalledWith('NODE_ENV');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status for Base chain', async () => {
      const mockBlockNumber = 8234567;
      const mockBlock = {
        timestamp: Math.floor(Date.now() / 1000),
        number: mockBlockNumber,
      };

      mockAlchemy.core.getBlockNumber.mockResolvedValue(mockBlockNumber);
      mockAlchemy.core.getBlock.mockResolvedValue(mockBlock);

      const result = await service.getSyncStatus(ChainType.BASE);

      expect(result).toEqual({
        chainHeadBlock: mockBlockNumber,
        latestBlock: mockBlockNumber,
        blocksBehind: 0,
        isHealthy: true,
        lastSyncTime: new Date(mockBlock.timestamp * 1000),
        isSyncing: false,
      });
    });

    it('should handle errors and throw appropriate message', async () => {
      mockAlchemy.core.getBlockNumber.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(service.getSyncStatus(ChainType.BASE)).rejects.toThrow(
        'Chain sync status unavailable for BASE',
      );
    });
  });

  describe('getUserPositions', () => {
    it('should return empty array when user has no positions', async () => {
      const mockParams = {
        userAddress: '0xuser123',
        chain: ChainType.BASE,
      };

      // Mock empty token balances
      mockAlchemy.core.getTokenBalances.mockResolvedValue({
        address: mockParams.userAddress,
        tokenBalances: [],
      });

      const result = await service.getUserPositions(mockParams);

      expect(result.data).toEqual([]);
      expect(result.metadata.source).toBe('alchemy');
    });

    it('should handle API errors gracefully', async () => {
      const mockParams = {
        userAddress: '0xuser123',
        chain: ChainType.BASE,
      };

      mockAlchemy.core.getTokenBalances.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      await expect(service.getUserPositions(mockParams)).rejects.toThrow(
        'Failed to fetch user positions from Alchemy',
      );
    });
  });

  describe('getTransactions', () => {
    it('should parse vault events correctly', async () => {
      const mockParams = {
        vaultAddress: '0xvault123',
        chain: ChainType.BASE,
        page: 1,
        limit: 10,
      };

      const mockLogs = [
        {
          address: '0xvault123',
          topics: [
            '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7', // Deposit event signature
            '0x000000000000000000000000user123', // caller
            '0x000000000000000000000000user123', // owner
          ],
          data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000016345785d8a0000', // assets and shares
          blockNumber: 8234567,
          transactionHash: '0xtxhash123',
        },
      ];

      const mockBlock = {
        timestamp: Math.floor(Date.now() / 1000),
      };

      mockAlchemy.core.getLogs.mockResolvedValue(mockLogs);
      mockAlchemy.core.getBlock.mockResolvedValue(mockBlock);
      mockAlchemy.core.getTransactionReceipt.mockResolvedValue({
        status: 1,
        blockNumber: 8234567,
      });

      const result = await service.getTransactions(mockParams);

      expect(result.data.data).toHaveLength(1);
      expect(result.data.pagination.page).toBe(1);
      expect(result.metadata.source).toBe('alchemy');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Alchemy is responsive', async () => {
      const mockBlockNumber = 8234567;
      mockAlchemy.core.getBlockNumber.mockResolvedValue(mockBlockNumber);

      const result = await service.healthCheck(ChainType.BASE);

      expect(result.isHealthy).toBe(true);
      expect(result.lastBlock).toBe(mockBlockNumber);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.indexingErrors).toEqual([]);
    });

    it('should return unhealthy status when Alchemy is not responsive', async () => {
      mockAlchemy.core.getBlockNumber.mockRejectedValue(
        new Error('Connection timeout'),
      );

      const result = await service.healthCheck(ChainType.BASE);

      expect(result.isHealthy).toBe(false);
      expect(result.lastBlock).toBe(0);
      expect(result.indexingErrors).toContain('Connection timeout');
    });
  });

  describe('getCurrentBlock', () => {
    it('should return current block number', async () => {
      const mockBlockNumber = 8234567;
      mockAlchemy.core.getBlockNumber.mockResolvedValue(mockBlockNumber);

      const result = await service.getCurrentBlock(ChainType.BASE);

      expect(result).toBe(mockBlockNumber);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported chain', async () => {
      expect(() =>
        service.getSyncStatus('UNSUPPORTED' as ChainType),
      ).rejects.toThrow();
    });

    it('should handle missing API keys gracefully', () => {
      const configServiceWithoutKeys = {
        get: jest.fn(() => ''),
      };

      expect(() => {
        new AlchemyStakingService(configServiceWithoutKeys as any);
      }).not.toThrow();
    });

    it('should log warnings for missing API keys', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      const configServiceWithoutKeys = {
        get: jest.fn(() => ''),
      };

      new AlchemyStakingService(configServiceWithoutKeys as any);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Alchemy API key provided'),
      );
    });
  });

  describe('Not Implemented Methods', () => {
    const notImplementedMethods = [
      'getLPTokenData',
      'getMultipleLPTokensData',
      'getVaultAnalytics',
      'getVaultTVLHistory',
      'getEcosystemStats',
      'searchUserPositions',
      'getPositionChanges',
      'getLPTokenReservesHistory',
      'getLPTokenTransfers',
      'getVaultsTVL',
      'getVolume24h',
      'getVolume7d',
      'getVaultData',
      'getVaultVolumeHistory',
      'getVaultHistoricalStats',
    ];

    notImplementedMethods.forEach((method) => {
      it(`should throw not implemented error for ${method}`, async () => {
        const mockArgs = method.includes('LP')
          ? ['0xtoken123', ChainType.BASE]
          : method.includes('Vault')
            ? [ChainType.BASE, '0xvault123']
            : [ChainType.BASE];

        await expect(service[method](...mockArgs)).rejects.toThrow(
          `${method.replace(/([A-Z])/g, ' $1').toLowerCase()} method not implemented for Alchemy service`,
        );
      });
    });
  });
});
