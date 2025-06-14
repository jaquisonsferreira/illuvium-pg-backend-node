import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BlockchainEventBridgeService } from './blockchain-event-bridge.service';
import { ProcessBlockchainEventUseCase } from '../../application/use-cases/process-blockchain-event.use-case';
import {
  BlockchainEvent,
  EventProcessingResult,
  BlockProcessingJob,
  EventSyncJob,
} from '../../domain/types/blockchain-event.types';
import { BLOCKCHAIN_QUEUES } from '../../constants';

export interface EventProcessingMetrics {
  totalProcessed: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  lastProcessedAt: Date;
  eventTypeBreakdown: Record<string, number>;
}

export interface WebhookEventPayload {
  event: BlockchainEvent;
  metadata: {
    networkName: string;
    processedAt: Date;
    retryCount: number;
    priority: number;
  };
}

@Injectable()
export class BlockchainEventIntegrationService {
  private readonly logger = new Logger(BlockchainEventIntegrationService.name);
  private readonly metrics: EventProcessingMetrics = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    averageProcessingTime: 0,
    lastProcessedAt: new Date(),
    eventTypeBreakdown: {},
  };

  constructor(
    private readonly eventBridgeService: BlockchainEventBridgeService,
    private readonly processEventUseCase: ProcessBlockchainEventUseCase,
    @InjectQueue(BLOCKCHAIN_QUEUES.BLOCK_PROCESSOR)
    private readonly blockProcessorQueue: Queue<BlockProcessingJob>,
    @InjectQueue(BLOCKCHAIN_QUEUES.EVENT_SYNC)
    private readonly eventSyncQueue: Queue<EventSyncJob>,
  ) {}

  async processEventWithRetry(
    event: BlockchainEvent,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
  ): Promise<EventProcessingResult> {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Processing event ${event.eventType} (attempt ${attempt}/${maxRetries})`,
        );

        const result = await this.processEventUseCase.execute(event);

        if (result.success) {
          this.updateMetrics(event, startTime, true);
          return result;
        }

        if (attempt === maxRetries) {
          this.logger.error(
            `Failed to process event after ${maxRetries} attempts: ${event.eventType}`,
          );
          this.updateMetrics(event, startTime, false);
          return result;
        }

        this.logger.warn(
          `Event processing failed (attempt ${attempt}), retrying in ${retryDelayMs}ms`,
        );
        await this.delay(retryDelayMs * attempt);
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(
            `Exception processing event after ${maxRetries} attempts:`,
            error,
          );
          this.updateMetrics(event, startTime, false);
          return {
            success: false,
            eventId: 'failed',
            eventType: event.eventType,
            processedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }

        this.logger.warn(`Exception on attempt ${attempt}, retrying:`, error);
        await this.delay(retryDelayMs * attempt);
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  async processBatchWithPriority(
    events: BlockchainEvent[],
    priorityFn?: (event: BlockchainEvent) => number,
  ): Promise<EventProcessingResult[]> {
    if (priorityFn) {
      events.sort((a, b) => priorityFn(b) - priorityFn(a));
    }

    const batchSize = 10;
    const results: EventProcessingResult[] = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchPromises = batch.map((event) =>
        this.processEventWithRetry(event),
      );
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('Batch processing error:', result.reason);
          results.push({
            success: false,
            eventId: 'batch-failed',
            eventType: 'unknown',
            processedAt: new Date(),
            error: result.reason?.message || 'Batch processing failed',
          });
        }
      }

      if (i + batchSize < events.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  async scheduleEventSync(
    networkName: string,
    fromBlock: number,
    toBlock: number,
    contractAddresses?: string[],
    priority: number = 0,
  ): Promise<void> {
    const job: EventSyncJob = {
      networkName,
      fromBlock,
      toBlock,
      contractAddresses,
    };

    await this.eventSyncQueue.add('sync-events', job, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    this.logger.log(
      `Scheduled event sync for ${networkName} blocks ${fromBlock}-${toBlock}`,
    );
  }

  async scheduleBlockProcessing(
    networkName: string,
    blockNumber: number,
    priority: number = 0,
  ): Promise<void> {
    const job: BlockProcessingJob = {
      networkName,
      blockNumber,
      priority,
    };

    await this.blockProcessorQueue.add('process-block', job, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 50,
      removeOnFail: 10,
    });

    this.logger.debug(
      `Scheduled block processing for ${networkName}:${blockNumber}`,
    );
  }

  handleWebhookEvent(
    payload: WebhookEventPayload,
  ): Promise<EventProcessingResult> {
    const { event, metadata } = payload;

    this.logger.log(
      `Received webhook event: ${event.eventType} from ${metadata.networkName}`,
    );

    return this.processEventWithRetry(event, 3, 1000);
  }

  async publishCustomEvent(
    event: BlockchainEvent,
  ): Promise<EventProcessingResult> {
    try {
      const result = await this.eventBridgeService.publishEvent(event);

      if (result.success) {
        this.logger.log(`Published custom event: ${event.eventType}`);
      } else {
        this.logger.error(`Failed to publish custom event: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Error publishing custom event:', error);
      return {
        success: false,
        eventId: 'custom-failed',
        eventType: event.eventType,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getProcessingMetrics(): EventProcessingMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics.totalProcessed = 0;
    this.metrics.successful = 0;
    this.metrics.failed = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.eventTypeBreakdown = {};
    this.logger.log('Processing metrics reset');
  }

  async getQueueStatus(): Promise<{
    blockProcessor: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    eventSync: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    const [blockWaiting, blockActive, blockCompleted, blockFailed] =
      await Promise.all([
        this.blockProcessorQueue.getWaiting(),
        this.blockProcessorQueue.getActive(),
        this.blockProcessorQueue.getCompleted(),
        this.blockProcessorQueue.getFailed(),
      ]);

    const [syncWaiting, syncActive, syncCompleted, syncFailed] =
      await Promise.all([
        this.eventSyncQueue.getWaiting(),
        this.eventSyncQueue.getActive(),
        this.eventSyncQueue.getCompleted(),
        this.eventSyncQueue.getFailed(),
      ]);

    return {
      blockProcessor: {
        waiting: blockWaiting.length,
        active: blockActive.length,
        completed: blockCompleted.length,
        failed: blockFailed.length,
      },
      eventSync: {
        waiting: syncWaiting.length,
        active: syncActive.length,
        completed: syncCompleted.length,
        failed: syncFailed.length,
      },
    };
  }

  async clearFailedJobs(): Promise<void> {
    await Promise.all([
      this.blockProcessorQueue.clean(0, 'failed'),
      this.eventSyncQueue.clean(0, 'failed'),
    ]);

    this.logger.log('Cleared failed jobs from all queues');
  }

  async pauseEventProcessing(): Promise<void> {
    await Promise.all([
      this.blockProcessorQueue.pause(),
      this.eventSyncQueue.pause(),
    ]);

    this.logger.log('Paused all event processing queues');
  }

  async resumeEventProcessing(): Promise<void> {
    await Promise.all([
      this.blockProcessorQueue.resume(),
      this.eventSyncQueue.resume(),
    ]);

    this.logger.log('Resumed all event processing queues');
  }

  private updateMetrics(
    event: BlockchainEvent,
    startTime: number,
    success: boolean,
  ): void {
    const processingTime = Date.now() - startTime;

    this.metrics.totalProcessed++;
    this.metrics.lastProcessedAt = new Date();

    if (success) {
      this.metrics.successful++;
    } else {
      this.metrics.failed++;
    }

    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) +
        processingTime) /
      this.metrics.totalProcessed;

    if (!this.metrics.eventTypeBreakdown[event.eventType]) {
      this.metrics.eventTypeBreakdown[event.eventType] = 0;
    }
    this.metrics.eventTypeBreakdown[event.eventType]++;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
