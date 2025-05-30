import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  defaultTtl?: number;
  maxRetries?: number;
  retryDelay?: number;
  useTLS?: boolean;
  clientName?: string;
}

@Injectable()
export class CacheConfigService {
  constructor(private readonly configService: ConfigService) {}

  getConfig(): CacheConfig {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      database: this.configService.get<number>('REDIS_DATABASE', 0),
      keyPrefix: this.configService.get<string>(
        'REDIS_KEY_PREFIX',
        'illuvium:',
      ),
      defaultTtl: this.configService.get<number>('REDIS_DEFAULT_TTL', 3600),
      maxRetries: this.configService.get<number>('REDIS_MAX_RETRIES', 3),
      retryDelay: this.configService.get<number>('REDIS_RETRY_DELAY', 1000),
      useTLS: this.configService.get<boolean>('REDIS_USE_TLS', false),
      clientName: this.configService.get<string>(
        'REDIS_CLIENT_NAME',
        'illuvium-api',
      ),
    };
  }

  getConnectionString(): string {
    const config = this.getConfig();
    const protocol = config.useTLS ? 'rediss' : 'redis';
    const auth = config.password ? `:${config.password}@` : '';
    return `${protocol}://${auth}${config.host}:${config.port}/${config.database || 0}`;
  }
}
