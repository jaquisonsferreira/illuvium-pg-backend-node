import { Injectable, Inject } from '@nestjs/common';
import { SvixService, SvixEventType } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

export interface CreateEventTypeDto {
  name: string;
  description?: string;
}

@Injectable()
export class CreateEventTypeUseCase {
  constructor(
    @Inject(SVIX_SERVICE) private readonly svixService: SvixService,
  ) {}

  async execute(dto: CreateEventTypeDto): Promise<SvixEventType> {
    return this.svixService.createEventType(dto.name, dto.description);
  }
}
