import { Module, Global, OnModuleInit } from '@nestjs/common';
import { EnvironmentConfigService } from './environment.config';
import { setupSentry } from './sentry.config';

@Global()
@Module({})
export class SentryModule implements OnModuleInit {
  constructor(private readonly configService: EnvironmentConfigService) {}

  onModuleInit() {
    setupSentry(this.configService);
  }
}
