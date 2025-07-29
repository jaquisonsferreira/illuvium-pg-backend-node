import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { CacheRepositoryInterface } from '../../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../../domain/cache/cache-key.value-object';
import { CacheValue } from '../../../domain/cache/cache-value.value-object';
import { CacheConfigService } from '../config/cache.config';

/**
 * IoRedis cache repository implementation.
 * Used primarily in development environments due to ARM64 processor compatibility issues with Valkey.
 * Provides Redis caching capabilities with IoRedis client.
 */
@Injectable()
export class IoRedisCacheRepository
  implements CacheRepositoryInterface, OnModuleInit, OnModuleDestroy
{
  private client: Redis;
  private readonly logger = new Logger(IoRedisCacheRepository.name);

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
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.logger.log(`Connected to Redis at ${config.host}:${config.port}`);
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis connection error', error);
      });

      // Wait for connection
      await this.client.ping();
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
      await this.client.flushall();
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
      return keys.map((key) => new CacheKey(key));
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

      const pipeline = this.client.pipeline();
      keys.forEach((key) => pipeline.get(key));
      const values = await pipeline.exec();

      if (values) {
        for (let i = 0; i < keys.length; i++) {
          const pipelineResult = values[i];
          if (pipelineResult) {
            const [err, value] = pipelineResult;
            if (!err && value) {
              result.set(keys[i], CacheValue.deserialize<T>(value as string));
            }
          }
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
