import { ObservabilityConfig } from '../entities/observability-config.entity';
import { TraceContext } from '../entities/trace-context.entity';
import { Metric } from '../entities/metric.entity';

export interface ObservabilityRepository {
  initializeTracing(config: ObservabilityConfig): Promise<void>;

  createSpan(
    operationName: string,
    parentContext?: TraceContext,
  ): Promise<TraceContext>;

  finishSpan(
    context: TraceContext,
    attributes?: Record<string, any>,
  ): Promise<void>;

  recordMetric(metric: Metric): Promise<void>;

  recordException(error: Error, context?: TraceContext): Promise<void>;

  flush(): Promise<void>;

  shutdown(): Promise<void>;

  isInitialized(): boolean;

  getActiveSpan(): TraceContext | null;
}
