import { Injectable, Logger } from '@nestjs/common';
import { WebhookSignatureValidationService } from '../../infrastructure/services/webhook-signature-validation.service';
import { ThirdwebWebhookMapperService } from '../../infrastructure/services/thirdweb-webhook-mapper.service';
import { EventBridgeService } from '../../infrastructure/services/event-bridge.service';
import { ThirdwebWebhookPayloadUnion } from '../../domain/entities/thirdweb-webhook-payload.entity';

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
export class ProcessThirdwebWebhookUseCase {
  private readonly logger = new Logger(ProcessThirdwebWebhookUseCase.name);

  constructor(
    private readonly signatureValidationService: WebhookSignatureValidationService,
    private readonly mapperService: ThirdwebWebhookMapperService,
    private readonly eventBridgeService: EventBridgeService,
  ) {}

  /**
   * Processes a Thirdweb webhook by validating signature, mapping to internal event,
   * and sending to EventBridge
   * @param request - Webhook request containing payload and headers
   * @returns Processing result
   */
  async execute(
    request: ProcessWebhookRequest,
  ): Promise<ProcessWebhookResponse> {
    const startTime = Date.now();

    try {
      this.logger.log('Processing Thirdweb webhook', {
        payloadLength: request.payload.length,
        headers: this.sanitizeHeaders(request.headers),
      });

      const verifiedPayload = this.signatureValidationService.verifySignature(
        request.payload,
        request.headers,
      );

      if (!verifiedPayload.isValid) {
        this.logger.warn('Webhook signature validation failed', {
          error: verifiedPayload.error,
        });
        return {
          success: false,
          message: 'Webhook signature validation failed',
        };
      }

      let parsedPayload: ThirdwebWebhookPayloadUnion;
      try {
        parsedPayload = JSON.parse(request.payload);
      } catch (error) {
        this.logger.error('Failed to parse webhook payload as JSON', {
          error: error.message,
          payloadPreview: request.payload.substring(0, 200),
        });
        return {
          success: false,
          message: 'Invalid JSON payload',
        };
      }

      this.logger.log('Parsed Thirdweb webhook payload', {
        type: parsedPayload.type,
        timestamp: parsedPayload.timestamp,
        chainId: parsedPayload.chain_id,
        network: parsedPayload.network,
      });

      const userEvent = this.mapperService.mapToUserEvent(parsedPayload);

      if (!userEvent) {
        this.logger.log('Webhook type not mapped to internal event', {
          webhookType: parsedPayload.type,
        });
        return {
          success: true,
          message: 'Webhook received but not mapped to internal event',
          eventType: parsedPayload.type,
        };
      }

      this.logger.log('Mapped Thirdweb webhook to internal event', {
        webhookType: parsedPayload.type,
        eventType: userEvent.type,
        userId: userEvent.userId,
      });

      const eventBridgeResult =
        await this.eventBridgeService.sendUserEvent(userEvent);

      if (!eventBridgeResult) {
        this.logger.error('Failed to send event to EventBridge', {
          eventType: userEvent.type,
          userId: userEvent.userId,
        });
        return {
          success: false,
          message: 'Failed to send event to EventBridge',
          eventType: userEvent.type,
          userId: userEvent.userId,
        };
      }

      const processingTime = Date.now() - startTime;
      this.logger.log('Successfully processed Thirdweb webhook', {
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
      this.logger.error('Unexpected error processing Thirdweb webhook', {
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime,
        payloadLength: request.payload.length,
      });

      return {
        success: false,
        message: 'Internal server error processing webhook',
      };
    }
  }

  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const sanitized = { ...headers };

    const sensitiveHeaders = [
      'authorization',
      'x-webhook-signature',
      'x-thirdweb-signature',
      'x-signature',
      'signature',
    ];

    sensitiveHeaders.forEach((header) => {
      const lowerHeader = header.toLowerCase();
      Object.keys(sanitized).forEach((key) => {
        if (key.toLowerCase() === lowerHeader) {
          sanitized[key] = '[REDACTED]';
        }
      });
    });

    return sanitized;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, boolean>;
  }> {
    try {
      const serviceChecks = {
        signatureValidation: !!this.signatureValidationService,
        mapper: !!this.mapperService,
        eventBridge: !!this.eventBridgeService,
      };

      const allServicesHealthy = Object.values(serviceChecks).every(Boolean);

      return {
        healthy: allServicesHealthy,
        details: serviceChecks,
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        healthy: false,
        details: {
          signatureValidation: false,
          mapper: false,
          eventBridge: false,
        },
      };
    }
  }
}
