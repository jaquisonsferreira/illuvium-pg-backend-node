import { Injectable, Inject } from '@nestjs/common';
import { ObservabilityRepository } from '../../domain/repositories/observability.repository.interface';
import { TraceContext } from '../../domain/entities/trace-context.entity';
import { OBSERVABILITY_REPOSITORY_TOKEN } from '../../domain/tokens/observability.tokens';

export interface CreateSpanInput {
  operationName: string;
  parentContext?: TraceContext;
  attributes?: Record<string, any>;
}

export interface CreateSpanOutput {
  context: TraceContext;
}

@Injectable()
export class CreateSpanUseCase {
  constructor(
    @Inject(OBSERVABILITY_REPOSITORY_TOKEN)
    private readonly observabilityRepository: ObservabilityRepository,
  ) {}

  async execute(input: CreateSpanInput): Promise<CreateSpanOutput> {
    const context = await this.observabilityRepository.createSpan(
      input.operationName,
      input.parentContext,
    );

    let enrichedContext = context;
    if (input.attributes) {
      Object.entries(input.attributes).forEach(([key, value]) => {
        enrichedContext = enrichedContext.addAttribute(key, value);
      });
    }

    return { context: enrichedContext };
  }
}
