import { Module } from '@nestjs/common';
import { WebhooksController } from './interface/controllers/webhooks.controller';

import { ProcessThirdwebWebhookUseCase } from './application/use-cases/process-thirdweb-webhook.use-case';
import { WebhookSignatureValidationService } from './infrastructure/services/webhook-signature-validation.service';
import { EventBridgeService } from './infrastructure/services/event-bridge.service';

import { ThirdwebWebhookMapperService } from './infrastructure/services/thirdweb-webhook-mapper.service';
import { HealthController } from './interface/controllers/health.controller';

@Module({
  controllers: [WebhooksController, HealthController],
  providers: [
    ProcessThirdwebWebhookUseCase,
    WebhookSignatureValidationService,
    EventBridgeService,

    ThirdwebWebhookMapperService,
  ],
  exports: [ProcessThirdwebWebhookUseCase, WebhookSignatureValidationService],
})
export class WebhooksModule {}
