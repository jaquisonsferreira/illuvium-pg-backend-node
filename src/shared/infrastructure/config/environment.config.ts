import { Injectable } from '@nestjs/common';

/**
 * Environment configuration service
 * Handles access to environment variables with defaults
 */
@Injectable()
export class EnvironmentConfigService {
  getPort(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }

  getNodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }

  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  getCorsAllowedOrigins(): string[] {
    return process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'https://illuvium.io'];
  }

  getDatabaseConfig() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '26257', 10),
      database: process.env.DB_NAME || 'illuvium',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
    };
  }

  getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || '',
    };
  }

  /**
   * Get rate limit time-to-live in seconds
   */
  getRateLimitTtl(): number {
    return parseInt(process.env.RATE_LIMIT_TTL || '60', 10);
  }

  /**
   * Get maximum number of requests within the TTL window
   */
  getRateLimitMax(): number {
    return parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  }

  /**
   * Check if an API key is in the trusted list
   */
  isTrustedApiKey(apiKey: string | undefined): boolean {
    if (!apiKey) return false;

    const trustedKeys = process.env.TRUSTED_API_KEYS
      ? process.env.TRUSTED_API_KEYS.split(',')
      : [];

    return trustedKeys.includes(apiKey);
  }
}
