import { registerAs } from '@nestjs/config';

export interface ObservabilityConfigType {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otelEndpoint: string;
  otelHeaders?: Record<string, string>;
  enableDebugLogs: boolean;
  samplingRatio: number;
  enabledInstrumentations: string[];
  customAttributes: Record<string, string>;
}

export default registerAs(
  'observability',
  (): ObservabilityConfigType => ({
    serviceName: process.env.OTEL_SERVICE_NAME || 'illuvium-api',
    serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    otelEndpoint:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://localhost:4318/v1/traces',
    otelHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : undefined,
    enableDebugLogs: process.env.OTEL_LOG_LEVEL === 'debug',
    samplingRatio: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0'),
    enabledInstrumentations: process.env.OTEL_ENABLED_INSTRUMENTATIONS?.split(
      ',',
    ) || ['http', 'express', 'nestjs-core', 'pg', 'redis'],
    customAttributes: {
      'service.namespace': process.env.SERVICE_NAMESPACE || 'illuvium',
      'deployment.environment': process.env.DEPLOYMENT_ENVIRONMENT || 'local',
      'service.instance.id': process.env.HOSTNAME || 'unknown',
    },
  }),
);
