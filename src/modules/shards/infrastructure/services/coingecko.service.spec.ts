import { Test, TestingModule } from '@nestjs/testing';
import { CoinGeckoService } from './coingecko.service';
import { HttpService } from '@shared/services/http.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@shared/services/cache.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';

describe('CoinGeckoService', () => {
  let service: CoinGeckoService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoinGeckoService,
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

    service = module.get<CoinGeckoService>(CoinGeckoService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    cacheService = module.get(CacheService);
  });

  describe('getTokenPrice', () => {
    it('should return cached price if available', async () => {
      cacheService.get.mockResolvedValue(2500.5);

      const result = await service.getTokenPrice('ETH');

      expect(cacheService.get).toHaveBeenCalledWith(
        `${SHARD_CACHE_KEYS.PRICE_DATA}:eth`,
      );
      expect(httpService.get).not.toHaveBeenCalled();
      expect(result).toBe(2500.5);
    });

    it('should fetch price from API when not cached', async () => {
      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {
          ethereum: {
            usd: 2500.5,
            usd_24h_change: 5.2,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getTokenPrice('ETH');

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'ethereum',
            vs_currencies: 'usd',
            x_cg_pro_api_key: 'test-api-key',
          },
        },
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `${SHARD_CACHE_KEYS.PRICE_DATA}:eth`,
        2500.5,
        SHARD_CACHE_TTL.PRICE_DATA,
      );
      expect(result).toBe(2500.5);
    });

    it('should handle unmapped token symbols', async () => {
      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {
          'unknown-token': {
            usd: 100,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getTokenPrice('UNKNOWN-TOKEN');

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            ids: 'unknown-token',
          }),
        }),
      );
      expect(result).toBe(100);
    });

    it('should throw error when API fails', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      await expect(service.getTokenPrice('ETH')).rejects.toThrow(
        'Failed to fetch token price for ETH',
      );
    });

    it('should throw error when no price data found', async () => {
      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      await expect(service.getTokenPrice('ETH')).rejects.toThrow(
        'Failed to fetch token price for ETH',
      );
    });

    it('should work without API key', async () => {
      // Create a new service instance with no API key
      const mockConfigServiceNoKey = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const moduleNoKey: TestingModule = await Test.createTestingModule({
        providers: [
          CoinGeckoService,
          {
            provide: HttpService,
            useValue: httpService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigServiceNoKey,
          },
          {
            provide: CacheService,
            useValue: cacheService,
          },
        ],
      }).compile();

      const serviceNoKey = moduleNoKey.get<CoinGeckoService>(CoinGeckoService);

      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {
          ethereum: {
            usd: 2500,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      await serviceNoKey.getTokenPrice('ETH');

      expect(httpService.get).toHaveBeenCalledWith(expect.any(String), {
        params: {
          ids: 'ethereum',
          vs_currencies: 'usd',
        },
      });
    });
  });

  describe('getMultipleTokenPrices', () => {
    it('should return all cached prices if available', async () => {
      cacheService.get
        .mockResolvedValueOnce(2500)
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce(1);

      const result = await service.getMultipleTokenPrices([
        'ETH',
        'WBTC',
        'USDC',
      ]);

      expect(httpService.get).not.toHaveBeenCalled();
      expect(result.get('ETH')).toBe(2500);
      expect(result.get('WBTC')).toBe(3000);
      expect(result.get('USDC')).toBe(1);
    });

    it('should fetch only uncached prices', async () => {
      cacheService.get
        .mockResolvedValueOnce(2500) // ETH cached
        .mockResolvedValueOnce(null) // WBTC not cached
        .mockResolvedValueOnce(1); // USDC cached

      const mockResponse: AxiosResponse = {
        data: {
          'wrapped-bitcoin': {
            usd: 35000,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getMultipleTokenPrices([
        'ETH',
        'WBTC',
        'USDC',
      ]);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            ids: 'wrapped-bitcoin',
          }),
        }),
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `${SHARD_CACHE_KEYS.PRICE_DATA}:wbtc`,
        35000,
        SHARD_CACHE_TTL.PRICE_DATA,
      );
      expect(result.get('ETH')).toBe(2500);
      expect(result.get('WBTC')).toBe(35000);
      expect(result.get('USDC')).toBe(1);
    });

    it('should handle partial API responses', async () => {
      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {
          ethereum: {
            usd: 2500,
          },
          // WBTC missing from response
          'usd-coin': {
            usd: 1,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getMultipleTokenPrices([
        'ETH',
        'WBTC',
        'USDC',
      ]);

      expect(result.get('ETH')).toBe(2500);
      expect(result.get('WBTC')).toBeUndefined();
      expect(result.get('USDC')).toBe(1);
    });

    it('should throw error when API fails', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      await expect(
        service.getMultipleTokenPrices(['ETH', 'WBTC']),
      ).rejects.toThrow('Failed to fetch multiple token prices');
    });
  });

  describe('getHistoricalPrice', () => {
    const testDate = new Date('2024-01-15');

    it('should return cached historical price if available', async () => {
      cacheService.get.mockResolvedValue(2000);

      const result = await service.getHistoricalPrice('ETH', testDate);

      expect(cacheService.get).toHaveBeenCalledWith(
        `${SHARD_CACHE_KEYS.PRICE_DATA}:eth:2024-01-15`,
      );
      expect(httpService.get).not.toHaveBeenCalled();
      expect(result).toBe(2000);
    });

    it('should fetch historical price from API when not cached', async () => {
      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {
          market_data: {
            current_price: {
              usd: 2000,
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getHistoricalPrice('ETH', testDate);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/ethereum/history',
        {
          params: {
            date: '15-01-2024', // DD-MM-YYYY format
            localization: false,
            x_cg_pro_api_key: 'test-api-key',
          },
        },
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `${SHARD_CACHE_KEYS.PRICE_DATA}:eth:2024-01-15`,
        2000,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );
      expect(result).toBe(2000);
    });

    it('should throw error when no historical data found', async () => {
      cacheService.get.mockResolvedValue(null);

      const mockResponse: AxiosResponse = {
        data: {
          market_data: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      await expect(service.getHistoricalPrice('ETH', testDate)).rejects.toThrow(
        'Failed to fetch historical price for ETH',
      );
    });

    it('should throw error when API fails', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      await expect(service.getHistoricalPrice('ETH', testDate)).rejects.toThrow(
        'Failed to fetch historical price for ETH',
      );
    });
  });

  describe('mapSymbolToCoinId', () => {
    it('should map common symbols correctly', () => {
      const symbols = ['ETH', 'USDC', 'WBTC', 'ILV', 'IMX'];
      const expectedIds = [
        'ethereum',
        'usd-coin',
        'wrapped-bitcoin',
        'illuvium',
        'immutable-x',
      ];

      for (let i = 0; i < symbols.length; i++) {
        // Access private method through any type casting
        const coinId = (service as any).mapSymbolToCoinId(symbols[i]);
        expect(coinId).toBe(expectedIds[i]);
      }
    });

    it('should handle case insensitive symbols', () => {
      const coinId = (service as any).mapSymbolToCoinId('eth');
      expect(coinId).toBe('ethereum');
    });

    it('should return lowercase symbol for unmapped tokens', () => {
      const coinId = (service as any).mapSymbolToCoinId('UNKNOWN');
      expect(coinId).toBe('unknown');
    });
  });
});
