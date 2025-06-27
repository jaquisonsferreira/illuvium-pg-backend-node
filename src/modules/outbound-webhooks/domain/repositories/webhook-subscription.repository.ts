import { WebhookSubscriptionEntity } from '../entities/webhook-subscription.entity';

export interface WebhookSubscriptionRepository {
  create(
    subscription: WebhookSubscriptionEntity,
  ): Promise<WebhookSubscriptionEntity>;
  findById(id: string): Promise<WebhookSubscriptionEntity | null>;
  findByDeveloperId(developerId: string): Promise<WebhookSubscriptionEntity[]>;
  findByDeveloperIdAndEventType(
    developerId: string,
    eventType: string,
  ): Promise<WebhookSubscriptionEntity[]>;
  update(
    subscription: WebhookSubscriptionEntity,
  ): Promise<WebhookSubscriptionEntity>;
  delete(id: string): Promise<void>;
  findActiveByEventType(
    eventType: string,
  ): Promise<WebhookSubscriptionEntity[]>;
}
