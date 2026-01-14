/* eslint-disable @typescript-eslint/no-floating-promises */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ExploreDataSeeder } from './explore-data.seeder';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(ExploreDataSeeder);

  try {
    await seeder.seedAll();
// console.log removed
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
