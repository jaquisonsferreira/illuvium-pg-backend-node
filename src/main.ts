import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Global ValidationPipe configuration
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
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
