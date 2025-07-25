import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@shared/decorators/cron.decorator';
import { InjectQueue } from '@shared/decorators/inject-queue.decorator';
import { Queue } from 'bull';
import { SHARD_QUEUES } from '../../constants';
import { ConfigService } from '@nestjs/config';

export enum PriceUpdateFrequency {
  MINUTE = 'minute',
  FIVE_MINUTES = 'five_minutes',
  FIFTEEN_MINUTES = 'fifteen_minutes',
  THIRTY_MINUTES = 'thirty_minutes',
  HOURLY = 'hourly',
  DAILY = 'daily',
}

interface PriceUpdateConfig {
  enabled: boolean;
  frequency: PriceUpdateFrequency;
  tokens: string[];
  priority: 'high' | 'normal' | 'low';
  retryAttempts: number;
  batchSize: number;
}

@Injectable()
export class PriceHistoryScheduler {
  private readonly logger = new Logger(PriceHistoryScheduler.name);

  private readonly highPriorityTokens = ['ILV', 'ETH'];
  private readonly standardTokens = ['USDC', 'USDT', 'DAI', 'WETH'];
  private readonly lpTokens = ['ILV/ETH'];

  private priceUpdateConfig: PriceUpdateConfig;

  constructor(
    @InjectQueue(SHARD_QUEUES.PRICE_UPDATE)
    private priceUpdateQueue: Queue,
    @InjectQueue(SHARD_QUEUES.TOKEN_METADATA_SYNC)
    private tokenMetadataQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.priceUpdateConfig = {
      enabled: this.configService.get<boolean>('PRICE_UPDATE_ENABLED', true),
      frequency: this.configService.get<PriceUpdateFrequency>(
        'PRICE_UPDATE_FREQUENCY',
        PriceUpdateFrequency.FIVE_MINUTES,
      ),
      tokens: this.configService.get<string[]>('PRICE_UPDATE_TOKENS', [
        ...this.highPriorityTokens,
        ...this.standardTokens,
      ]),
      priority: 'normal',
      retryAttempts: 3,
      batchSize: 10,
    };
  }

