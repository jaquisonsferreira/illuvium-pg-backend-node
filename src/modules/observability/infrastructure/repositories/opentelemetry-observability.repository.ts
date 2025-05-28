import { Injectable } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

import { ObservabilityRepository } from '../../domain/repositories/observability.repository.interface';
import { ObservabilityConfig } from '../../domain/entities/observability-config.entity';
import { TraceContext } from '../../domain/entities/trace-context.entity';
import { Metric, MetricType } from '../../domain/entities/metric.entity';

@Injectable()
export class OpenTelemetryObservabilityRepository
  implements ObservabilityRepository
{
  private sdk: NodeSDK | null = null;
  private tracer: any = null;
  private meter: any = null;
  private initialized = false;

  initializeTracing(config: ObservabilityConfig): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    const traceConfig = config.toTraceConfig();

    const exporterOptions = {
      url: traceConfig.endpoint,
      headers: traceConfig.headers,
    };

    const traceExporter = new OTLPTraceExporter(exporterOptions);

    this.sdk = new NodeSDK({
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 10000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          ...config.getInstrumentationConfig(),
        }),
      ],
      resource: resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: traceConfig.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: traceConfig.serviceVersion,
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: traceConfig.environment,
      }),
    });

    this.sdk.start();

    this.tracer = trace.getTracer(
      traceConfig.serviceName,
      traceConfig.serviceVersion,
    );
    this.meter = metrics.getMeter(
      traceConfig.serviceName,
      traceConfig.serviceVersion,
    );
    this.initialized = true;

    return Promise.resolve();
  }

  createSpan(
    operationName: string,
    parentContext?: TraceContext,
  ): Promise<TraceContext> {
    if (!this.tracer) {
      throw new Error(
        'OpenTelemetry not initialized. Call initializeTracing first.',
      );
    }

    const span = this.tracer.startSpan(operationName);
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;

    const context = new TraceContext(
      traceId,
      spanId,
      parentContext?.spanId,
      operationName,
      Date.now(),
      {},
      {},
    );

    return Promise.resolve(context);
  }

  finishSpan(
    context: TraceContext,
    attributes?: Record<string, any>,
  ): Promise<void> {
    const activeSpan = trace.getActiveSpan();

    if (activeSpan) {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          activeSpan.setAttribute(key, value);
        });
      }

      Object.entries(context.attributes).forEach(([key, value]) => {
        activeSpan.setAttribute(key, value);
      });

      activeSpan.end();
    }

    return Promise.resolve();
  }

  recordMetric(metric: Metric): Promise<void> {
    if (!this.meter) {
      throw new Error(
        'OpenTelemetry not initialized. Call initializeTracing first.',
      );
    }

    const metricData = metric.toOpenTelemetryFormat();

    switch (metric.type) {
      case MetricType.COUNTER: {
        const counter = this.meter.createCounter(metricData.name, {
          description: metricData.description,
          unit: metricData.unit,
        });
        counter.add(metricData.value, metricData.labels);
        break;
      }

      case MetricType.GAUGE: {
        const gauge = this.meter.createUpDownCounter(metricData.name, {
          description: metricData.description,
          unit: metricData.unit,
        });
        gauge.add(metricData.value, metricData.labels);
        break;
      }

      case MetricType.HISTOGRAM: {
        const histogram = this.meter.createHistogram(metricData.name, {
          description: metricData.description,
          unit: metricData.unit,
        });
        histogram.record(metricData.value, metricData.labels);
        break;
      }

      default:
        throw new Error(`Unsupported metric type: ${metric.type}`);
    }

    return Promise.resolve();
  }

  recordException(error: Error): Promise<void> {
    const activeSpan = trace.getActiveSpan();

    if (activeSpan) {
      activeSpan.recordException(error);
      activeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }

    return Promise.resolve();
  }

  async flush(): Promise<void> {
    const provider = trace.getTracerProvider();
    if (provider && 'forceFlush' in provider) {
      await (provider as any).forceFlush();
    }
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.initialized = false;
      this.tracer = null;
      this.meter = null;
      this.sdk = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getActiveSpan(): TraceContext | null {
    const activeSpan = trace.getActiveSpan();

    if (!activeSpan) {
      return null;
    }

    const spanContext = activeSpan.spanContext();

    return new TraceContext(
      spanContext.traceId,
      spanContext.spanId,
      undefined,
      'active-span',
      Date.now(),
      {},
      {},
    );
  }
}
