import { Module } from '@nestjs/common';
import { SystemHealthController } from './interface/controllers/system-health.controller';
import { SystemHealthService } from './application/services/system-health.service';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { CacheModule } from '../../shared/infrastructure/cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [SystemHealthController],
  providers: [SystemHealthService],
})
export class SystemModule {}
