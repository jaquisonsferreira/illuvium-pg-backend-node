import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { SystemStatusController } from './system-status.controller';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import { CoinGeckoService } from '../../infrastructure/services/coingecko.service';
import { SubgraphService } from '../../infrastructure/services/subgraph.service';
import { AlchemyShardsService } from '../../infrastructure/services/alchemy-shards.service';
import { SHARD_QUEUES } from '../../constants';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';

describe('SystemStatusController', () => {
  let controller: SystemStatusController;
  let dailyQueue: jest.Mocked<Queue>;
  let vaultQueue: jest.Mocked<Queue>;
  let manageSeasonUseCase: jest.Mocked<ManageSeasonUseCase>;
  let coinGeckoService: jest.Mocked<CoinGeckoService>;
  let subgraphService: jest.Mocked<SubgraphService>;

  const mockSeasonConfig: SeasonConfig = {
    vaultRates: { ETH: 100, USDC: 150 },
    socialConversionRate: 100,
    vaultLocked: false,
    withdrawalEnabled: true,
    redeemPeriodDays: 30,
  };

  const mockSeason = new SeasonEntity(
    1,
    'Season 1',
    'base',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    'active',
    mockSeasonConfig,
    1000,
    50000,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  const mockJobCounts = {
    active: 0,
    completed: 100,
    failed: 2,
    delayed: 0,
    waiting: 5,
  };

  const mockCompletedJob = {
    id: '123',
    finishedOn: Date.now() - 3600000, // 1 hour ago
    processedOn: Date.now() - 3610000, // 10 seconds processing time
    returnvalue: {
      walletsProcessed: 150,
      totalShardsDistributed: 10000,
    },
  } as any;

  beforeEach(async () => {
    const mockDailyQueue = {
      getJobCounts: jest.fn(),
      getCompleted: jest.fn(),
      add: jest.fn(),
      process: jest.fn(),
    };

    const mockVaultQueue = {
      getJobCounts: jest.fn(),
      getCompleted: jest.fn(),
      add: jest.fn(),
      process: jest.fn(),
    };

    const mockManageSeasonUseCase = {
      getCurrentSeason: jest.fn(),
      getUpcomingSeasons: jest.fn(),
      getSeasonStats: jest.fn(),
      createSeason: jest.fn(),
      updateSeason: jest.fn(),
    };

    const mockCoinGeckoService = {
      getTokenPrice: jest.fn(),
      getTokenPrices: jest.fn(),
      healthCheck: jest.fn(),
    };

    const mockSubgraphService = {
      getEligibleVaults: jest.fn(),
      getVaultPositions: jest.fn(),
      getUserStakingData: jest.fn(),
      healthCheck: jest.fn(),
    };

    const mockAlchemyShardsService = {
      getEligibleVaults: jest.fn(),
      getBlockByTimestamp: jest.fn(),
      getVaultData: jest.fn(),
      getVaultPositions: jest.fn(),
      getUserVaultPositions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemStatusController],
      providers: [
        {
          provide: getQueueToken(SHARD_QUEUES.DAILY_PROCESSOR),
          useValue: mockDailyQueue,
        },
        {
          provide: getQueueToken(SHARD_QUEUES.VAULT_SYNC),
          useValue: mockVaultQueue,
        },
        {
          provide: ManageSeasonUseCase,
          useValue: mockManageSeasonUseCase,
        },
        {
          provide: CoinGeckoService,
          useValue: mockCoinGeckoService,
        },
        {
          provide: SubgraphService,
          useValue: mockSubgraphService,
        },
        {
          provide: AlchemyShardsService,
          useValue: mockAlchemyShardsService,
        },
      ],
    }).compile();

    controller = module.get<SystemStatusController>(SystemStatusController);
    dailyQueue = module.get(getQueueToken(SHARD_QUEUES.DAILY_PROCESSOR));
    vaultQueue = module.get(getQueueToken(SHARD_QUEUES.VAULT_SYNC));
    manageSeasonUseCase = module.get(ManageSeasonUseCase);
    coinGeckoService = module.get(CoinGeckoService);
    subgraphService = module.get(SubgraphService);
    module.get(AlchemyShardsService);
  });

  describe('getSystemStatus', () => {
    beforeEach(() => {
      dailyQueue.getJobCounts.mockResolvedValue(mockJobCounts);
      vaultQueue.getJobCounts.mockResolvedValue({
        ...mockJobCounts,
        active: 1,
        waiting: 3,
      });
      dailyQueue.getCompleted.mockResolvedValue([mockCompletedJob]);
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      coinGeckoService.getTokenPrice.mockResolvedValue(2500);
      subgraphService.getEligibleVaults.mockResolvedValue([]);
    });

    it('should return complete system status', async () => {
      const result = await controller.getSystemStatus();

      expect(result).toMatchObject({
        version: expect.any(String),
        uptime_seconds: expect.any(Number),
        current_season: 1,
        daily_processing: {
          status: 'idle',
          last_run: expect.any(String),
          next_run: expect.any(String),
          last_duration_seconds: 10,
          wallets_processed: 150,
        },
        services: expect.arrayContaining([
          expect.objectContaining({
            name: 'CoinGecko API',
            status: 'healthy',
            last_check: expect.any(String),
            response_time_ms: expect.any(Number),
          }),
          expect.objectContaining({
            name: 'The Graph Protocol',
            status: 'healthy',
            last_check: expect.any(String),
            response_time_ms: expect.any(Number),
          }),
          expect.objectContaining({
            name: 'Kaito AI API',
            status: 'unhealthy',
          }),
          expect.objectContaining({
            name: 'Database',
            status: 'healthy',
          }),
        ]),
        cache_status: {
          enabled: true,
          hit_rate: 0.85,
          size_mb: 24.5,
        },
        queue_status: {
          pending: 8, // 5 + 3
          processing: 1, // 0 + 1
          completed: 200, // 100 + 100
          failed: 4, // 2 + 2
        },
        timestamp: expect.any(String),
      });

      expect(dailyQueue.getJobCounts).toHaveBeenCalled();
      expect(vaultQueue.getJobCounts).toHaveBeenCalled();
      expect(dailyQueue.getCompleted).toHaveBeenCalledWith(0, 1);
      expect(manageSeasonUseCase.getCurrentSeason).toHaveBeenCalledWith('base');
      expect(coinGeckoService.getTokenPrice).toHaveBeenCalledWith('illuvium');
      expect(subgraphService.getEligibleVaults).toHaveBeenCalledWith('base');
    });

    it('should show processing status when jobs are active', async () => {
      dailyQueue.getJobCounts.mockResolvedValue({
        ...mockJobCounts,
        active: 2,
      });

      const result = await controller.getSystemStatus();

      expect(result.daily_processing.status).toBe('processing');
    });

    it('should handle case when no completed jobs exist', async () => {
      dailyQueue.getCompleted.mockResolvedValue([]);

      const result = await controller.getSystemStatus();

      expect(result.daily_processing.last_duration_seconds).toBe(0);
      expect(result.daily_processing.wallets_processed).toBe(0);
      expect(result.daily_processing.last_run).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle case when no current season exists', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);

      const result = await controller.getSystemStatus();

      expect(result.current_season).toBe(1);
    });

    it('should calculate next run time correctly', async () => {
      const result = await controller.getSystemStatus();
      const nextRun = new Date(result.daily_processing.next_run);

      expect(nextRun.getUTCHours()).toBe(2);
      expect(nextRun.getUTCMinutes()).toBe(0);
      expect(nextRun.getUTCSeconds()).toBe(0);
      expect(nextRun >= new Date()).toBe(true);
    });

    it('should handle CoinGecko service error gracefully', async () => {
      coinGeckoService.getTokenPrice.mockRejectedValue(new Error('API Error'));

      const result = await controller.getSystemStatus();

      const coinGeckoServiceStatus = result.services.find(
        (s) => s.name === 'CoinGecko API',
      );
      expect(coinGeckoServiceStatus?.status).toBe('degraded');
    });

    it('should handle Subgraph service error gracefully', async () => {
      subgraphService.getEligibleVaults.mockRejectedValue(
        new Error('Graph Error'),
      );

      const result = await controller.getSystemStatus();

      const subgraphServiceStatus = result.services.find(
        (s) => s.name === 'The Graph Protocol',
      );
      expect(subgraphServiceStatus?.status).toBe('degraded');
    });

    it('should handle all services failing', async () => {
      coinGeckoService.getTokenPrice.mockRejectedValue(new Error('API Error'));
      subgraphService.getEligibleVaults.mockRejectedValue(
        new Error('Graph Error'),
      );

      const result = await controller.getSystemStatus();

      const coinGeckoServiceStatus = result.services.find(
        (s) => s.name === 'CoinGecko API',
      );
      const subgraphServiceStatus = result.services.find(
        (s) => s.name === 'The Graph Protocol',
      );

      expect(coinGeckoServiceStatus?.status).toBe('degraded');
      expect(subgraphServiceStatus?.status).toBe('degraded');
      expect(
        result.services.find((s) => s.name === 'Kaito AI API')?.status,
      ).toBe('unhealthy');
      expect(result.services.find((s) => s.name === 'Database')?.status).toBe(
        'healthy',
      );
    });

    it('should include version from environment or default', async () => {
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      const result = await controller.getSystemStatus();

      expect(result.version).toBe('1.0.0');

      if (originalVersion) {
        process.env.npm_package_version = originalVersion;
      }
    });

    it('should calculate correct queue totals', async () => {
      dailyQueue.getJobCounts.mockResolvedValue({
        active: 2,
        completed: 50,
        failed: 1,
        waiting: 3,
        delayed: 0,
      });

      vaultQueue.getJobCounts.mockResolvedValue({
        active: 1,
        completed: 25,
        failed: 0,
        waiting: 2,
        delayed: 0,
      });

      const result = await controller.getSystemStatus();

      expect(result.queue_status).toEqual({
        pending: 5, // 3 + 2
        processing: 3, // 2 + 1
        completed: 75, // 50 + 25
        failed: 1, // 1 + 0
      });
    });
  });

  describe('getCurrentSeasonId', () => {
    it('should return current season id', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);

      const result = await (controller as any).getCurrentSeasonId();

      expect(manageSeasonUseCase.getCurrentSeason).toHaveBeenCalledWith('base');
      expect(result).toBe(1);
    });

    it('should return default season id when no current season', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);

      const result = await (controller as any).getCurrentSeasonId();

      expect(result).toBe(1);
    });
  });

  describe('checkServices', () => {
    beforeEach(() => {
      coinGeckoService.getTokenPrice.mockResolvedValue(2500);
      subgraphService.getEligibleVaults.mockResolvedValue([]);
    });

    it('should return all services as healthy when working', async () => {
      const result = await (controller as any).checkServices();

      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        name: 'CoinGecko API',
        status: 'healthy',
        response_time_ms: expect.any(Number),
      });
      expect(result[1]).toMatchObject({
        name: 'The Graph Protocol',
        status: 'healthy',
        response_time_ms: expect.any(Number),
      });
      expect(result[2]).toMatchObject({
        name: 'Kaito AI API',
        status: 'unhealthy',
        response_time_ms: 0,
      });
      expect(result[3]).toMatchObject({
        name: 'Database',
        status: 'healthy',
        response_time_ms: 5,
      });
    });

    it('should mark services as degraded when they fail', async () => {
      coinGeckoService.getTokenPrice.mockRejectedValue(new Error('API Error'));
      subgraphService.getEligibleVaults.mockRejectedValue(
        new Error('Graph Error'),
      );

      const result = await (controller as any).checkServices();

      expect(result[0].status).toBe('degraded');
      expect(result[1].status).toBe('degraded');
    });

    it('should measure response times correctly', async () => {
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      coinGeckoService.getTokenPrice.mockImplementation(async () => {
        await delay(50);
        return 2500;
      });

      const result = await (controller as any).checkServices();

      expect(result[0].response_time_ms).toBeGreaterThan(40);
    });
  });
});
