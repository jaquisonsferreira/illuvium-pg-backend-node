import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { EnvironmentConfigService } from './environment.config';
import { createRateLimitConfig } from './rate-limit.config';
import { ApiThrottlerGuard } from '../guards';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService) =>
        createRateLimitConfig(config),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
