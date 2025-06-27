import { WebhookEventType } from '../../domain/entities/webhook-subscription.entity';

export interface CreateWebhookSubscriptionDto {
  developerId: string;
  url: string;
  eventTypes: WebhookEventType[];
}
