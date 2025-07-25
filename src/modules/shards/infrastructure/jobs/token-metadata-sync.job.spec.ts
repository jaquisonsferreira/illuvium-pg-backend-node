import { Test, TestingModule } from '@nestjs/testing';
import { TokenMetadataSyncJob } from './token-metadata-sync.job';
import { CacheService } from '@shared/services/cache.service';
import { HttpService } from '@shared/services/http.service';
import { Job } from 'bull';
import { of } from 'rxjs';

describe('TokenMetadataSyncJob', () => {
  let job: TokenMetadataSyncJob;
  let cacheService: jest.Mocked<CacheService>;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenMetadataSyncJob,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<TokenMetadataSyncJob>(TokenMetadataSyncJob);
    cacheService = module.get(CacheService);
    httpService = module.get(HttpService);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('process', () => {
    it('should process token metadata sync job', async () => {
      const mockJob = {
        id: '123',
        data: {
          tokens: ['ILV', 'ETH'],
          syncType: 'partial',
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      cacheService.get.mockResolvedValue(null);

      const mockApiResponse = {
        data: {
          market_data: {
            market_cap: { usd: 500000000 },
            total_volume: { usd: 50000000 },
            price_change_percentage_24h: 5.25,
            circulating_supply: 1000000,
          },
        },
      };

      httpService.get.mockReturnValue(of(mockApiResponse) as any);

      await job.process(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should use cached metadata when available', async () => {
      const mockJob = {
        id: '456',
        data: {
          tokens: ['ILV'],
          forceUpdate: false,
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      const cachedMetadata = {
        symbol: 'ILV',
        name: 'Illuvium',
        decimals: 18,
        lastUpdated: new Date().toISOString(),
      };

      cacheService.get.mockResolvedValue(cachedMetadata);

      await job.process(mockJob);

      expect(httpService.get).not.toHaveBeenCalled();
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });
  });

  describe('syncSingleToken', () => {
    it('should sync metadata for a single token', async () => {
      const mockJob = {
        id: '789',
        data: {
          token: 'ILV',
          forceUpdate: true,
        },
      } as Job<any>;

      cacheService.get.mockResolvedValue(null);

      const mockApiResponse = {
        data: {
          market_data: {
            market_cap: { usd: 500000000 },
            total_volume: { usd: 50000000 },
            price_change_percentage_24h: 5.25,
            circulating_supply: 1000000,
          },
        },
      };

      httpService.get.mockReturnValue(of(mockApiResponse) as any);

      await job.syncSingleToken(mockJob);

      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('syncContractMetadata', () => {
    it('should sync contract metadata', async () => {
      const mockJob = {
        id: '101',
        data: {
          chain: 'ethereum',
          addresses: [
            '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
        progress: jest.fn(),
      } as unknown as Job<any>;

      await job.syncContractMetadata(mockJob);

      expect(cacheService.set).toHaveBeenCalledTimes(2);
      expect(mockJob.progress).toHaveBeenCalledWith(0);
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });
  });

  describe('validateMetadata', () => {
    it('should validate and resync invalid metadata', async () => {
      const mockJob = {
        id: '202',
        data: {
          tokens: ['ILV', 'ETH'],
        },
      } as Job<any>;

      cacheService.get
        .mockResolvedValueOnce({
          symbol: 'ILV',
          name: 'Illuvium',
          decimals: 18,
          lastUpdated: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        })
        .mockResolvedValueOnce({
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          lastUpdated: new Date().toISOString(),
        });

      const mockApiResponse = {
        data: {
          market_data: {
            market_cap: { usd: 500000000 },
            total_volume: { usd: 50000000 },
            price_change_percentage_24h: 5.25,
            circulating_supply: 1000000,
          },
        },
      };

      httpService.get.mockReturnValue(of(mockApiResponse) as any);

      await job.validateMetadata(mockJob);

      expect(httpService.get).toHaveBeenCalled();
    });
  });
});
