import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@shared/decorators/cron.decorator';
import { InjectQueue } from '@shared/decorators/inject-queue.decorator';
import { Queue } from 'bull';
import { SHARD_QUEUES, SHARD_PROCESSING_WINDOW } from '../../constants';

@Injectable()
export class ShardProcessingScheduler {
  constructor(
    @InjectQueue(SHARD_QUEUES.DAILY_PROCESSOR)
    private dailyProcessorQueue: Queue,
    @InjectQueue(SHARD_QUEUES.VAULT_SYNC)
    private vaultSyncQueue: Queue,
    @InjectQueue(SHARD_QUEUES.SOCIAL_SYNC)
    private socialSyncQueue: Queue,
    @InjectQueue(SHARD_QUEUES.DEVELOPER_SYNC)
    private developerSyncQueue: Queue,
    @InjectQueue(SHARD_QUEUES.PRICE_UPDATE)
    private priceUpdateQueue: Queue,
    @InjectQueue(SHARD_QUEUES.TOKEN_METADATA_SYNC)
    private tokenMetadataQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduleDailyShardProcessing(): Promise<void> {
    console.log('Scheduling daily shard processing');
    await this.dailyProcessorQueue.add('calculate-daily-shards', {
      timestamp: new Date().toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleVaultSync(): Promise<void> {
    console.log('Scheduling vault balance sync');
    await this.vaultSyncQueue.add('sync-vault-positions', {
      timestamp: new Date().toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduleSocialSync(): Promise<void> {
    console.log('Scheduling social contribution sync');
    await this.socialSyncQueue.add('sync-kaito-points', {
      timestamp: new Date().toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async scheduleDeveloperSync(): Promise<void> {
    console.log('Scheduling developer contribution sync');
    await this.developerSyncQueue.add('sync-github-contributions', {
      timestamp: new Date().toISOString(),
    });
  }

  @Cron('0 */15 * * * *')
  async scheduleQuickSync(): Promise<void> {
    console.log('Running quick sync for critical updates');
  }

  async triggerManualProcessing(type: string): Promise<void> {
    console.log(`Triggering manual processing for: ${type}`);

    switch (type) {
      case 'daily':
        await this.dailyProcessorQueue.add('calculate-daily-shards', {
          manual: true,
          timestamp: new Date().toISOString(),
        });
        break;
      case 'vault':
        await this.vaultSyncQueue.add('sync-vault-positions', {
          manual: true,
          timestamp: new Date().toISOString(),
        });
        break;
      case 'social':
        await this.socialSyncQueue.add('sync-kaito-points', {
          manual: true,
          timestamp: new Date().toISOString(),
        });
        break;
      case 'developer':
        await this.developerSyncQueue.add('sync-github-contributions', {
          manual: true,
          timestamp: new Date().toISOString(),
        });
        break;
      default:
        throw new Error(`Unknown processing type: ${type}`);
    }
  }

  isWithinProcessingWindow(): boolean {
    const currentHour = new Date().getUTCHours();
    return (
      currentHour >= SHARD_PROCESSING_WINDOW.START_HOUR &&
      currentHour < SHARD_PROCESSING_WINDOW.END_HOUR
    );
  }
}
