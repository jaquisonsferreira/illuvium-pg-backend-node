import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Webhook } from 'svix';

@Injectable()
export class WebhookSignatureValidationService {
  private readonly logger = new Logger(WebhookSignatureValidationService.name);
  private readonly webhook?: Webhook;
  private readonly webhookSecret?: string;

  constructor() {
    this.webhookSecret = process.env.PRIVY_WEBHOOK_SECRET;
    if (!this.webhookSecret) {
      this.logger.warn(
        'PRIVY_WEBHOOK_SECRET environment variable not found. Webhook signature validation will fail.',
      );
    } else {
      this.webhook = new Webhook(this.webhookSecret);
    }
  }

  /**
   * Verifies the webhook signature using Svix library
   * @param payload - Raw request body as string
   * @param headers - Request headers containing webhook signature information
   * @returns Verified payload object
   * @throws UnauthorizedException if signature verification fails
   */
  verifySignature(payload: string, headers: Record<string, string>): any {
    if (!this.webhookSecret || !this.webhook) {
      throw new UnauthorizedException(
        'PRIVY_WEBHOOK_SECRET environment variable is required for webhook signature validation',
      );
    }

    try {
      const webhookHeaders = this.extractWebhookHeaders(headers);

      this.logger.log('Verifying webhook signature', {
        hasId: !!webhookHeaders.id,
        hasTimestamp: !!webhookHeaders.timestamp,
        hasSignature: !!webhookHeaders.signature,
      });

      const verifiedPayload = this.webhook.verify(payload, webhookHeaders);

      this.logger.log('Webhook signature verified successfully');
      return verifiedPayload;
    } catch (error) {
      this.logger.error('Webhook signature verification failed', {
        error: error.message,
        payloadLength: payload.length,
      });

      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  /**
   * Extracts webhook headers from request headers
   * Supports both svix- and webhook- prefixes
   */
  private extractWebhookHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const webhookHeaders: Record<string, string> = {};

    if (headers['webhook-id']) {
      webhookHeaders['webhook-id'] = headers['webhook-id'];
      webhookHeaders['webhook-timestamp'] = headers['webhook-timestamp'];
      webhookHeaders['webhook-signature'] = headers['webhook-signature'];
    } else if (headers['svix-id']) {
      webhookHeaders['webhook-id'] = headers['svix-id'];
      webhookHeaders['webhook-timestamp'] = headers['svix-timestamp'];
      webhookHeaders['webhook-signature'] = headers['svix-signature'];
    } else {
      throw new Error('Required webhook headers not found');
    }

    return webhookHeaders;
  }
}
