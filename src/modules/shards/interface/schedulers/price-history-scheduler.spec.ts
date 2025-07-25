import { Test, TestingModule } from '@nestjs/testing';
import { PriceHistoryScheduler } from './price-history-scheduler';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { SHARD_QUEUES } from '../../constants';

describe('PriceHistoryScheduler', () => {
  let scheduler: PriceHistoryScheduler;
  let priceUpdateQueue: jest.Mocked<Queue>;
  let tokenMetadataQueue: jest.Mocked<Queue>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceHistoryScheduler,
        {
          provide: `BullQueue_${SHARD_QUEUES.PRICE_UPDATE}`,
          useValue: mockQueue,
        },
        {
          provide: `BullQueue_${SHARD_QUEUES.TOKEN_METADATA_SYNC}`,
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  PRICE_UPDATE_ENABLED: true,
                  PRICE_UPDATE_FREQUENCY: 'five_minutes',
                  PRICE_UPDATE_TOKENS: ['ILV', 'ETH', 'USDC', 'USDT', 'DAI'],
                };
                return config[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    scheduler = module.get<PriceHistoryScheduler>(PriceHistoryScheduler);
    priceUpdateQueue = module.get(`BullQueue_${SHARD_QUEUES.PRICE_UPDATE}`);
    tokenMetadataQueue = module.get(
      `BullQueue_${SHARD_QUEUES.TOKEN_METADATA_SYNC}`,
    );
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scheduleMinutePriceUpdate', () => {
    it('should schedule minute price update for high priority tokens when enabled', async () => {
      // Create a new module with minute frequency config
      const mockQueueMinute = {
        add: jest.fn(),
      };

      const moduleMinute: TestingModule = await Test.createTestingModule({
        providers: [
          PriceHistoryScheduler,
          {
            provide: `BullQueue_${SHARD_QUEUES.PRICE_UPDATE}`,
            useValue: mockQueueMinute,
          },
          {
            provide: `BullQueue_${SHARD_QUEUES.TOKEN_METADATA_SYNC}`,
            useValue: mockQueueMinute,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  PRICE_UPDATE_ENABLED: true,
                  PRICE_UPDATE_FREQUENCY: 'minute',
                  PRICE_UPDATE_TOKENS: ['ILV', 'ETH', 'USDC', 'USDT', 'DAI'],
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const schedulerMinute = moduleMinute.get<PriceHistoryScheduler>(PriceHistoryScheduler);
      const priceUpdateQueueMinute = moduleMinute.get(`BullQueue_${SHARD_QUEUES.PRICE_UPDATE}`);

      await schedulerMinute.scheduleMinutePriceUpdate();

      expect(priceUpdateQueueMinute.add).toHaveBeenCalledWith(
        'batch-price-update',
        expect.objectContaining({
          tokens: ['ILV', 'ETH'],
          priority: 'high',
          updateFrequency: 'minute',
          source: 'scheduled',
        }),
        expect.objectContaining({
          priority: 1,
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        }),
      );
    });

    it('should not schedule when frequency is higher than minute', async () => {
      priceUpdateQueue.add.mockClear();
      await scheduler.scheduleMinutePriceUpdate();
      expect(priceUpdateQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('scheduleFiveMinutePriceUpdate', () => {
    it('should schedule 5-minute price update for all active tokens', async () => {
      await scheduler.scheduleFiveMinutePriceUpdate();

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        'batch-price-update',
        expect.objectContaining({
          tokens: expect.arrayContaining(['ILV', 'ETH', 'USDC', 'USDT', 'DAI']),
          priority: 'normal',
          updateFrequency: 'minute',
          source: 'scheduled',
        }),
        expect.objectContaining({
          priority: 2,
        }),
      );
    });
  });

  describe('scheduleFifteenMinutePriceUpdate', () => {
    it('should schedule 15-minute comprehensive price update', async () => {
      await scheduler.scheduleFifteenMinutePriceUpdate();

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        'batch-price-update',
        expect.objectContaining({
          tokens: expect.arrayContaining([
            'ILV',
            'ETH',
            'USDC',
            'USDT',
            'DAI',
            'ILV/ETH',
          ]),
          priority: 'normal',
          updateFrequency: 'minute',
          source: 'scheduled',
        }),
        expect.objectContaining({
          priority: 3,
        }),
      );
    });
  });

  describe('scheduleHourlyPriceUpdate', () => {
    it('should schedule hourly price update', async () => {
      await scheduler.scheduleHourlyPriceUpdate();

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: expect.arrayContaining(['ILV', 'ETH', 'USDC', 'USDT', 'DAI']),
          priority: 'normal',
          updateFrequency: 'hourly',
          source: 'scheduled',
        }),
        expect.objectContaining({
          priority: 3,
        }),
      );
    });
  });

  describe('scheduleDailyPriceUpdate', () => {
    it('should schedule daily price update and metadata sync', async () => {
      await scheduler.scheduleDailyPriceUpdate();

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: expect.arrayContaining(['ILV', 'ETH', 'USDC', 'USDT', 'DAI']),
          priority: 'low',
          updateFrequency: 'daily',
          source: 'scheduled',
        }),
        expect.objectContaining({
          priority: 5,
        }),
      );

      expect(tokenMetadataQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: expect.arrayContaining(['ILV', 'ETH', 'USDC', 'USDT', 'DAI']),
          syncType: 'full',
          forceUpdate: true,
        }),
        expect.objectContaining({
          delay: 300000,
        }),
      );
    });
  });

  describe('triggerManualPriceUpdate', () => {
    it('should trigger manual price update with custom tokens', async () => {
      await scheduler.triggerManualPriceUpdate(['BTC', 'MATIC'], 'high');

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['BTC', 'MATIC'],
          priority: 'high',
          source: 'manual',
          retryCount: 0,
        }),
        expect.objectContaining({
          priority: 0,
          attempts: 5,
        }),
      );
    });

    it('should use default tokens when none provided', async () => {
      await scheduler.triggerManualPriceUpdate();

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: expect.arrayContaining(['ILV', 'ETH', 'USDC', 'USDT', 'DAI']),
          priority: 'high',
          source: 'manual',
        }),
        expect.any(Object),
      );
    });
  });

  describe('triggerHistoricalPriceSync', () => {
    it('should trigger historical price sync for a token', async () => {
      const mockDate = new Date('2024-01-15T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      await scheduler.triggerHistoricalPriceSync('ILV', 3);

      expect(priceUpdateQueue.add).toHaveBeenCalledWith(
        'historical-price-update',
        expect.objectContaining({
          token: 'ILV',
          dates: expect.arrayContaining([
            '2024-01-15',
            '2024-01-14',
            '2024-01-12',
          ]),
        }),
        expect.objectContaining({
          priority: 5,
          attempts: 3,
        }),
      );

      jest.restoreAllMocks();
    });
  });

  describe('getPriceUpdateStatus', () => {
    it('should return current price update status', () => {
      const status = scheduler.getPriceUpdateStatus();

      expect(status.config).toEqual(expect.objectContaining({
        enabled: true,
        frequency: 'five_minutes',
        tokens: expect.arrayContaining(['ILV', 'ETH', 'USDC', 'USDT', 'DAI']),
      }));
      expect(status.nextUpdate).toBeInstanceOf(Date);
      expect(status.isActive).toBe(true);
    });
  });

  describe('updatePriceConfiguration', () => {
    it('should update price configuration', async () => {
      await scheduler.updatePriceConfiguration({
        enabled: false,
        frequency: 'hourly' as any,
        batchSize: 5,
      });

      const status = scheduler.getPriceUpdateStatus();
      expect(status.config.enabled).toBe(false);
      expect(status.config.frequency).toBe('hourly');
      expect(status.config.batchSize).toBe(5);
    });
  });
});
