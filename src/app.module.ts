import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './modules/assets/assets.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuthModule } from './modules/auth/auth.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { AuditModule } from './modules/audit/audit.module';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { CacheModule } from './shared/infrastructure/cache/cache.module';
import { ConfigModule, RateLimitModule } from './shared/infrastructure/config';

import { ObservabilityModule } from './modules/observability/observability.module';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ConfigModule,
    DatabaseModule,
    RateLimitModule,
    CacheModule,
    AssetsModule,
    BlockchainModule,
    ObservabilityModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, AssetsModule, WebhooksModule],
})
export class AppModule {}
