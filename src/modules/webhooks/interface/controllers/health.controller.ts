import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ProcessThirdwebWebhookUseCase } from '../../application/use-cases/process-thirdweb-webhook.use-case';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  version?: string;
  details: {
    webhooks: {
      healthy: boolean;
      details: Record<string, boolean>;
    };
    environment: {
      nodeEnv: string;
      hasPrivySecret: boolean;
      hasAwsCredentials: boolean;
      eventBusName?: string;
    };
  };
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly processThirdwebWebhookUseCase: ProcessThirdwebWebhookUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<HealthCheckResponse> {
    const startTime = Date.now();

    try {
      const webhookHealth =
        await this.processThirdwebWebhookUseCase.healthCheck();

      const environment = {
        nodeEnv: process.env.NODE_ENV || 'development',
        hasPrivySecret: !!process.env.PRIVY_WEBHOOK_SECRET,
        hasAwsCredentials: !!(
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ),
        eventBusName: process.env.AWS_EVENTBRIDGE_BUS_NAME,
      };

      const isHealthy =
        webhookHealth.healthy &&
        environment.hasPrivySecret &&
        environment.hasAwsCredentials;

      const response: HealthCheckResponse = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'webhooks-service',
        version: process.env.npm_package_version,
        details: {
          webhooks: webhookHealth,
          environment,
        },
      };

      const checkTime = Date.now() - startTime;

      this.logger.log('Health check completed', {
        status: response.status,
        checkTimeMs: checkTime,
        webhookHealthy: webhookHealth.healthy,
      });

      return response;
    } catch (error) {
      const checkTime = Date.now() - startTime;

      this.logger.error('Health check failed', {
        error: error.message,
        checkTimeMs: checkTime,
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'webhooks-service',
        details: {
          webhooks: {
            healthy: false,
            details: { error: false },
          },
          environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            hasPrivySecret: !!process.env.PRIVY_WEBHOOK_SECRET,
            hasAwsCredentials: !!(
              process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ),
            eventBusName: process.env.AWS_EVENTBRIDGE_BUS_NAME,
          },
        },
      };
    }
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readinessCheck(): Promise<{ ready: boolean; timestamp: string }> {
    try {
      const hasRequiredEnvVars = !!(
        process.env.PRIVY_WEBHOOK_SECRET &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY
      );

      return {
        ready: hasRequiredEnvVars,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Readiness check failed', error.message);
      return {
        ready: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  async livenessCheck(): Promise<{ alive: boolean; timestamp: string }> {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }
}
