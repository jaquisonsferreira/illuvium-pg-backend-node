import { Test, TestingModule } from '@nestjs/testing';
import { SubgraphService } from './subgraph.service';
import { HttpService } from '@shared/services/http.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@shared/services/cache.service';
import { of, throwError } from 'rxjs';

describe('SubgraphService', () => {
  let service: SubgraphService;
  let httpService: jest.Mocked<HttpService>;
  let cacheService: jest.Mocked<CacheService>;

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

  const mockAxiosResponse = (data: any) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  });

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          SUBGRAPH_URL_BASE:
            'https://api.thegraph.com/subgraphs/name/base-vault',
          SUBGRAPH_URL_ETHEREUM:
            'https://api.thegraph.com/subgraphs/name/ethereum-vault',
          SUBGRAPH_URL_ARBITRUM:
            'https://api.thegraph.com/subgraphs/name/arbitrum-vault',
          SUBGRAPH_URL_OPTIMISM:
            'https://api.thegraph.com/subgraphs/name/optimism-vault',
        };
        return config[key];
      }),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubgraphService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<SubgraphService>(SubgraphService);
    httpService = module.get(HttpService);
    cacheService = module.get(CacheService);
  });

  describe('getVaultData', () => {
    it('should return cached vault data if available', async () => {
      cacheService.get.mockResolvedValue(mockVaultData);

      const result = await service.getVaultData('0xvault123', 'base');

      expect(result).toEqual(mockVaultData);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch and cache vault data', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vault: mockVaultData },
          }),
        ),
      );

      const result = await service.getVaultData('0xvault123', 'base');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.thegraph.com/subgraphs/name/base-vault',
        {
          query: expect.stringContaining('query GetVault'),
          variables: { id: '0xvault123' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toEqual(mockVaultData);
    });

    it('should return null when vault not found', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vault: null },
          }),
        ),
      );

      const result = await service.getVaultData('0xnonexistent', 'base');

      expect(result).toBeNull();
    });

    it('should handle subgraph errors', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: null,
            errors: [{ message: 'Subgraph error' }],
          }),
        ),
      );

      await expect(service.getVaultData('0xvault123', 'base')).rejects.toThrow(
        'Subgraph errors: Subgraph error',
      );
    });

    it('should handle HTTP errors', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new Error('HTTP error')),
      );

      await expect(service.getVaultData('0xvault123', 'base')).rejects.toThrow(
        'HTTP error',
      );
    });
  });

  describe('getVaultPositions', () => {
    it('should fetch vault positions with pagination', async () => {
      const firstBatch = Array(1000).fill(mockVaultPosition);
      const secondBatch = Array(500).fill(mockVaultPosition);

      httpService.post
        .mockReturnValueOnce(
          of(
            mockAxiosResponse({
              data: { vaultPositions: firstBatch },
            }),
          ),
        )
        .mockReturnValueOnce(
          of(
            mockAxiosResponse({
              data: { vaultPositions: secondBatch },
            }),
          ),
        );

      const result = await service.getVaultPositions('0xvault123', 'base');

      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1500);
    });

    it('should fetch vault positions with block number', async () => {
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaultPositions: [mockVaultPosition] },
          }),
        ),
      );

      await service.getVaultPositions('0xvault123', 'base', 12345678);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          query: expect.stringContaining('query GetVaultPositions'),
          variables: {
            vault: '0xvault123',
            first: 1000,
            skip: 0,
            block: { number: 12345678 },
          },
        },
        expect.any(Object),
      );
    });

    it('should handle empty vault positions', async () => {
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaultPositions: [] },
          }),
        ),
      );

      const result = await service.getVaultPositions('0xvault123', 'base');

      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.getVaultPositions('0xvault123', 'base'),
      ).rejects.toThrow('Network error');
    });
  });

  describe('getUserVaultPositions', () => {
    it('should return cached user positions if available', async () => {
      cacheService.get.mockResolvedValue([mockVaultPosition]);

      const result = await service.getUserVaultPositions('0xwallet123', 'base');

      expect(result).toEqual([mockVaultPosition]);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch and cache user positions', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaultPositions: [mockVaultPosition] },
          }),
        ),
      );

      const result = await service.getUserVaultPositions('0xwallet123', 'base');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          query: expect.stringContaining('query GetUserPositions'),
          variables: {
            account: '0xwallet123',
            first: 100,
            skip: 0,
          },
        },
        expect.any(Object),
      );
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toEqual([mockVaultPosition]);
    });

    it('should not cache when block number is specified', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaultPositions: [mockVaultPosition] },
          }),
        ),
      );

      await service.getUserVaultPositions('0xwallet123', 'base', 12345678);

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should handle pagination for user positions', async () => {
      cacheService.get.mockResolvedValue(null);
      const firstBatch = Array(100).fill(mockVaultPosition);
      const secondBatch = Array(50).fill(mockVaultPosition);

      httpService.post
        .mockReturnValueOnce(
          of(
            mockAxiosResponse({
              data: { vaultPositions: firstBatch },
            }),
          ),
        )
        .mockReturnValueOnce(
          of(
            mockAxiosResponse({
              data: { vaultPositions: secondBatch },
            }),
          ),
        );

      const result = await service.getUserVaultPositions('0xwallet123', 'base');

      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(150);
    });

    it('should handle errors', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.getUserVaultPositions('0xwallet123', 'base'),
      ).rejects.toThrow('Network error');
    });
  });

  describe('getEligibleVaults', () => {
    it('should return cached eligible vaults', async () => {
      const mockVaults = ['0xvault1', '0xvault2'];
      cacheService.get.mockResolvedValue(mockVaults);

      const result = await service.getEligibleVaults('base');

      expect(result).toEqual(mockVaults);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch and cache eligible vaults', async () => {
      cacheService.get.mockResolvedValue(null);
      const mockVaults = [
        { id: '0xvault1', asset: { symbol: 'ETH' } },
        { id: '0xvault2', asset: { symbol: 'USDC' } },
      ];

      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaults: mockVaults },
          }),
        ),
      );

      const result = await service.getEligibleVaults('base');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          query: expect.stringContaining('query GetEligibleVaults'),
          variables: {
            symbols: ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC'],
          },
        },
        expect.any(Object),
      );
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toEqual(['0xvault1', '0xvault2']);
    });

    it('should handle empty vaults response', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaults: [] },
          }),
        ),
      );

      const result = await service.getEligibleVaults('base');

      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.getEligibleVaults('base')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('getBlockByTimestamp', () => {
    it('should return cached block number', async () => {
      const mockBlockNumber = 12345678;
      cacheService.get.mockResolvedValue(mockBlockNumber);

      const result = await service.getBlockByTimestamp('base', 1642000000);

      expect(result).toBe(mockBlockNumber);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch and cache block number by timestamp', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: {
              blocks: [{ number: '12345678', timestamp: '1642000000' }],
            },
          }),
        ),
      );

      const result = await service.getBlockByTimestamp('base', 1642000000);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          query: expect.stringContaining('query GetBlock'),
          variables: { timestamp: 1642000000 },
        },
        expect.any(Object),
      );
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toBe(12345678);
    });

    it('should handle no blocks found', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { blocks: [] },
          }),
        ),
      );

      await expect(
        service.getBlockByTimestamp('base', 1642000000),
      ).rejects.toThrow('No block found for timestamp 1642000000 on base');
    });

    it('should handle errors', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.getBlockByTimestamp('base', 1642000000),
      ).rejects.toThrow('Network error');
    });
  });

  describe('querySubgraph private method tests', () => {
    it('should throw error for unsupported chain', async () => {
      await expect(
        service.getVaultData('0xvault123', 'unsupported'),
      ).rejects.toThrow('No subgraph URL configured for chain: unsupported');
    });

    it('should handle custom URL parameter', async () => {
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: {
              blocks: [{ number: '12345678', timestamp: '1642000000' }],
            },
          }),
        ),
      );

      await service.getBlockByTimestamp('base', 1642000000);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.thegraph.com/subgraphs/name/base-vault',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed subgraph response', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vault: null },
          }),
        ),
      );

      const result = await service.getVaultData('0xvault123', 'base');

      expect(result).toBeNull();
    });

    it('should handle null vaultPositions in response', async () => {
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaultPositions: null },
          }),
        ),
      );

      const result = await service.getVaultPositions('0xvault123', 'base');

      expect(result).toEqual([]);
    });

    it('should handle null vaults in eligible vaults response', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaults: null },
          }),
        ),
      );

      const result = await service.getEligibleVaults('base');

      expect(result).toEqual([]);
    });

    it('should properly lowercase wallet addresses', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            data: { vaultPositions: [] },
          }),
        ),
      );

      await service.getUserVaultPositions('0xWALLET123', 'base');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          variables: expect.objectContaining({
            account: '0xwallet123',
          }),
        }),
        expect.any(Object),
      );
    });
  });
});
