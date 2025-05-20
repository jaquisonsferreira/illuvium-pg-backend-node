import { Module, Global } from '@nestjs/common';
import { EnvironmentConfigService } from './environment.config';

@Global()
@Module({
  providers: [EnvironmentConfigService],
  exports: [EnvironmentConfigService],
})
export class ConfigModule {}
