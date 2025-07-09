import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import {
  BlockchainEvent,
  EventProcessingResult,
} from '../../domain/types/blockchain-event.types';
import { EVENT_BRIDGE_SOURCE } from '../../constants';

@Injectable()
export class BlockchainEventBridgeService {
  private readonly logger = new Logger(BlockchainEventBridgeService.name);
  private readonly eventBridgeClient: EventBridgeClient;
  private readonly eventBusName: string;
  private readonly isDisabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const isDisabled = this.configService.get('IS_DISABLED_EVENTBRIDGE', false);

    this.isDisabled = isDisabled;

    if (this.isDisabled) {
      this.logger.warn(
        'EventBridge disabled - running in development mode without valid AWS credentials',
      );
      return;
    }

    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');

    this.eventBridgeClient = new EventBridgeClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    });

    this.eventBusName = this.configService.get(
      'AWS_EVENTBRIDGE_BUS_NAME',
      'default',
    );
  }

  async publishEvent(event: BlockchainEvent): Promise<EventProcessingResult> {
    if (this.isDisabled) {
      this.logger.debug(
        `EventBridge disabled - skipping event: ${event.eventType}`,
      );
      return {
        success: true,
        eventId: 'disabled-mode',
        eventType: event.eventType,
        processedAt: new Date(),
      };
    }

    try {
      const eventEntry = this.createEventEntry(event);

      const command = new PutEventsCommand({
        Entries: [eventEntry],
      });

      const response = await this.eventBridgeClient.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        const errorCode = response.Entries?.[0]?.ErrorCode;
        const errorMessage = response.Entries?.[0]?.ErrorMessage;
        throw new Error(`EventBridge failed: ${errorCode} - ${errorMessage}`);
      }

      const eventId = response.Entries?.[0]?.EventId || 'unknown';

      this.logger.log(
        `Successfully published event: ${event.eventType} (ID: ${eventId})`,
      );

      return {
        success: true,
        eventId,
        eventType: event.eventType,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to publish event: ${event.eventType}`, error);

      return {
        success: false,
        eventId: 'failed',
        eventType: event.eventType,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async publishEvents(
    events: BlockchainEvent[],
  ): Promise<EventProcessingResult[]> {
    if (this.isDisabled) {
      this.logger.debug(
        `EventBridge disabled - skipping ${events.length} events`,
      );
      return events.map((event) => ({
        success: true,
        eventId: 'disabled-mode',
        eventType: event.eventType,
        processedAt: new Date(),
      }));
    }

    const batchSize = 10;
    const results: EventProcessingResult[] = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchResults = await this.publishEventBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async publishEventBatch(
    events: BlockchainEvent[],
  ): Promise<EventProcessingResult[]> {
    if (this.isDisabled) {
      return events.map((event) => ({
        success: true,
        eventId: 'disabled-mode',
        eventType: event.eventType,
        processedAt: new Date(),
      }));
    }

    try {
      const eventEntries = events.map((event) => this.createEventEntry(event));

      const command = new PutEventsCommand({
        Entries: eventEntries,
      });

      const response = await this.eventBridgeClient.send(command);

      const results: EventProcessingResult[] = [];

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const entry = response.Entries?.[i];

        if (entry?.ErrorCode) {
          results.push({
            success: false,
            eventId: 'failed',
            eventType: event.eventType,
            processedAt: new Date(),
            error: `${entry.ErrorCode}: ${entry.ErrorMessage}`,
          });
        } else {
          results.push({
            success: true,
            eventId: entry?.EventId || 'unknown',
            eventType: event.eventType,
            processedAt: new Date(),
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      this.logger.log(
        `Batch published: ${successCount} success, ${failCount} failed`,
      );

      return results;
    } catch (error) {
      this.logger.error('Failed to publish event batch', error);

      return events.map((event) => ({
        success: false,
        eventId: 'failed',
        eventType: event.eventType,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  private createEventEntry(event: BlockchainEvent): PutEventsRequestEntry {
    return {
      Source: EVENT_BRIDGE_SOURCE,
      DetailType: event.eventType,
      Detail: JSON.stringify({
        ...event,

        metadata: {
          network: event.networkName,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp.toISOString(),

          contractAddress: this.extractContractAddress(event),
        },
      }),
      EventBusName: this.eventBusName,

      Resources: this.buildEventResources(event),
    };
  }

  private extractContractAddress(event: BlockchainEvent): string | undefined {
    if ('contractAddress' in event) {
      return event.contractAddress;
    }
    return undefined;
  }

  private buildEventResources(event: BlockchainEvent): string[] {
    const resources: string[] = [];

    resources.push(`arn:aws:blockchain:${event.networkName}`);

    const contractAddress = this.extractContractAddress(event);
    if (contractAddress) {
      resources.push(
        `arn:aws:blockchain:${event.networkName}:contract:${contractAddress}`,
      );
    }

    resources.push(
      `arn:aws:blockchain:${event.networkName}:block:${event.blockNumber}`,
    );

    return resources;
  }

  async testConnection(): Promise<boolean> {
    if (this.isDisabled) {
      this.logger.log(
        'EventBridge connection test: DISABLED (development mode)',
      );
      return true; // Considera sucesso em modo desabilitado
    }

    try {
      const testEvent: BlockchainEvent = {
        eventType: 'blockchain.contract.discovered',
        networkName: 'test',
        blockNumber: 0,
        transactionHash: '0xtest',
        blockHash: '0xtest',
        logIndex: 0,
        timestamp: new Date(),
        contractAddress: '0xtest',
        contractType: 'ERC721',
      } as any;

      const result = await this.publishEvent(testEvent);
      this.logger.log(
        `EventBridge connection test: ${result.success ? 'SUCCESS' : 'FAILED'}`,
      );

      return result.success;
    } catch (error) {
      this.logger.error('EventBridge connection test failed', error);
      return false;
    }
  }
}
