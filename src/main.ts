import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json } from 'express';
import { Kysely } from 'kysely';
import {
  Database,
  DATABASE_CONNECTION,
  setupDatabaseSchema,
} from './shared/infrastructure/database';
import {
  createCorsConfig,
  EnvironmentConfigService,
} from './shared/infrastructure/config';
import {
  GlobalExceptionFilter,
  ValidationExceptionFilter,
} from './shared/infrastructure/exceptions';
import { HttpAdapterHost } from '@nestjs/core';
import { CustomValidationPipe } from './shared/infrastructure/pipes';
import { ResponseTransformInterceptor } from './shared/infrastructure/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Configure raw body middleware for inbound webhook endpoints
  app.use(
    '/webhooks/inbound',
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Legacy support for existing webhook endpoint
  app.use(
    '/webhooks',
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Illuvium API')
    .setDescription('API backend for the Illuvium ecosystem')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // CORS configuration with advanced options
  const environmentConfigService = app.get(EnvironmentConfigService);
  app.enableCors(createCorsConfig(environmentConfigService));

  // Add rate limit headers to responses
  app.use((req, res, next) => {
    res.header('X-RateLimit-Style', 'RFC');
    next();
  });

  // Global Pipes
  app.useGlobalPipes(new CustomValidationPipe());

  // Global Interceptors
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Global exception filters
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new GlobalExceptionFilter(httpAdapter),
    new ValidationExceptionFilter(),
  );

  // Configure and verify the database schema
  try {
    const dbConnection = app.get<Kysely<Database>>(DATABASE_CONNECTION);
    await setupDatabaseSchema(dbConnection);
  } catch (error) {
    console.error('Error configuring the database:', error);
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Aplicação rodando na porta ${process.env.PORT ?? 3000}`);
  console.log(
    `Documentação Swagger disponível em http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
bootstrap();
