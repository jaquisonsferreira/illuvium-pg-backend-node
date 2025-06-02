import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from './observability.module';
import { ObservabilityService } from './interface/services/observability.service';
import { ObservabilityBootstrapService } from './interface/services/observability-bootstrap.service';
import { TracingInterceptor } from './interface/interceptors/tracing.interceptor';
import { InitializeObservabilityUseCase } from './application/use-cases/initialize-observability.use-case';
import { RecordMetricUseCase } from './application/use-cases/record-metric.use-case';
import { CreateSpanUseCase } from './application/use-cases/create-span.use-case';
import observabilityConfig from './infrastructure/config/observability.config';

describe('ObservabilityModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forFeature(observabilityConfig),
        ObservabilityModule,
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ObservabilityService', () => {
    const service = module.get<ObservabilityService>(ObservabilityService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ObservabilityService);
  });

  it('should provide ObservabilityBootstrapService', () => {
    const service = module.get<ObservabilityBootstrapService>(
      ObservabilityBootstrapService,
    );
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ObservabilityBootstrapService);
  });

  it('should provide TracingInterceptor', () => {
    const interceptor = module.get<TracingInterceptor>(TracingInterceptor);
    expect(interceptor).toBeDefined();
    expect(interceptor).toBeInstanceOf(TracingInterceptor);
  });

  it('should have all use cases available', () => {
    const initUseCase = module.get(InitializeObservabilityUseCase);
    const recordUseCase = module.get(RecordMetricUseCase);
    const createUseCase = module.get(CreateSpanUseCase);

    expect(initUseCase).toBeDefined();
    expect(recordUseCase).toBeDefined();
    expect(createUseCase).toBeDefined();
  });
});
