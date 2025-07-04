import { Module } from '@nestjs/common';
import { WebhooksController } from './interface/controllers/webhooks.controller';
import { ProcessPrivyWebhookUseCase } from './application/use-cases/process-privy-webhook.use-case';
import { ProcessThirdwebWebhookUseCase } from './application/use-cases/process-thirdweb-webhook.use-case';
import { WebhookSignatureValidationService } from './infrastructure/services/webhook-signature-validation.service';
import { EventBridgeService } from './infrastructure/services/event-bridge.service';
import { PrivyWebhookMapperService } from './infrastructure/services/privy-webhook-mapper.service';
import { ThirdwebWebhookMapperService } from './infrastructure/services/thirdweb-webhook-mapper.service';
import { HealthController } from './interface/controllers/health.controller';

@Module({
  controllers: [WebhooksController, HealthController],
  providers: [
    ProcessPrivyWebhookUseCase,
    ProcessThirdwebWebhookUseCase,
    WebhookSignatureValidationService,
    EventBridgeService,
    PrivyWebhookMapperService,
    ThirdwebWebhookMapperService,
  ],
  exports: [
    ProcessPrivyWebhookUseCase,
    ProcessThirdwebWebhookUseCase,
    WebhookSignatureValidationService,
  ],
})
export class WebhooksModule {}
