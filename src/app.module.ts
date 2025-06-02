import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './modules/assets/assets.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import {
  ConfigModule,
  RateLimitModule,
  SentryModule,
} from './shared/infrastructure/config';
import { CacheModule } from './shared/infrastructure/cache/cache.module';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigModule,
    DatabaseModule,
    RateLimitModule,
    SentryModule,
    CacheModule,
    AssetsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AssetsModule, WebhooksModule],
})
export class AppModule {}
