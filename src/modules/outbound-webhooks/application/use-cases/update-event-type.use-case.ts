import { Injectable, Inject } from '@nestjs/common';
import { SvixService, SvixEventType } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

export interface UpdateEventTypeDto {
  name: string;
  description?: string;
  archived?: boolean;
}

@Injectable()
export class UpdateEventTypeUseCase {
  constructor(
    @Inject(SVIX_SERVICE) private readonly svixService: SvixService,
  ) {}

  async execute(dto: UpdateEventTypeDto): Promise<SvixEventType> {
    return this.svixService.updateEventType(
      dto.name,
      dto.description,
      dto.archived,
    );
  }
}
