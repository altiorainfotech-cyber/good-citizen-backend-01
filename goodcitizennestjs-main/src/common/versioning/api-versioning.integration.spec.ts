/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

describe('API Versioning Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable versioning like in main.ts
    app.enableVersioning({ type: VersioningType.URI });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Version Header Handling', () => {
    it('should handle requests with version headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .set('X-API-Version', '1.0')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-requested-version']).toBe('1.0');
    });

    it('should handle legacy version headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .set('X-API-Version', 'legacy')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-requested-version']).toBe('legacy');
      expect(response.headers['x-api-deprecated']).toBe('true');
    });
  });

  describe('URL Path Versioning', () => {
    it('should handle v1 URL paths', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-requested-version']).toBe('1');
    });
  });

  describe('Controller Versioning', () => {
    it('should access versioned auth endpoints', async () => {
      // This will return 400 because we're not providing valid auth data,
      // but it confirms the endpoint is accessible with versioning
      const response = await request(app.getHttpServer())
        .post('/v1/auth/social')
        .send({})
        .expect(400);

      expect(response.headers['x-api-version']).toBe('1.0');
    });

    it('should access versioned explore endpoints', async () => {
      // This will return 401 because we're not authenticated,
      // but it confirms the endpoint is accessible with versioning
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .expect(401);

      expect(response.headers['x-api-version']).toBe('1.0');
    });

    it('should access versioned ride endpoints', async () => {
      // This will return 401 because we're not authenticated,
      // but it confirms the endpoint is accessible with versioning
      const response = await request(app.getHttpServer())
        .get('/v1/rides/history')
        .expect(401);

      expect(response.headers['x-api-version']).toBe('1.0');
    });
  });

  describe('Version Priority', () => {
    it('should prioritize header version over URL version', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .set('X-API-Version', '2.0')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('2.0');
      expect(response.headers['x-requested-version']).toBe('2.0');
    });

    it('should prioritize query version over URL version', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health?version=2.0')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('2.0');
      expect(response.headers['x-requested-version']).toBe('2.0');
    });
  });
});
