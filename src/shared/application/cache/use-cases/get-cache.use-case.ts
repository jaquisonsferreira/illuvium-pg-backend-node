import { Injectable, Inject } from '@nestjs/common';
import { CacheRepositoryInterface } from '../../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../../domain/cache/cache-key.value-object';
import { GetCacheDto } from '../dtos/cache.dtos';
import { CACHE_REPOSITORY_TOKEN } from '../../../infrastructure/cache/contants';

@Injectable()
export class GetCacheUseCase {
  constructor(
    @Inject(CACHE_REPOSITORY_TOKEN)
    private readonly cacheRepository: CacheRepositoryInterface,
  ) {}

  async execute<T>(dto: GetCacheDto): Promise<T | null> {
    const keyString = dto.namespace ? `${dto.namespace}:${dto.key}` : dto.key;

    const cacheKey = new CacheKey(keyString);
    const cacheValue = await this.cacheRepository.get<T>(cacheKey);

    if (!cacheValue) {
      return null;
    }

    if (cacheValue.isExpired()) {
      await this.cacheRepository.delete(cacheKey);
      return null;
    }

    return cacheValue.getData();
  }
}
