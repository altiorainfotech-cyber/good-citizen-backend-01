import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import express from 'express';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment configuration
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'testing'
      ? '.env.testing'
      : '.env.development';

config({ path: path.resolve(process.cwd(), envFile) });

const server = express();
let cachedApp;

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
      {
        logger: ['error', 'warn', 'log'],
      }
    );

    app.enableVersioning({ type: VersioningType.URI });
    app.enableCors();

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global validation pipe
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
          return errors;
        },
      }),
    );

    // Global exception filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

// Vercel serverless function handler
export default async (req, res) => {
  await bootstrap();
  server(req, res);
}; 


// r h htmgfg 


// cvfdlvfevfe  