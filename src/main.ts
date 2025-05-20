import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Kysely } from 'kysely';
import {
  Database,
  setupDatabaseSchema,
} from './shared/infrastructure/database';

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

  // CORS configuration, if needed
  app.enableCors();

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
    const db = app.get<Kysely<Database>>('DATABASE_CONNECTION');
    await setupDatabaseSchema(db);
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
