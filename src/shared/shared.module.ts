import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ConfigModule } from './infrastructure/config/config.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { HttpService } from './services/http.service';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  imports: [DatabaseModule, ConfigModule, CacheModule],
  providers: [HttpService, CacheService],
  exports: [
    DatabaseModule,
    ConfigModule,
    CacheModule,
    HttpService,
    CacheService,
  ],
})
export class SharedModule {}
