import { Injectable } from '@nestjs/common';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';

@Injectable()
export class GetWebhookSubscriptionUseCase {
  constructor(
    private readonly webhookSubscriptionRepository: WebhookSubscriptionRepository,
  ) {}

  async execute(id: string): Promise<WebhookSubscriptionEntity | null> {
    return this.webhookSubscriptionRepository.findById(id);
  }
}
