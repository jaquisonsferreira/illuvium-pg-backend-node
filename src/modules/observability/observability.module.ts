import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import observabilityConfig from './infrastructure/config/observability.config';
import { InitializeObservabilityUseCase } from './application/use-cases/initialize-observability.use-case';
import { RecordMetricUseCase } from './application/use-cases/record-metric.use-case';
import { CreateSpanUseCase } from './application/use-cases/create-span.use-case';
import { OpenTelemetryObservabilityRepository } from './infrastructure/repositories/opentelemetry-observability.repository';
import { ObservabilityService } from './interface/services/observability.service';
import { ObservabilityBootstrapService } from './interface/services/observability-bootstrap.service';
import { TracingInterceptor } from './interface/interceptors/tracing.interceptor';
import { OBSERVABILITY_REPOSITORY_TOKEN } from './domain/tokens/observability.tokens';
export { Observable } from './interface/decorators/observable.decorator';
export type { ObservableOptions } from './interface/decorators/observable.decorator';

@Module({
  imports: [ConfigModule.forFeature(observabilityConfig)],
  providers: [
    // Use Cases
    InitializeObservabilityUseCase,
    RecordMetricUseCase,
    CreateSpanUseCase,

    // Repositories
    {
      provide: OBSERVABILITY_REPOSITORY_TOKEN,
      useClass: OpenTelemetryObservabilityRepository,
    },

    // Services
    ObservabilityService,
    ObservabilityBootstrapService,

    // Interceptors
    TracingInterceptor,
  ],
  exports: [
    ObservabilityService,
    ObservabilityBootstrapService,
    TracingInterceptor,
    InitializeObservabilityUseCase,
    RecordMetricUseCase,
    CreateSpanUseCase,
  ],
})
export class ObservabilityModule {}
