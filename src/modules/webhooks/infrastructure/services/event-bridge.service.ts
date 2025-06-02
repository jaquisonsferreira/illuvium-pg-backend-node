import { Injectable, Logger } from '@nestjs/common';
import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsCommandInput,
} from '@aws-sdk/client-eventbridge';
import { UserEventUnion } from '../../domain/entities/user-event.entity';

@Injectable()
export class EventBridgeService {
  private readonly logger = new Logger(EventBridgeService.name);
  private readonly eventBridgeClient: EventBridgeClient;
  private readonly eventBusName: string;
  private readonly source: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'AWS credentials not found in environment variables. EventBridge functionality will be limited.',
      );
    }

    this.eventBridgeClient = new EventBridgeClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });

    this.eventBusName = process.env.AWS_EVENTBRIDGE_BUS_NAME!;
    if (!this.eventBusName) {
      throw new Error(
        'AWS_EVENTBRIDGE_BUS_NAME environment variable is required',
      );
    }

    this.source = process.env.AWS_EVENTBRIDGE_SOURCE || 'obelisk.webhooks';

    this.logger.log(
      `EventBridge service initialized with bus: ${this.eventBusName}`,
    );
  }

  /**
   * Sends a user event to AWS EventBridge
   * @param event - User event to send
   * @returns Promise<boolean> - Success status
   */
  async sendUserEvent(event: UserEventUnion): Promise<boolean> {
    try {
      const eventEntry = {
        Source: this.source,
        DetailType: this.getDetailType(event.type),
        Detail: JSON.stringify(event),
        EventBusName: this.eventBusName,
        Time: event.timestamp,
        Resources: [`user:${event.userId}`],
      };

      const input: PutEventsCommandInput = {
        Entries: [eventEntry],
      };

      const command = new PutEventsCommand(input);
      const response = await this.eventBridgeClient.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        this.logger.error('Failed to send event to EventBridge', {
          failedEntries: response.Entries?.filter((entry) => entry.ErrorCode),
          event: event,
        });
        return false;
      }

      this.logger.log(
        `Successfully sent ${event.type} event for user ${event.userId}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Error sending event to EventBridge', {
        error: error.message,
        event: event,
      });
      return false;
    }
  }

  /**
   * Sends multiple user events to AWS EventBridge in batch
   * @param events - Array of user events to send
   * @returns Promise<boolean> - Success status
   */
  async sendUserEventsBatch(events: UserEventUnion[]): Promise<boolean> {
    if (events.length === 0) {
      return true;
    }

    try {
      const eventEntries = events.map((event) => ({
        Source: this.source,
        DetailType: this.getDetailType(event.type),
        Detail: JSON.stringify(event),
        EventBusName: this.eventBusName,
        Time: event.timestamp,
        Resources: [`user:${event.userId}`],
      }));

      const batches = this.chunkArray(eventEntries, 10);
      let allSuccessful = true;

      for (const batch of batches) {
        const input: PutEventsCommandInput = {
          Entries: batch,
        };

        const command = new PutEventsCommand(input);
        const response = await this.eventBridgeClient.send(command);

        if (response.FailedEntryCount && response.FailedEntryCount > 0) {
          this.logger.error('Failed to send batch to EventBridge', {
            failedEntries: response.Entries?.filter((entry) => entry.ErrorCode),
            batchSize: batch.length,
          });
          allSuccessful = false;
        }
      }

      if (allSuccessful) {
        this.logger.log(
          `Successfully sent ${events.length} events to EventBridge`,
        );
      }

      return allSuccessful;
    } catch (error) {
      this.logger.error('Error sending batch events to EventBridge', {
        error: error.message,
        eventCount: events.length,
      });
      return false;
    }
  }

  private getDetailType(eventType: string): string {
    const detailTypeMap: Record<string, string> = {
      'user.created': 'User Created',
      'user.authenticated': 'User Authenticated',
      'user.linked_account': 'User Linked Account',
      'user.unlinked_account': 'User Unlinked Account',
      'user.updated': 'User Updated',
    };

    return detailTypeMap[eventType] || 'User Event';
  }

  /**
   * Splits an array into chunks of a specified size
   * @param array - Array to chunk
   * @param chunkSize - Size of each chunk
   * @returns Array of chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Health check method to verify EventBridge connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testEvent = {
        Source: this.source,
        DetailType: 'Health Check',
        Detail: JSON.stringify({ timestamp: new Date().toISOString() }),
        EventBusName: this.eventBusName,
      };

      const input: PutEventsCommandInput = {
        Entries: [testEvent],
      };

      const command = new PutEventsCommand(input);
      const response = await this.eventBridgeClient.send(command);

      return !response.FailedEntryCount || response.FailedEntryCount === 0;
    } catch (error) {
      this.logger.error('EventBridge health check failed', error.message);
      return false;
    }
  }
}
