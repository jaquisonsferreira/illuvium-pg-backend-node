import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ValkeyCacheRepository } from './repositories/valkey-cache.repository';
import { IoRedisCacheRepository } from './repositories/ioredis-cache.repository';
import { RedisCacheRepository } from './repositories/redis-cache.repository';
import { CacheConfigService } from './config/cache.config';

import { SetCacheUseCase } from '../../application/cache/use-cases/set-cache.use-case';
import { GetCacheUseCase } from '../../application/cache/use-cases/get-cache.use-case';
import { DeleteCacheUseCase } from '../../application/cache/use-cases/delete-cache.use-case';
import { CacheService } from '../../application/cache/cache.service';
import { CACHE_REPOSITORY_TOKEN } from './contants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    CacheConfigService,
    {
      provide: CACHE_REPOSITORY_TOKEN,
      useClass:
        // We use IoRedis in development because Valkey has conflicts on ARM64 processors
        process.env.NODE_ENV === 'development'
          ? IoRedisCacheRepository
          : ValkeyCacheRepository,
    },
    SetCacheUseCase,
    GetCacheUseCase,
    DeleteCacheUseCase,
    CacheService,
  ],
  exports: [CacheService, CACHE_REPOSITORY_TOKEN, CacheConfigService],
})
export class CacheModule {}
