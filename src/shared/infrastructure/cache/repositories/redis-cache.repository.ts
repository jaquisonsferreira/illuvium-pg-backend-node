import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';
import { CacheRepositoryInterface } from '../../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../../domain/cache/cache-key.value-object';
import { CacheValue } from '../../../domain/cache/cache-value.value-object';
import { CacheConfigService } from '../config/cache.config';

@Injectable()
export class RedisCacheRepository
  implements CacheRepositoryInterface, OnModuleInit, OnModuleDestroy
{
  private client: RedisClient;
  private readonly logger = new Logger(RedisCacheRepository.name);

  constructor(private readonly configService: CacheConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const config = this.configService.getConfig();

      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.database,
        keyPrefix: config.keyPrefix,
        enableAutoPipelining: true,
        maxRetriesPerRequest: config.maxRetries,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      await this.client.ping();
      this.logger.log(`Connected to Redis at ${config.host}:${config.port}`);
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    }
  }

  async set<T>(key: CacheKey, value: CacheValue<T>): Promise<void> {
    try {
      const serializedValue = value.serialize();
      const ttl = value.getTtl();

      if (ttl) {
        await this.client.set(key.toString(), serializedValue, 'EX', ttl);
      } else {
        await this.client.set(key.toString(), serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key: ${key.toString()}`, error);
      throw error;
    }
  }

  async get<T>(key: CacheKey): Promise<CacheValue<T> | null> {
    try {
      const result = await this.client.get(key.toString());

      if (!result) {
        return null;
      }

      return CacheValue.deserialize<T>(result);
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key.toString()}`, error);
      throw error;
    }
  }

  async delete(key: CacheKey): Promise<boolean> {
    try {
      const result = await this.client.del(key.toString());
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key.toString()}`, error);
      throw error;
    }
  }

  async exists(key: CacheKey): Promise<boolean> {
    try {
      const result = await this.client.exists(key.toString());
      return result > 0;
    } catch (error) {
      this.logger.error(
        `Failed to check cache key existence: ${key.toString()}`,
        error,
      );
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      throw error;
    }
  }

  async increment(key: CacheKey, value: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key.toString(), value);
    } catch (error) {
      this.logger.error(
        `Failed to increment cache key: ${key.toString()}`,
        error,
      );
      throw error;
    }
  }

  async decrement(key: CacheKey, value: number = 1): Promise<number> {
    try {
      return await this.client.decrby(key.toString(), value);
    } catch (error) {
      this.logger.error(
        `Failed to decrement cache key: ${key.toString()}`,
        error,
      );
      throw error;
    }
  }

  async getKeys(pattern: string): Promise<CacheKey[]> {
    try {
      const keys = await this.client.keys(pattern);
      return keys.map(
        (key) =>
          new CacheKey(
            key.replace(this.configService.getConfig().keyPrefix || '', ''),
          ),
      );
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern: ${pattern}`, error);
      throw error;
    }
  }

  async getWithPattern<T>(
    pattern: string,
  ): Promise<Map<string, CacheValue<T>>> {
    try {
      const keys = await this.client.keys(pattern);
      const result = new Map<string, CacheValue<T>>();

      if (keys.length === 0) {
        return result;
      }

      const values = await this.client.mget(...keys);

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value !== null) {
          result.set(keys[i], CacheValue.deserialize<T>(value));
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get values with pattern: ${pattern}`, error);
      throw error;
    }
  }

  async setMultiple<T>(entries: Map<CacheKey, CacheValue<T>>): Promise<void> {
    try {
      const pipeline = this.client.pipeline();

      for (const [key, value] of entries) {
        const serializedValue = value.serialize();
        const ttl = value.getTtl();

        if (ttl) {
          pipeline.set(key.toString(), serializedValue, 'EX', ttl);
        } else {
          pipeline.set(key.toString(), serializedValue);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to set multiple cache entries', error);
      throw error;
    }
  }

  async getMultiple<T>(keys: CacheKey[]): Promise<Map<string, CacheValue<T>>> {
    try {
      const keyStrings = keys.map((key) => key.toString());
      const values = await this.client.mget(...keyStrings);
      const result = new Map<string, CacheValue<T>>();

      for (let i = 0; i < keyStrings.length; i++) {
        const value = values[i];
        if (value !== null) {
          result.set(keyStrings[i], CacheValue.deserialize<T>(value));
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get multiple cache entries', error);
      throw error;
    }
  }

  async deleteMultiple(keys: CacheKey[]): Promise<number> {
    try {
      const keyStrings = keys.map((key) => key.toString());
      return await this.client.del(...keyStrings);
    } catch (error) {
      this.logger.error('Failed to delete multiple cache entries', error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      this.logger.error('Failed to ping cache', error);
      throw error;
    }
  }

  async flushDatabase(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (error) {
      this.logger.error('Failed to flush database', error);
      throw error;
    }
  }
}
