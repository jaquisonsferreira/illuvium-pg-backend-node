import { Injectable, Inject } from '@nestjs/common';
import { CacheRepositoryInterface } from '../../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../../domain/cache/cache-key.value-object';
import { DeleteCacheDto } from '../dtos/cache.dtos';
import { CACHE_REPOSITORY_TOKEN } from '../../../infrastructure/cache/contants';

@Injectable()
export class DeleteCacheUseCase {
  constructor(
    @Inject(CACHE_REPOSITORY_TOKEN)
    private readonly cacheRepository: CacheRepositoryInterface,
  ) {}

  async execute(dto: DeleteCacheDto): Promise<boolean> {
    const keyString = dto.namespace ? `${dto.namespace}:${dto.key}` : dto.key;

    const cacheKey = new CacheKey(keyString);
    return await this.cacheRepository.delete(cacheKey);
  }
}
