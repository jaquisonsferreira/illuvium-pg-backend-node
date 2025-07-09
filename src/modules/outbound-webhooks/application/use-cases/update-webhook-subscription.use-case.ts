import { Injectable } from '@nestjs/common';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { SvixService } from '../services/svix.service';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';
import { UpdateWebhookSubscriptionDto } from '../dtos/update-webhook-subscription.dto';

@Injectable()
export class UpdateWebhookSubscriptionUseCase {
  constructor(
    private readonly repository: WebhookSubscriptionRepository,
    private readonly svixService: SvixService,
  ) {}

  async execute(
    subscriptionId: string,
    updateData: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionEntity> {
    const subscription = await this.repository.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Webhook subscription not found');
    }

    if (updateData.url || updateData.eventTypes) {
      await this.svixService.updateEndpoint(
        subscription.svixApplicationId,
        subscription.svixEndpointId,
        updateData.url || subscription.url,
        updateData.eventTypes || subscription.eventTypes,
      );
    }

    let updatedSubscription = subscription;

    if (updateData.eventTypes) {
      updatedSubscription = updatedSubscription.updateEventTypes(
        updateData.eventTypes,
      );
    }

    if (updateData.status) {
      updatedSubscription = updatedSubscription.updateStatus(updateData.status);
    }

    if (updateData.url) {
      updatedSubscription = updatedSubscription.updateUrl(updateData.url);
    }

    return await this.repository.update(updatedSubscription);
  }
}
