import { Injectable, Inject } from '@nestjs/common';
import { SetCacheUseCase } from './use-cases/set-cache.use-case';
import { GetCacheUseCase } from './use-cases/get-cache.use-case';
import { DeleteCacheUseCase } from './use-cases/delete-cache.use-case';
import { CacheRepositoryInterface } from '../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../domain/cache/cache-key.value-object';
import { CacheValue } from '../../domain/cache/cache-value.value-object';
import {
  SetCacheDto,
  GetCacheDto,
  DeleteCacheDto,
  CacheHealthDto,
} from './dtos/cache.dtos';
import { CACHE_REPOSITORY_TOKEN } from '../../infrastructure/cache/contants';

@Injectable()
export class CacheService {
  constructor(
    private readonly setCacheUseCase: SetCacheUseCase,
    private readonly getCacheUseCase: GetCacheUseCase,
    private readonly deleteCacheUseCase: DeleteCacheUseCase,
    @Inject(CACHE_REPOSITORY_TOKEN)
    private readonly cacheRepository: CacheRepositoryInterface,
  ) {}

  async set<T = any>(
    key: string,
    value: T,
    ttl?: number,
    namespace?: string,
  ): Promise<void> {
    const dto: SetCacheDto = { key, value, ttl, namespace };
    return this.setCacheUseCase.execute<T>(dto);
  }

  async get<T = any>(key: string, namespace?: string): Promise<T | null> {
    const dto: GetCacheDto = { key, namespace };
    return this.getCacheUseCase.execute<T>(dto);
  }

  async delete(key: string, namespace?: string): Promise<boolean> {
    const dto: DeleteCacheDto = { key, namespace };
    return this.deleteCacheUseCase.execute(dto);
  }

  async has(key: string, namespace?: string): Promise<boolean> {
    const keyString = namespace ? `${namespace}:${key}` : key;
    const cacheKey = new CacheKey(keyString);
    return this.cacheRepository.exists(cacheKey);
  }

  async increment(key: string, value = 1, namespace?: string): Promise<number> {
    const keyString = namespace ? `${namespace}:${key}` : key;
    const cacheKey = new CacheKey(keyString);
    return this.cacheRepository.increment(cacheKey, value);
  }

  async decrement(key: string, value = 1, namespace?: string): Promise<number> {
    const keyString = namespace ? `${namespace}:${key}` : key;
    const cacheKey = new CacheKey(keyString);
    return this.cacheRepository.decrement(cacheKey, value);
  }

  async getKeys(pattern: string, namespace?: string): Promise<string[]> {
    const searchPattern = namespace ? `${namespace}:${pattern}` : pattern;
    const keys = await this.cacheRepository.getKeys(searchPattern);
    return keys.map((key) => key.toString());
  }

  async getWithPattern<T = any>(
    pattern: string,
    namespace?: string,
  ): Promise<Record<string, T>> {
    const searchPattern = namespace ? `${namespace}:${pattern}` : pattern;
    const entries = await this.cacheRepository.getWithPattern<T>(searchPattern);
    const result: Record<string, T> = {};

    for (const [key, value] of entries) {
      result[key] = value.getData();
    }

    return result;
  }

  async setMultiple<T = any>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
    namespace?: string,
  ): Promise<void> {
    const cacheEntries = new Map<CacheKey, CacheValue<T>>();

    for (const entry of entries) {
      const keyString = namespace ? `${namespace}:${entry.key}` : entry.key;
      const cacheKey = new CacheKey(keyString);
      const cacheValue = new CacheValue<T>(entry.value, entry.ttl);
      cacheEntries.set(cacheKey, cacheValue);
    }

    return this.cacheRepository.setMultiple(cacheEntries);
  }

  async getMultiple<T = any>(
    keys: string[],
    namespace?: string,
  ): Promise<Record<string, T>> {
    const cacheKeys = keys.map((key) => {
      const keyString = namespace ? `${namespace}:${key}` : key;
      return new CacheKey(keyString);
    });

    const entries = await this.cacheRepository.getMultiple<T>(cacheKeys);
    const result: Record<string, T> = {};

    for (const [key, value] of entries) {
      const originalKey =
        namespace && key.startsWith(`${namespace}:`)
          ? key.substring(`${namespace}:`.length)
          : key;
      result[originalKey] = value.getData();
    }

    return result;
  }

  async deleteMultiple(keys: string[], namespace?: string): Promise<number> {
    const cacheKeys = keys.map((key) => {
      const keyString = namespace ? `${namespace}:${key}` : key;
      return new CacheKey(keyString);
    });

    return this.cacheRepository.deleteMultiple(cacheKeys);
  }

  async clear(): Promise<void> {
    return this.cacheRepository.clear();
  }

  async clearNamespace(namespace: string): Promise<number> {
    const pattern = `${namespace}:*`;
    const keys = await this.cacheRepository.getKeys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    return this.cacheRepository.deleteMultiple(keys);
  }

  async flushDatabase(): Promise<void> {
    return this.cacheRepository.flushDatabase();
  }

  async ping(): Promise<string> {
    return this.cacheRepository.ping();
  }

  async getHealth(): Promise<CacheHealthDto> {
    try {
      const startTime = Date.now();
      const pingResult = await this.ping();
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: pingResult === 'PONG',
        status: 'connected',
        responseTime,
      };
    } catch (error) {
      return {
        isHealthy: false,
        status: 'error',
        message: error.message,
        responseTime: -1,
      };
    }
  }

  wrap<T>(
    fn: () => Promise<T>,
    key: string,
    ttl: number = 3600,
    namespace?: string,
  ): Promise<T> {
    return this.remember(key, fn, ttl, namespace);
  }

  async remember<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 3600,
    namespace?: string,
  ): Promise<T> {
    const cached = await this.get<T>(key, namespace);

    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl, namespace);

    return result;
  }

  async rememberForever<T>(
    key: string,
    fn: () => Promise<T>,
    namespace?: string,
  ): Promise<T> {
    return this.remember(key, fn, undefined, namespace);
  }
}
