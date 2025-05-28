import { Injectable, Logger } from '@nestjs/common';
import { WebhookSignatureValidationService } from '../../infrastructure/services/webhook-signature-validation.service';
import { PrivyWebhookMapperService } from '../../infrastructure/services/privy-webhook-mapper.service';
import { EventBridgeService } from '../../infrastructure/services/event-bridge.service';
import { PrivyWebhookPayloadUnion } from '../../domain/entities/privy-webhook-payload.entity';

export interface ProcessWebhookRequest {
  payload: string;
  headers: Record<string, string>;
}

export interface ProcessWebhookResponse {
  success: boolean;
  message: string;
  eventType?: string;
  userId?: string;
}

@Injectable()
export class ProcessPrivyWebhookUseCase {
  private readonly logger = new Logger(ProcessPrivyWebhookUseCase.name);

  constructor(
    private readonly signatureValidationService: WebhookSignatureValidationService,
    private readonly mapperService: PrivyWebhookMapperService,
    private readonly eventBridgeService: EventBridgeService,
  ) {}

  /**
   * Processes a Privy webhook by validating signature, mapping to internal event,
   * and sending to EventBridge
   * @param request - Webhook request containing payload and headers
   * @returns Processing result
   */
  async execute(
    request: ProcessWebhookRequest,
  ): Promise<ProcessWebhookResponse> {
    const startTime = Date.now();

    try {
      this.logger.log('Processing Privy webhook', {
        payloadLength: request.payload.length,
        headers: this.sanitizeHeaders(request.headers),
      });

      const verifiedPayload = this.signatureValidationService.verifySignature(
        request.payload,
        request.headers,
      );

      this.logger.log('Webhook signature verified successfully');

      const privyPayload = this.parsePrivyPayload(verifiedPayload);
      if (!privyPayload) {
        return {
          success: false,
          message: 'Invalid or unsupported webhook payload format',
        };
      }

      this.logger.log('Webhook payload parsed', {
        type: privyPayload.type,
        userId: privyPayload.user?.id,
      });

      const userEvent = this.mapperService.mapToUserEvent(privyPayload);
      if (!userEvent) {
        this.logger.log('Webhook type not mapped to internal event', {
          type: privyPayload.type,
        });
        return {
          success: true,
          message: 'Webhook received but not mapped to internal event',
          eventType: privyPayload.type,
        };
      }

      this.logger.log('Webhook mapped to internal event', {
        eventType: userEvent.type,
        userId: userEvent.userId,
      });

      const eventSent = await this.eventBridgeService.sendUserEvent(userEvent);
      if (!eventSent) {
        return {
          success: false,
          message: 'Failed to send event to EventBridge',
          eventType: userEvent.type,
          userId: userEvent.userId,
        };
      }

      const processingTime = Date.now() - startTime;
      this.logger.log('Webhook processed successfully', {
        eventType: userEvent.type,
        userId: userEvent.userId,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventType: userEvent.type,
        userId: userEvent.userId,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Error processing webhook', {
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime,
      });

      return {
        success: false,
        message: `Webhook processing failed: ${error.message}`,
      };
    }
  }

  /**
   * Parses and validates the Privy webhook payload
   */
  private parsePrivyPayload(payload: any): PrivyWebhookPayloadUnion | null {
    try {
      const parsedPayload =
        typeof payload === 'string' ? JSON.parse(payload) : payload;

      if (!parsedPayload.type || !parsedPayload.user) {
        this.logger.warn('Invalid webhook payload structure', {
          hasType: !!parsedPayload.type,
          hasUser: !!parsedPayload.user,
        });
        return null;
      }

      if (!parsedPayload.user.id) {
        this.logger.warn('Invalid user object in webhook payload', {
          user: parsedPayload.user,
        });
        return null;
      }

      return parsedPayload as PrivyWebhookPayloadUnion;
    } catch (error) {
      this.logger.error('Error parsing webhook payload', {
        error: error.message,
        payload:
          typeof payload === 'string' ? payload.substring(0, 200) : payload,
      });
      return null;
    }
  }

  /**
   * Sanitizes headers for logging (removes sensitive information)
   */
  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const sanitized = { ...headers };

    const sensitiveHeaders = [
      'authorization',
      'webhook-signature',
      'svix-signature',
    ];
    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Health check method to verify all dependencies
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, boolean>;
  }> {
    const details: Record<string, boolean> = {};

    try {
      details.eventBridge = await this.eventBridgeService.healthCheck();

      details.webhookSecret = !!process.env.PRIVY_WEBHOOK_SECRET;

      details.awsCredentials = !!(
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      );

      const healthy = Object.values(details).every((status) => status);

      return { healthy, details };
    } catch (error) {
      this.logger.error('Health check failed', error.message);
      return {
        healthy: false,
        details: { ...details, error: false },
      };
    }
  }
}
