/* eslint-disable @typescript-eslint/no-floating-promises */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RateLimitingMiddleware } from './common/middleware/rate-limiting.middleware';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment-specific configuration
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'testing'
      ? '.env.testing'
      : '.env.development';

config({ path: path.resolve(process.cwd(), envFile) });
const PORT = process.env.PORT || 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['debug', 'error', 'log', 'verbose', 'warn'],
  });

  app.enableVersioning({ type: VersioningType.URI }); // URL versioning e.g., /v1/auth
  app.enableCors();
  app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global validation pipe with enhanced error handling
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      skipMissingProperties: false,
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
      validationError: {
        target: false,
        value: false,
      },
      exceptionFactory: (errors) => {
        // Return validation errors in a format that GlobalExceptionFilter can handle
        return errors;
      },
    }),
  );

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Rate limiting middleware
  const rateLimitingMiddleware = app.get(RateLimitingMiddleware);
  app.use(rateLimitingMiddleware.use.bind(rateLimitingMiddleware));

  const config = new DocumentBuilder()
    .setTitle('Goodcitizen App')
    .setDescription(
      'Goodcitizen App API description with comprehensive error handling and validation',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', name: 'authorization', in: 'header' },
      'authorization',
    )
    .addServer(`http://localhost:3001/`, 'local server')
    .addServer(`https://api.agoodcitizen.in`, 'live server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(PORT);
// console.log removed
}

bootstrap();
