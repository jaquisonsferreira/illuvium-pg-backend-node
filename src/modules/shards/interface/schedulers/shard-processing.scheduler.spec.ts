import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bull';
import { ShardProcessingScheduler } from './shard-processing.scheduler';
import { SHARD_QUEUES, SHARD_PROCESSING_WINDOW } from '../../constants';

describe('ShardProcessingScheduler', () => {
  let scheduler: ShardProcessingScheduler;
  let dailyProcessorQueue: Queue;
  let vaultSyncQueue: Queue;
  let socialSyncQueue: Queue;
  let developerSyncQueue: Queue;
  let priceUpdateQueue: Queue;
  let tokenMetadataQueue: Queue;

  const mockQueue = () => ({
    add: jest.fn(),
  });

  beforeEach(async () => {
    dailyProcessorQueue = mockQueue() as any;
    vaultSyncQueue = mockQueue() as any;
    socialSyncQueue = mockQueue() as any;
    developerSyncQueue = mockQueue() as any;
    priceUpdateQueue = mockQueue() as any;
    tokenMetadataQueue = mockQueue() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShardProcessingScheduler,
        {
          provide: `BullQueue_${SHARD_QUEUES.DAILY_PROCESSOR}`,
          useValue: dailyProcessorQueue,
        },
        {
          provide: `BullQueue_${SHARD_QUEUES.VAULT_SYNC}`,
          useValue: vaultSyncQueue,
        },
        {
          provide: `BullQueue_${SHARD_QUEUES.SOCIAL_SYNC}`,
          useValue: socialSyncQueue,
        },
        {
          provide: `BullQueue_${SHARD_QUEUES.DEVELOPER_SYNC}`,
          useValue: developerSyncQueue,
        },
        {
          provide: `BullQueue_${SHARD_QUEUES.PRICE_UPDATE}`,
          useValue: priceUpdateQueue,
        },
        {
          provide: `BullQueue_${SHARD_QUEUES.TOKEN_METADATA_SYNC}`,
          useValue: tokenMetadataQueue,
        },
      ],
    }).compile();

    scheduler = module.get<ShardProcessingScheduler>(ShardProcessingScheduler);
  });

  describe('scheduleDailyShardProcessing', () => {
    it('should schedule daily shard processing', async () => {
      const mockDate = new Date('2024-01-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      await scheduler.scheduleDailyShardProcessing();

      expect(dailyProcessorQueue.add).toHaveBeenCalledWith(
        'calculate-daily-shards',
        {
          timestamp: mockDate.toISOString(),
        },
      );
    });
  });

  describe('scheduleVaultSync', () => {
    it('should schedule vault balance sync', async () => {
      const mockDate = new Date('2024-01-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      await scheduler.scheduleVaultSync();

      expect(vaultSyncQueue.add).toHaveBeenCalledWith('sync-vault-positions', {
        timestamp: mockDate.toISOString(),
      });
    });
  });

  describe('scheduleSocialSync', () => {
    it('should schedule social contribution sync', async () => {
      const mockDate = new Date('2024-01-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      await scheduler.scheduleSocialSync();

      expect(socialSyncQueue.add).toHaveBeenCalledWith('sync-kaito-points', {
        timestamp: mockDate.toISOString(),
      });
    });
  });

  describe('scheduleDeveloperSync', () => {
    it('should schedule developer contribution sync', async () => {
      const mockDate = new Date('2024-01-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      await scheduler.scheduleDeveloperSync();

      expect(developerSyncQueue.add).toHaveBeenCalledWith(
        'sync-github-contributions',
        {
          timestamp: mockDate.toISOString(),
        },
      );
    });
  });

  describe('scheduleQuickSync', () => {
    it('should run quick sync for critical updates', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await scheduler.scheduleQuickSync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Running quick sync for critical updates',
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('triggerManualProcessing', () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');

    beforeEach(() => {
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    });

    it('should trigger manual daily processing', async () => {
      await scheduler.triggerManualProcessing('daily');

      expect(dailyProcessorQueue.add).toHaveBeenCalledWith(
        'calculate-daily-shards',
        {
          manual: true,
          timestamp: mockDate.toISOString(),
        },
      );
    });

    it('should trigger manual vault sync', async () => {
      await scheduler.triggerManualProcessing('vault');

      expect(vaultSyncQueue.add).toHaveBeenCalledWith('sync-vault-positions', {
        manual: true,
        timestamp: mockDate.toISOString(),
      });
    });

    it('should trigger manual social sync', async () => {
      await scheduler.triggerManualProcessing('social');

      expect(socialSyncQueue.add).toHaveBeenCalledWith('sync-kaito-points', {
        manual: true,
        timestamp: mockDate.toISOString(),
      });
    });

    it('should trigger manual developer sync', async () => {
      await scheduler.triggerManualProcessing('developer');

      expect(developerSyncQueue.add).toHaveBeenCalledWith(
        'sync-github-contributions',
        {
          manual: true,
          timestamp: mockDate.toISOString(),
        },
      );
    });

    it('should throw error for unknown processing type', async () => {
      await expect(
        scheduler.triggerManualProcessing('unknown'),
      ).rejects.toThrow('Unknown processing type: unknown');
    });
  });

  describe('isWithinProcessingWindow', () => {
    it('should return true when within processing window', () => {
      const withinWindowDate = new Date();
      withinWindowDate.setUTCHours(SHARD_PROCESSING_WINDOW.START_HOUR, 30);
      jest
        .spyOn(global, 'Date')
        .mockImplementation(() => withinWindowDate as any);

      const result = scheduler.isWithinProcessingWindow();

      expect(result).toBe(true);
    });

    it('should return true at start hour', () => {
      const startHourDate = new Date();
      startHourDate.setUTCHours(SHARD_PROCESSING_WINDOW.START_HOUR, 0);
      jest.spyOn(global, 'Date').mockImplementation(() => startHourDate as any);

      const result = scheduler.isWithinProcessingWindow();

      expect(result).toBe(true);
    });

    it('should return false at end hour', () => {
      const endHourDate = new Date();
      endHourDate.setUTCHours(SHARD_PROCESSING_WINDOW.END_HOUR, 0);
      jest.spyOn(global, 'Date').mockImplementation(() => endHourDate as any);

      const result = scheduler.isWithinProcessingWindow();

      expect(result).toBe(false);
    });

    it('should return false when outside processing window', () => {
      const outsideWindowDate = new Date();
      outsideWindowDate.setUTCHours(10, 0);
      jest
        .spyOn(global, 'Date')
        .mockImplementation(() => outsideWindowDate as any);

      const result = scheduler.isWithinProcessingWindow();

      expect(result).toBe(false);
    });

    it('should return false before processing window', () => {
      const beforeWindowDate = new Date();
      beforeWindowDate.setUTCHours(SHARD_PROCESSING_WINDOW.START_HOUR - 1, 0);
      jest
        .spyOn(global, 'Date')
        .mockImplementation(() => beforeWindowDate as any);

      const result = scheduler.isWithinProcessingWindow();

      expect(result).toBe(false);
    });
  });

  describe('console logging', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log when scheduling daily shard processing', async () => {
      await scheduler.scheduleDailyShardProcessing();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Scheduling daily shard processing',
      );
    });

    it('should log when scheduling vault sync', async () => {
      await scheduler.scheduleVaultSync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Scheduling vault balance sync',
      );
    });

    it('should log when scheduling social sync', async () => {
      await scheduler.scheduleSocialSync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Scheduling social contribution sync',
      );
    });

    it('should log when scheduling developer sync', async () => {
      await scheduler.scheduleDeveloperSync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Scheduling developer contribution sync',
      );
    });

    it('should log when triggering manual processing', async () => {
      await scheduler.triggerManualProcessing('daily');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Triggering manual processing for: daily',
      );
    });
  });
});
