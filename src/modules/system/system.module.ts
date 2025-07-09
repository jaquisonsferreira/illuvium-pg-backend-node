import { Module } from '@nestjs/common';
import { SystemHealthController } from './interface/controllers/system-health.controller';

@Module({
  controllers: [SystemHealthController],
})
export class SystemModule {}
