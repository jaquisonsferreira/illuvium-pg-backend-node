import { Inject, Injectable } from '@nestjs/common';
import { SVIX_SERVICE } from '../../constants';
import { SvixService } from '../services/svix.service';

export interface DeleteSvixEndpointDto {
  applicationId: string;
  endpointId: string;
}

@Injectable()
export class DeleteSvixEndpointUseCase {
  constructor(
    @Inject(SVIX_SERVICE)
    private readonly svixService: SvixService,
  ) {}

  async execute(dto: DeleteSvixEndpointDto): Promise<void> {
    await this.svixService.deleteEndpoint(dto.applicationId, dto.endpointId);
  }
}
