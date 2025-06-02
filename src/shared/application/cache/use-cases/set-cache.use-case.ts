import { Injectable, Inject } from '@nestjs/common';
import { CacheRepositoryInterface } from '../../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../../domain/cache/cache-key.value-object';
import { CacheValue } from '../../../domain/cache/cache-value.value-object';
import { SetCacheDto } from '../dtos/cache.dtos';
import { CACHE_REPOSITORY_TOKEN } from '../../../infrastructure/cache/contants';

@Injectable()
export class SetCacheUseCase {
  constructor(
    @Inject(CACHE_REPOSITORY_TOKEN)
    private readonly cacheRepository: CacheRepositoryInterface,
  ) {}

  async execute<T>(dto: SetCacheDto): Promise<void> {
    const keyString = dto.namespace ? `${dto.namespace}:${dto.key}` : dto.key;

    const cacheKey = new CacheKey(keyString);
    const cacheValue = new CacheValue<T>(dto.value, dto.ttl);

    await this.cacheRepository.set(cacheKey, cacheValue);
  }
}
