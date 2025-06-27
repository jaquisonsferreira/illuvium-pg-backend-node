import { Injectable, Inject } from '@nestjs/common';
import { SvixService, SvixEventType } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

@Injectable()
export class ListEventTypesUseCase {
  constructor(
    @Inject(SVIX_SERVICE) private readonly svixService: SvixService,
  ) {}

  async execute(): Promise<SvixEventType[]> {
    return this.svixService.listEventTypes();
  }
}
