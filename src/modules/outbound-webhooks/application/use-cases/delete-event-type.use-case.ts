import { Injectable, Inject } from '@nestjs/common';
import { SvixService } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

export interface DeleteEventTypeDto {
  name: string;
}

@Injectable()
export class DeleteEventTypeUseCase {
  constructor(
    @Inject(SVIX_SERVICE) private readonly svixService: SvixService,
  ) {}

  async execute(dto: DeleteEventTypeDto): Promise<void> {
    return this.svixService.deleteEventType(dto.name);
  }
}
