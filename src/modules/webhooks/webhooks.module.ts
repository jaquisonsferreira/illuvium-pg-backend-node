import { Module } from '@nestjs/common';
import { WebhooksController } from './interface/controllers/webhooks.controller';
import { ProcessPrivyWebhookUseCase } from './application/use-cases/process-privy-webhook.use-case';
import { WebhookSignatureValidationService } from './infrastructure/services/webhook-signature-validation.service';
import { EventBridgeService } from './infrastructure/services/event-bridge.service';
import { PrivyWebhookMapperService } from './infrastructure/services/privy-webhook-mapper.service';
import { HealthController } from './interface/controllers/health.controller';

@Module({
  controllers: [WebhooksController, HealthController],
  providers: [
    ProcessPrivyWebhookUseCase,
    WebhookSignatureValidationService,
    EventBridgeService,
    PrivyWebhookMapperService,
  ],
  exports: [ProcessPrivyWebhookUseCase, WebhookSignatureValidationService],
})
export class WebhooksModule {}
