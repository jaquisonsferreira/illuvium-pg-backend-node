import { Inject, Injectable } from '@nestjs/common';
import { SVIX_SERVICE } from '../../constants';
import { SvixService, SvixEndpoint } from '../services/svix.service';
import { WebhookEventType } from '../../domain/entities/webhook-subscription.entity';

export interface CreateSvixEndpointDto {
  applicationId: string;
  url: string;
  eventTypes: WebhookEventType[];
}

@Injectable()
export class CreateSvixEndpointUseCase {
  constructor(
    @Inject(SVIX_SERVICE)
    private readonly svixService: SvixService,
  ) {}

  async execute(dto: CreateSvixEndpointDto): Promise<SvixEndpoint> {
    return this.svixService.createEndpoint(
      dto.applicationId,
      dto.url,
      dto.eventTypes,
    );
  }
}
