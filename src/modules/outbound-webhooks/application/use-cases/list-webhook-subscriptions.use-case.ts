import { Injectable } from '@nestjs/common';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';

@Injectable()
export class ListWebhookSubscriptionsUseCase {
  constructor(
    private readonly webhookSubscriptionRepository: WebhookSubscriptionRepository,
  ) {}

  async execute(developerId: string): Promise<WebhookSubscriptionEntity[]> {
    return this.webhookSubscriptionRepository.findByDeveloperId(developerId);
  }
}
