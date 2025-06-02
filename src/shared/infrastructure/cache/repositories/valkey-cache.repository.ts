/* eslint-disable @typescript-eslint/no-base-to-string */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { GlideClient } from '@valkey/valkey-glide';
import { CacheRepositoryInterface } from '../../../domain/cache/repositories/cache.repository.interface';
import { CacheKey } from '../../../domain/cache/cache-key.value-object';
import { CacheValue } from '../../../domain/cache/cache-value.value-object';
import { CacheConfigService } from '../config/cache.config';

@Injectable()
export class ValkeyCacheRepository
  implements CacheRepositoryInterface, OnModuleInit, OnModuleDestroy
{
  private client: GlideClient;
  private readonly logger = new Logger(ValkeyCacheRepository.name);

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

      this.client = await GlideClient.createClient({
        addresses: [
          {
            host: config.host,
            port: config.port,
          },
        ],
        useTLS: config.useTLS,
        clientName: config.clientName,
      });

      this.logger.log(`Connected to Valkey at ${config.host}:${config.port}`);
    } catch (error) {
      this.logger.error('Failed to connect to Valkey', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.logger.log('Disconnected from Valkey');
    }
  }

  async set<T>(key: CacheKey, value: CacheValue<T>): Promise<void> {
    try {
      const serializedValue = value.serialize();
      const ttl = value.getTtl();

      if (ttl) {
        await this.client.set(key.toString(), serializedValue, {
          expiry: {
            type: 'EX' as any,
            count: ttl,
          },
        });
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

      const resultString =
        typeof result === 'string' ? result : result.toString();
      return CacheValue.deserialize<T>(resultString);
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key.toString()}`, error);
      throw error;
    }
  }

  async delete(key: CacheKey): Promise<boolean> {
    try {
      const result = await this.client.del([key.toString()]);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key.toString()}`, error);
      throw error;
    }
  }

  async exists(key: CacheKey): Promise<boolean> {
    try {
      const result = await this.client.exists([key.toString()]);
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
      return await this.client.incrBy(key.toString(), value);
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
      return await this.client.decrBy(key.toString(), value);
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
      const keys = await this.client.customCommand(['KEYS', pattern]);
      if (Array.isArray(keys)) {
        return keys
          .filter((key) => key !== null)
          .map((key) => new CacheKey(String(key)));
      }
      return [];
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern: ${pattern}`, error);
      throw error;
    }
  }

  async getWithPattern<T>(
    pattern: string,
  ): Promise<Map<string, CacheValue<T>>> {
    try {
      const keys = await this.client.customCommand(['KEYS', pattern]);
      const result = new Map<string, CacheValue<T>>();

      if (!Array.isArray(keys) || keys.length === 0) {
        return result;
      }

      const keyStrings = keys
        .filter((key) => key !== null)
        .map((key) => String(key));
      const values = await this.client.mget(keyStrings);

      for (let i = 0; i < keyStrings.length; i++) {
        const value = values[i];
        if (value !== null) {
          const valueString =
            typeof value === 'string' ? value : value.toString();
          result.set(keyStrings[i], CacheValue.deserialize<T>(valueString));
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
      for (const [key, value] of entries) {
        const serializedValue = value.serialize();
        const ttl = value.getTtl();

        if (ttl) {
          await this.client.set(key.toString(), serializedValue, {
            expiry: {
              type: 'EX' as any,
              count: ttl,
            },
          });
        } else {
          await this.client.set(key.toString(), serializedValue);
        }
      }
    } catch (error) {
      this.logger.error('Failed to set multiple cache entries', error);
      throw error;
    }
  }

  async getMultiple<T>(keys: CacheKey[]): Promise<Map<string, CacheValue<T>>> {
    try {
      const keyStrings = keys.map((key) => key.toString());
      const values = await this.client.mget(keyStrings);
      const result = new Map<string, CacheValue<T>>();

      for (let i = 0; i < keyStrings.length; i++) {
        const value = values[i];
        if (value !== null) {
          const valueString =
            typeof value === 'string' ? value : value.toString();
          result.set(keyStrings[i], CacheValue.deserialize<T>(valueString));
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
      return await this.client.del(keyStrings);
    } catch (error) {
      this.logger.error('Failed to delete multiple cache entries', error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      const result = await this.client.ping();
      return typeof result === 'string' ? result : result.toString();
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
