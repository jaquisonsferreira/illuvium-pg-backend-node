import { Injectable, Inject } from '@nestjs/common';
import {
  InitializeObservabilityUseCase,
  InitializeObservabilityInput,
} from '../../application/use-cases/initialize-observability.use-case';
import {
  RecordMetricUseCase,
  RecordMetricInput,
} from '../../application/use-cases/record-metric.use-case';
import {
  CreateSpanUseCase,
  CreateSpanInput,
  CreateSpanOutput,
} from '../../application/use-cases/create-span.use-case';
import { ObservabilityRepository } from '../../domain/repositories/observability.repository.interface';
import { TraceContext } from '../../domain/entities/trace-context.entity';
import { OBSERVABILITY_REPOSITORY_TOKEN } from '../../domain/tokens/observability.tokens';

@Injectable()
export class ObservabilityService {
  constructor(
    private readonly initializeObservabilityUseCase: InitializeObservabilityUseCase,
    private readonly recordMetricUseCase: RecordMetricUseCase,
    private readonly createSpanUseCase: CreateSpanUseCase,
    @Inject(OBSERVABILITY_REPOSITORY_TOKEN)
    private readonly observabilityRepository: ObservabilityRepository,
  ) {}

  async initialize(input: InitializeObservabilityInput): Promise<void> {
    return this.initializeObservabilityUseCase.execute(input);
  }

  async recordMetric(input: RecordMetricInput): Promise<void> {
    return this.recordMetricUseCase.execute(input);
  }

  async createSpan(input: CreateSpanInput): Promise<CreateSpanOutput> {
    return this.createSpanUseCase.execute(input);
  }

  async finishSpan(
    context: TraceContext,
    attributes?: Record<string, any>,
  ): Promise<void> {
    return this.observabilityRepository.finishSpan(context, attributes);
  }

  async recordException(error: Error, context?: TraceContext): Promise<void> {
    return this.observabilityRepository.recordException(error, context);
  }

  getActiveSpan(): TraceContext | null {
    return this.observabilityRepository.getActiveSpan();
  }

  isInitialized(): boolean {
    return this.observabilityRepository.isInitialized();
  }

  async flush(): Promise<void> {
    return this.observabilityRepository.flush();
  }

  async shutdown(): Promise<void> {
    return this.observabilityRepository.shutdown();
  }
}
