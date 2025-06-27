import {
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';

export interface UpdateWebhookSubscriptionDto {
  url?: string;
  eventTypes?: WebhookEventType[];
  status?: WebhookSubscriptionStatus;
}