  @Cron('*/1 * * * *')
  async scheduleMinutePriceUpdate(): Promise<void> {
    if (!this.shouldRunUpdate(PriceUpdateFrequency.MINUTE)) {
      return;
    }

    this.logger.debug(
      'Scheduling minute price update for high priority tokens',
    );

    await this.priceUpdateQueue.add(
      'batch-price-update',
      {
        tokens: this.highPriorityTokens,
        priority: 'high',
        updateFrequency: 'minute',
        source: 'scheduled',
        batchSize: this.highPriorityTokens.length,
      },
      {
        priority: 1,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  @Cron('*/5 * * * *')
  async scheduleFiveMinutePriceUpdate(): Promise<void> {
    if (!this.shouldRunUpdate(PriceUpdateFrequency.FIVE_MINUTES)) {
      return;
    }

    this.logger.debug('Scheduling 5-minute price update for all active tokens');

    await this.priceUpdateQueue.add(
      'batch-price-update',
      {
        tokens: [...this.highPriorityTokens, ...this.standardTokens],
        priority: 'normal',
        updateFrequency: 'minute',
        source: 'scheduled',
        batchSize: this.priceUpdateConfig.batchSize,
      },
      {
        priority: 2,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: this.priceUpdateConfig.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  @Cron('*/15 * * * *')
  async scheduleFifteenMinutePriceUpdate(): Promise<void> {
    if (!this.shouldRunUpdate(PriceUpdateFrequency.FIFTEEN_MINUTES)) {
      return;
    }

    this.logger.debug('Scheduling 15-minute comprehensive price update');

    await this.priceUpdateQueue.add(
      'batch-price-update',
      {
        tokens: [...this.priceUpdateConfig.tokens, ...this.lpTokens],
        priority: 'normal',
        updateFrequency: 'minute',
        source: 'scheduled',
        batchSize: this.priceUpdateConfig.batchSize,
      },
      {
        priority: 3,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: this.priceUpdateConfig.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    );

    await this.recordPriceSnapshot();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleThirtyMinutePriceUpdate(): Promise<void> {
    if (!this.shouldRunUpdate(PriceUpdateFrequency.THIRTY_MINUTES)) {
      return;
    }

    this.logger.log('Scheduling 30-minute price and metadata sync');

    await this.priceUpdateQueue.add(
      {
        tokens: this.priceUpdateConfig.tokens,
        priority: 'normal',
        updateFrequency: 'hourly',
        source: 'scheduled',
      },
      {
        priority: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.tokenMetadataQueue.add(
      {
        tokens: this.priceUpdateConfig.tokens,
        syncType: 'partial',
      },
      {
        delay: 60000,
      },
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleHourlyPriceUpdate(): Promise<void> {
    if (!this.shouldRunUpdate(PriceUpdateFrequency.HOURLY)) {
      return;
    }

    this.logger.log('Scheduling hourly comprehensive price update');

    await this.priceUpdateQueue.add(
      {
        tokens: this.priceUpdateConfig.tokens,
        priority: 'normal',
        updateFrequency: 'hourly',
        source: 'scheduled',
      },
      {
        priority: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.recordPriceSnapshot();

    const currentHour = new Date().getHours();
    if (currentHour % 4 === 0) {
      await this.scheduleHistoricalPriceUpdate();
    }
  }

  @Cron('0 0 * * *') // Every day at midnight
  async scheduleDailyPriceUpdate(): Promise<void> {
    this.logger.log('Scheduling daily price update and full metadata sync');

    await this.priceUpdateQueue.add(
      {
        tokens: this.priceUpdateConfig.tokens,
        priority: 'low',
        updateFrequency: 'daily',
        source: 'scheduled',
      },
      {
        priority: 5,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.tokenMetadataQueue.add(
      {
        tokens: this.priceUpdateConfig.tokens,
        syncType: 'full',
        forceUpdate: true,
      },
      {
        delay: 300000,
      },
    );

    await this.schedulePriceCleanup();
  }

  @Cron('0 0 * * 0') // Every Sunday at midnight
  async scheduleWeeklyMetadataValidation(): Promise<void> {
    this.logger.log('Scheduling weekly metadata validation');

    await this.tokenMetadataQueue.add(
      'validate-metadata',
      {
        tokens: this.priceUpdateConfig.tokens,
      },
      {
        priority: 10,
        removeOnComplete: true,
      },
    );
  }

  async triggerManualPriceUpdate(
    tokens?: string[],
    priority: 'high' | 'normal' | 'low' = 'high',
  ): Promise<void> {
    const tokensToUpdate = tokens || this.priceUpdateConfig.tokens;

    this.logger.log(
      `Triggering manual price update for ${tokensToUpdate.length} tokens (priority: ${priority})`,
    );

    await this.priceUpdateQueue.add(
      {
        tokens: tokensToUpdate,
        priority,
        source: 'manual',
        retryCount: 0,
      },
      {
        priority: priority === 'high' ? 0 : priority === 'normal' ? 2 : 5,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 5,
        backoff: {
          type: 'fixed',
          delay: 1000,
        },
      },
    );
  }

  async triggerHistoricalPriceSync(
    token: string,
    days: number = 7,
  ): Promise<void> {
    this.logger.log(
      `Triggering historical price sync for ${token} (last ${days} days)`,
    );

    const dates: string[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    await this.priceUpdateQueue.add(
      'historical-price-update',
      {
        token,
        dates,
      },
      {
        priority: 5,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  async updatePriceConfiguration(
    config: Partial<PriceUpdateConfig>,
  ): Promise<void> {
    this.priceUpdateConfig = {
      ...this.priceUpdateConfig,
      ...config,
    };

    this.logger.log(
      'Updated price update configuration:',
      this.priceUpdateConfig,
    );
  }

  getPriceUpdateStatus(): {
    config: PriceUpdateConfig;
    nextUpdate: Date;
    isActive: boolean;
  } {
    const nextUpdate = this.getNextUpdateTime();

    return {
      config: this.priceUpdateConfig,
      nextUpdate,
      isActive: this.priceUpdateConfig.enabled,
    };
  }

  private shouldRunUpdate(frequency: PriceUpdateFrequency): boolean {
    if (!this.priceUpdateConfig.enabled) {
      return false;
    }

    const configFrequency = this.priceUpdateConfig.frequency;
    const frequencyOrder = [
      PriceUpdateFrequency.MINUTE,
      PriceUpdateFrequency.FIVE_MINUTES,
      PriceUpdateFrequency.FIFTEEN_MINUTES,
      PriceUpdateFrequency.THIRTY_MINUTES,
      PriceUpdateFrequency.HOURLY,
      PriceUpdateFrequency.DAILY,
    ];

    const configIndex = frequencyOrder.indexOf(configFrequency);
    const currentIndex = frequencyOrder.indexOf(frequency);

    return currentIndex >= configIndex;
  }

  private async scheduleHistoricalPriceUpdate(): Promise<void> {
    this.logger.debug('Scheduling historical price update for key tokens');

    for (const token of this.highPriorityTokens) {
      await this.priceUpdateQueue.add(
        'historical-price-update',
        {
          token,
          dates: this.getLast24HourDates(),
        },
        {
          priority: 8,
          delay: Math.random() * 60000,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }
  }

  private async recordPriceSnapshot(): Promise<void> {
    this.logger.debug('Recording price snapshot');
  }

  private async schedulePriceCleanup(): Promise<void> {
    this.logger.debug('Scheduling price data cleanup');
  }

  private getNextUpdateTime(): Date {
    const now = new Date();
    const next = new Date(now);

    switch (this.priceUpdateConfig.frequency) {
      case PriceUpdateFrequency.MINUTE:
        next.setMinutes(next.getMinutes() + 1);
        break;
      case PriceUpdateFrequency.FIVE_MINUTES:
        next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5);
        break;
      case PriceUpdateFrequency.FIFTEEN_MINUTES:
        next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15);
        break;
      case PriceUpdateFrequency.THIRTY_MINUTES:
        next.setMinutes(Math.ceil(next.getMinutes() / 30) * 30);
        break;
      case PriceUpdateFrequency.HOURLY:
        next.setHours(next.getHours() + 1, 0, 0, 0);
        break;
      case PriceUpdateFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;
    }

    return next;
  }

  private getLast24HourDates(): string[] {
    const dates: string[] = [];
    const now = new Date();

    for (let i = 0; i < 24; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() - i);
      dates.push(date.toISOString());
    }

    return dates;
  }
}
