import { Injectable } from '@nestjs/common';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { SvixService } from '../services/svix.service';

@Injectable()
export class DeleteWebhookSubscriptionUseCase {
  constructor(
    private readonly webhookSubscriptionRepository: WebhookSubscriptionRepository,
    private readonly svixService: SvixService,
  ) {}

  async execute(id: string): Promise<void> {
    const subscription = await this.webhookSubscriptionRepository.findById(id);

    if (!subscription) {
      throw new Error('Webhook subscription not found');
    }

    await this.svixService.deleteEndpoint(
      subscription.svixApplicationId,
      subscription.svixEndpointId,
    );

    await this.webhookSubscriptionRepository.delete(id);
  }
}
