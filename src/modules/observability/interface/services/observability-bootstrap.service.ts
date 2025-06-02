import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObservabilityService } from './observability.service';
import { ObservabilityConfigType } from '../../infrastructure/config/observability.config';

@Injectable()
export class ObservabilityBootstrapService
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const config =
      this.configService.get<ObservabilityConfigType>('observability');

    if (!config) {
      console.warn(
        'Observability configuration not found. Skipping initialization.',
      );
      return;
    }

    try {
      await this.observabilityService.initialize({
        serviceName: config.serviceName,
        serviceVersion: config.serviceVersion,
        environment: config.environment,
        otelEndpoint: config.otelEndpoint,
        otelHeaders: config.otelHeaders,
        enableDebugLogs: config.enableDebugLogs,
        samplingRatio: config.samplingRatio,
        enabledInstrumentations: config.enabledInstrumentations,
        customAttributes: config.customAttributes,
      });

      console.log(
        `✅ OpenTelemetry observability initialized for service: ${config.serviceName}`,
      );
      console.log(`📊 Traces will be sent to: ${config.otelEndpoint}`);
      console.log(`🔍 Sampling ratio: ${config.samplingRatio * 100}%`);
    } catch (error) {
      console.error(
        '❌ Failed to initialize OpenTelemetry observability:',
        error,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.observabilityService.flush();
      await this.observabilityService.shutdown();
      console.log('✅ OpenTelemetry observability shutdown completed');
    } catch (error) {
      console.error('❌ Error during observability shutdown:', error);
    }
  }
}
