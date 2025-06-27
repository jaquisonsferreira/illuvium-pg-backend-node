import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { WEBHOOK_SUBSCRIPTION_REPOSITORY, SVIX_SERVICE } from './constants';

// Use Cases
import { CreateWebhookSubscriptionUseCase } from './application/use-cases/create-webhook-subscription.use-case';
import { GetWebhookSubscriptionUseCase } from './application/use-cases/get-webhook-subscription.use-case';
import { ListWebhookSubscriptionsUseCase } from './application/use-cases/list-webhook-subscriptions.use-case';
import { CreateSvixEndpointUseCase } from './application/use-cases/create-svix-endpoint.use-case';
import { DeleteSvixEndpointUseCase } from './application/use-cases/delete-svix-endpoint.use-case';
import { SendWebhookMessageUseCase } from './application/use-cases/send-webhook-message.use-case';
import { CreateEventTypeUseCase } from './application/use-cases/create-event-type.use-case';
import { ListEventTypesUseCase } from './application/use-cases/list-event-types.use-case';
import { UpdateEventTypeUseCase } from './application/use-cases/update-event-type.use-case';
import { DeleteEventTypeUseCase } from './application/use-cases/delete-event-type.use-case';
import { UpdateWebhookSubscriptionUseCase } from './application/use-cases/update-webhook-subscription.use-case';
import { DeleteWebhookSubscriptionUseCase } from './application/use-cases/delete-webhook-subscription.use-case';

// Infrastructure
import { WebhookSubscriptionRepositoryImpl } from './infrastructure/repositories/webhook-subscription.repository.impl';
import { SvixService } from './application/services/svix.service';

// Controllers
import { WebhookSubscriptionController } from './infrastructure/controllers/webhook-subscription.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [WebhookSubscriptionController],
  providers: [
    // Use Cases - Webhook Subscriptions
    CreateWebhookSubscriptionUseCase,
    GetWebhookSubscriptionUseCase,
    ListWebhookSubscriptionsUseCase,
    UpdateWebhookSubscriptionUseCase,
    DeleteWebhookSubscriptionUseCase,
    // Use Cases - Svix Endpoints
    CreateSvixEndpointUseCase,
    DeleteSvixEndpointUseCase,
    SendWebhookMessageUseCase,
    // Use Cases - Event Types
    CreateEventTypeUseCase,
    ListEventTypesUseCase,
    UpdateEventTypeUseCase,
    DeleteEventTypeUseCase,

    // Repositories
    {
      provide: WEBHOOK_SUBSCRIPTION_REPOSITORY,
      useClass: WebhookSubscriptionRepositoryImpl,
    },

    // Services
    {
      provide: SVIX_SERVICE,
      useClass: SvixService,
    },
  ],
  exports: [
    WEBHOOK_SUBSCRIPTION_REPOSITORY,
    SVIX_SERVICE,
    CreateWebhookSubscriptionUseCase,
    GetWebhookSubscriptionUseCase,
    ListWebhookSubscriptionsUseCase,
    UpdateWebhookSubscriptionUseCase,
    DeleteWebhookSubscriptionUseCase,
  ],
})
export class OutboundWebhooksModule {}
