import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './modules/assets/assets.module';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import {
  ConfigModule,
  RateLimitModule,
  SentryModule,
} from './shared/infrastructure/config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigModule,
    DatabaseModule,
    RateLimitModule,
    SentryModule,
    AssetsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
