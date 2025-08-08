import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ConfigModule } from './infrastructure/config/config.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { HttpService } from './services/http.service';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    CacheModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  providers: [HttpService, CacheService],
  exports: [
    DatabaseModule,
    ConfigModule,
    CacheModule,
    HttpService,
    CacheService,
    BullModule,
  ],
})
export class SharedModule {}
