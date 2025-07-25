import { Test, TestingModule } from '@nestjs/testing';
import { PriceUpdateProcessorJob } from './price-update-processor.job';
import { CoinGeckoService } from '../services/coingecko.service';
import { CacheService } from '@shared/services/cache.service';
import { Job } from 'bull';

describe('PriceUpdateProcessorJob', () => {
  let job: PriceUpdateProcessorJob;
  let coinGeckoService: jest.Mocked<CoinGeckoService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceUpdateProcessorJob,
        {
          provide: CoinGeckoService,
          useValue: {
            getTokenPrice: jest.fn(),
            getMultipleTokenPrices: jest.fn(),
            getHistoricalPrice: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<PriceUpdateProcessorJob>(PriceUpdateProcessorJob);
    coinGeckoService = module.get(CoinGeckoService);
    cacheService = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('process', () => {
    it('should process price update job successfully', async () => {
      const mockJob = {
        id: '123',
        data: {
          tokens: ['ILV', 'ETH'],
          priority: 'high',
          source: 'scheduled',
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      const mockPrices = new Map([
        ['ILV', 50.75],
        ['ETH', 2500.5],
      ]);

      coinGeckoService.getMultipleTokenPrices.mockResolvedValue(mockPrices);
      cacheService.get.mockImplementation((key: string) => {
        if (key.includes(':history:')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      await job.process(mockJob);

      expect(coinGeckoService.getMultipleTokenPrices).toHaveBeenCalledWith([
        'ILV',
        'ETH',
      ]);
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(80);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should handle errors with retry logic', async () => {
      const mockJob = {
        id: '456',
        data: {
          tokens: ['ILV'],
          retryCount: 3,
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      coinGeckoService.getMultipleTokenPrices.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );
      cacheService.get.mockResolvedValue(null);

      // When retryCount is 3, it should not throw but handle the failed update
      await job.process(mockJob);

      // Verify that the error was handled
      expect(cacheService.get).toHaveBeenCalledWith(
        'shards:prices:fallback'
      );
    });
  });

  describe('updateSingleToken', () => {
    it('should update single token price', async () => {
      const mockJob = {
        id: '789',
        data: {
          token: 'ILV',
          priority: 'high',
        },
      } as Job<any>;

      coinGeckoService.getTokenPrice.mockResolvedValue(48.25);
      cacheService.get.mockImplementation((key: string) => {
        if (key.includes(':history:')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      await job.updateSingleToken(mockJob);

      expect(coinGeckoService.getTokenPrice).toHaveBeenCalledWith('ILV');
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('batchPriceUpdate', () => {
    it('should process batch price updates', async () => {
      const mockJob = {
        id: '101',
        data: {
          tokens: ['ILV', 'ETH', 'USDC', 'USDT'],
          batchSize: 2,
          updateFrequency: 'hourly',
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      coinGeckoService.getMultipleTokenPrices
        .mockResolvedValueOnce(
          new Map([
            ['ILV', 50],
            ['ETH', 2500],
          ]),
        )
        .mockResolvedValueOnce(
          new Map([
            ['USDC', 1],
            ['USDT', 1],
          ]),
        );

      cacheService.get.mockImplementation((key: string) => {
        if (key.includes(':history:')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      await job.batchPriceUpdate(mockJob);

      expect(coinGeckoService.getMultipleTokenPrices).toHaveBeenCalledTimes(2);
      expect(mockJob.progress).toHaveBeenCalled();
    });
  });

  describe('updateHistoricalPrices', () => {
    it('should update historical prices for a token', async () => {
      const mockJob = {
        id: '202',
        data: {
          token: 'ILV',
          dates: ['2024-01-14', '2024-01-15'],
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      coinGeckoService.getHistoricalPrice
        .mockResolvedValueOnce(45.5)
        .mockResolvedValueOnce(48.75);

      cacheService.get.mockImplementation((key: string) => {
        if (key.includes(':historical:')) {
          return Promise.resolve({});
        }
        return Promise.resolve([]);
      });

      await job.updateHistoricalPrices(mockJob);

      expect(coinGeckoService.getHistoricalPrice).toHaveBeenCalledTimes(2);
      expect(coinGeckoService.getHistoricalPrice).toHaveBeenCalledWith(
        'ILV',
        new Date('2024-01-14'),
      );
      expect(coinGeckoService.getHistoricalPrice).toHaveBeenCalledWith(
        'ILV',
        new Date('2024-01-15'),
      );
    });
  });
});
