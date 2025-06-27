import { Injectable, Inject } from '@nestjs/common';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { SvixService } from '../services/svix.service';
import {
  WebhookSubscriptionEntity,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';
import { CreateWebhookSubscriptionDto } from '../dtos/create-webhook-subscription.dto';

@Injectable()
export class CreateWebhookSubscriptionUseCase {
  constructor(
    @Inject('WebhookSubscriptionRepository')
    private readonly repository: WebhookSubscriptionRepository,
    private readonly svixService: SvixService,
  ) {}

  async execute(
    dto: CreateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionEntity> {
    const svixApplication = await this.svixService.createApplication(
      dto.developerId,
    );

    const svixEndpoint = await this.svixService.createEndpoint(
      svixApplication.id,
      dto.url,
      dto.eventTypes,
    );

    const subscription = WebhookSubscriptionEntity.create({
      developerId: dto.developerId,
      svixApplicationId: svixApplication.id,
      svixEndpointId: svixEndpoint.id,
      url: dto.url,
      eventTypes: dto.eventTypes,
      status: WebhookSubscriptionStatus.ACTIVE,
    });

    return await this.repository.create(subscription);
  }
}
