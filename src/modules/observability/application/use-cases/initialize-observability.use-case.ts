import { Injectable, Inject } from '@nestjs/common';
import { ObservabilityRepository } from '../../domain/repositories/observability.repository.interface';
import { ObservabilityConfig } from '../../domain/entities/observability-config.entity';
import { OBSERVABILITY_REPOSITORY_TOKEN } from '../../domain/tokens/observability.tokens';

export interface InitializeObservabilityInput {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  sigNozEndpoint: string;
  sigNozToken?: string;
  enableDebugLogs?: boolean;
  samplingRatio?: number;
  enabledInstrumentations?: string[];
  customAttributes?: Record<string, string>;
}

@Injectable()
export class InitializeObservabilityUseCase {
  constructor(
    @Inject(OBSERVABILITY_REPOSITORY_TOKEN)
    private readonly observabilityRepository: ObservabilityRepository,
  ) {}

  async execute(input: InitializeObservabilityInput): Promise<void> {
    const config = new ObservabilityConfig(
      input.serviceName,
      input.serviceVersion,
      input.environment,
      input.sigNozEndpoint,
      input.sigNozToken,
      input.enableDebugLogs ?? false,
      input.samplingRatio ?? 1.0,
      input.enabledInstrumentations ?? [],
      input.customAttributes ?? {},
    );

    await this.observabilityRepository.initializeTracing(config);
  }
}
