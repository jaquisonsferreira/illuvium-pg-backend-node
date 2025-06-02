import { Injectable, Inject } from '@nestjs/common';
import { ObservabilityRepository } from '../../domain/repositories/observability.repository.interface';
import { Metric, MetricType } from '../../domain/entities/metric.entity';
import { OBSERVABILITY_REPOSITORY_TOKEN } from '../../domain/tokens/observability.tokens';

export interface RecordMetricInput {
  name: string;
  type: MetricType;
  value: number;
  description?: string;
  unit?: string;
  labels?: Record<string, string>;
}

@Injectable()
export class RecordMetricUseCase {
  constructor(
    @Inject(OBSERVABILITY_REPOSITORY_TOKEN)
    private readonly observabilityRepository: ObservabilityRepository,
  ) {}

  async execute(input: RecordMetricInput): Promise<void> {
    const metric = new Metric(
      input.name,
      input.type,
      input.value,
      input.description,
      input.unit,
      input.labels,
    );

    await this.observabilityRepository.recordMetric(metric);
  }
}
