import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

import { AppModule } from './app.module';
import { TracingInterceptor } from './modules/observability/interface/interceptors/tracing.interceptor';
import { Kysely } from 'kysely';
import {
  DATABASE_CONNECTION,
  setupDatabaseSchema,
} from './shared/infrastructure/database';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Sentry configuration
  Sentry.init({
    dsn: configService.get<string>('SENTRY_DSN'),
    environment: configService.get<string>('NODE_ENV'),
    tracesSampleRate: 1.0,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global tracing interceptor for observability
  app.useGlobalInterceptors(app.get(TracingInterceptor));

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Illuvium API')
      .setDescription('API for Illuvium platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT', 3000);

  // Configure and verify the database schema
  try {
    const database = app.get<Kysely<any>>(DATABASE_CONNECTION);
    await setupDatabaseSchema(database);
    console.log('✅ Database schema configured successfully');
  } catch (error) {
    console.error('❌ Database schema configuration failed:', error);
    process.exit(1);
  }

  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});
