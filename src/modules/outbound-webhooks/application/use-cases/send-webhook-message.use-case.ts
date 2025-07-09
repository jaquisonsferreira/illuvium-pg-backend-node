import { Inject, Injectable } from '@nestjs/common';
import { SVIX_SERVICE } from '../../constants';
import { SvixService, SvixMessage } from '../services/svix.service';

export interface SendWebhookMessageDto {
  applicationId: string;
  eventType: string;
  payload: Record<string, any>;
}

@Injectable()
export class SendWebhookMessageUseCase {
  constructor(
    @Inject(SVIX_SERVICE)
    private readonly svixService: SvixService,
  ) {}

  async execute(dto: SendWebhookMessageDto): Promise<void> {
    const message: SvixMessage = {
      eventType: dto.eventType,
      payload: dto.payload,
    };

    await this.svixService.sendMessage(dto.applicationId, message);
  }
}
