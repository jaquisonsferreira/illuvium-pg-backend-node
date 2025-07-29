import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Kysely } from 'kysely';
import { sql } from 'kysely';
import { DATABASE_CONNECTION } from '../../../../shared/infrastructure/database/constants';
import { CACHE_REPOSITORY_TOKEN } from '../../../../shared/infrastructure/cache/contants';
import { CacheRepositoryInterface } from '../../../../shared/domain/cache/repositories/cache.repository.interface';

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Kysely<any>,
    @Optional()
    @Inject(CACHE_REPOSITORY_TOKEN)
    private readonly cacheRepository?: CacheRepositoryInterface,
  ) {}

  async checkDatabaseConnection(): Promise<boolean> {
    try {
      const result = await sql<{ now: Date }>`SELECT NOW()`.execute(this.db);
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  async checkRedisConnection(): Promise<boolean> {
    try {
      const hasConfig = !!(process.env.REDIS_HOST && process.env.REDIS_PORT);

      if (!hasConfig) {
        return false;
      }

      if (!this.cacheRepository) {
        this.logger.warn('Cache repository not available');
        return false;
      }

      const pingResult = await (this.cacheRepository as any).ping();
      return pingResult === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }
}
