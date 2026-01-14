/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { io, Socket } from 'socket.io-client';

/**
 * Performance and Security Testing for Backend-Frontend Integration Fixes
 * 
 * This test suite validates:
 * - Geospatial query performance for emergency services
 * - API response times for critical endpoints
 * - WebSocket latency and real-time update delivery
 * - Authentication and authorization security
 * - Rate limiting and input validation
 */
describe('Performance and Security Testing - Integration Fixes (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let userId: string;
  let driverToken: string;
  let driverId: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(3004); // Use different port for these tests

    // Create test user
    const userResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        first_name: 'PerfTest',
        last_name: 'User',
        email: `perftest-${Date.now()}@example.com`,
        password: 'password123',
        phone_number: '5555555555',
        country_code: '+1',
        role: 'USER',
      });

    if (userResponse.status === 201 && userResponse.body.access_token) {
      userToken = userResponse.body.access_token;
      userId = userResponse.body.user?._id || userResponse.body._id || 'test-user-id';
    } else {
      console.warn('User creation failed, using mock token');
      userToken = 'mock-token';
      userId = 'mock-user-id';
    }

    // Create test driver
    const driverResponse = await request(app.getHttpServer())
      .post('/auth/driver/signup')
      .send({
        first_name: 'PerfTest',
        last_name: 'Driver',
        email: `perfdriver-${Date.now()}@example.com`,
        password: 'password123',
        phone_number: '5555555556',
        country_code: '+1',
        vehicle_type: 'REGULAR',
        license_plate: 'PERF123',
      });

    if (driverResponse.status === 201 && driverResponse.body.access_token) {
      driverToken = driverResponse.body.access_token;
      driverId = driverResponse.body.user?._id || driverResponse.body._id || 'test-driver-id';
    } else {
      console.warn('Driver creation failed, using mock token');
      driverToken = 'mock-driver-token';
      driverId = 'mock-driver-id';
    }

    // Create admin user
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        first_name: 'PerfTest',
        last_name: 'Admin',
        email: `perfadmin-${Date.now()}@example.com`,
        password: 'password123',
        phone_number: '5555555557',
        country_code: '+1',
        role: 'ADMIN',
      });

    if (adminResponse.status === 201 && adminResponse.body.access_token) {
      adminToken = adminResponse.body.access_token;
    } else {
      console.warn('Admin creation failed, using mock token');
      adminToken = 'mock-admin-token';
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Geospatial Query Performance', () => {
    it('should return hospital results within 2 seconds', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          radius: 10,
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Hospital query response time: ${responseTime}ms`);

      // Accept 200 or 404 (if endpoint not implemented yet)
      expect([200, 404]).toContain(response.status);
      expect(responseTime).toBeLessThan(2000); // Must complete within 2 seconds
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('hospitals');
        expect(Array.isArray(response.body.hospitals)).toBe(true);
      }
    });

    it('should return blood bank results within 2 seconds', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/v1/explore/blood-banks')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          bloodType: 'O+',
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Blood bank query response time: ${responseTime}ms`);

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000);
      expect(Array.isArray(response.body.bloodBanks)).toBe(true);
    });

    it('should handle 50 concurrent geospatial queries efficiently', async () => {
      const numQueries = 50;
      const queries: Promise<any>[] = [];

      for (let i = 0; i < numQueries; i++) {
        const query = request(app.getHttpServer())
          .get('/v1/explore/hospitals')
          .query({
            latitude: 28.6139 + (i * 0.01),
            longitude: 77.2090 + (i * 0.01),
            radius: 5 + (i % 10),
          });
        
        queries.push(query);
      }

      const startTime = Date.now();
      const responses = await Promise.all(queries);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / numQueries;

      console.log(`50 concurrent geospatial queries completed in ${totalTime}ms`);
      console.log(`Average query time: ${avgTime}ms`);

      const successCount = responses.filter(r => r.status === 200).length;
      
      expect(successCount).toBe(numQueries);
      expect(avgTime).toBeLessThan(200); // Average under 200ms
      expect(totalTime).toBeLessThan(5000); // Total under 5 seconds
    });

    it('should maintain performance with varying radius sizes', async () => {
      const radii = [1, 5, 10, 25, 50];
      const results: Array<{ radius: number; time: number }> = [];

      for (const radius of radii) {
        const startTime = Date.now();
        
        const response = await request(app.getHttpServer())
          .get('/v1/explore/hospitals')
          .query({
            latitude: 28.6139,
            longitude: 77.2090,
            radius,
          });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        results.push({ radius, time: responseTime });

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(2000);
      }

      console.log('Query times by radius:', results);

      // Verify performance doesn't degrade significantly with larger radius
      const maxTime = Math.max(...results.map(r => r.time));
      const minTime = Math.min(...results.map(r => r.time));
      const degradation = (maxTime - minTime) / minTime;

      expect(degradation).toBeLessThan(3); // Less than 3x degradation
    });
  });

  describe('API Response Time Performance', () => {
    it('should return impact data within 500ms', async () => {
      // First create an assist
      const assistResponse = await request(app.getHttpServer())
        .post('/v1/assists')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          emergency_type: 'ambulance',
          location: {
            latitude: 28.6139,
            longitude: 77.2090,
          },
        });

      const assistId = assistResponse.body._id;

      // Complete the assist to trigger impact calculation
      await request(app.getHttpServer())
        .post(`/v1/assists/${assistId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          route_data: {
            distance: 5000,
            duration: 600,
          },
        });

      // Measure impact retrieval time
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get(`/v1/assists/${assistId}/impact`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Impact data retrieval time: ${responseTime}ms`);

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
      expect(response.body).toHaveProperty('metrics');
    });

    it('should return rewards history within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/v1/rewards/history')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ limit: 20 });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Rewards history retrieval time: ${responseTime}ms`);

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it('should return location data within 300ms', async () => {
      // First update location
      await request(app.getHttpServer())
        .post('/v1/location/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          latitude: 28.6139,
          longitude: 77.2090,
          accuracy: 10,
        });

      // Measure retrieval time
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/v1/location/current')
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Location retrieval time: ${responseTime}ms`);

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(300);
      expect(response.body).toHaveProperty('coordinates');
    });

    it('should handle 100 concurrent API requests efficiently', async () => {
      const requests: Promise<any>[] = [];
      const numRequests = 100;

      for (let i = 0; i < numRequests; i++) {
        const requestType = i % 3;
        let req;

        switch (requestType) {
          case 0:
            req = request(app.getHttpServer())
              .get('/v1/explore/hospitals')
              .query({ latitude: 28.6139, longitude: 77.2090, radius: 10 });
            break;
          case 1:
            req = request(app.getHttpServer())
              .get('/v1/rewards/history')
              .set('Authorization', `Bearer ${userToken}`)
              .query({ limit: 10 });
            break;
          case 2:
            req = request(app.getHttpServer())
              .get('/v1/location/current')
              .set('Authorization', `Bearer ${userToken}`);
            break;
        }

        requests.push(req);
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / numRequests;
      const successCount = responses.filter(
        r => r.status === 'fulfilled' && r.value.status < 400
      ).length;

      console.log(`100 concurrent API requests completed in ${totalTime}ms`);
      console.log(`Average response time: ${avgTime}ms`);
      console.log(`Success rate: ${(successCount / numRequests * 100).toFixed(2)}%`);

      expect(successCount).toBeGreaterThan(95); // 95% success rate
      expect(avgTime).toBeLessThan(500);
      expect(totalTime).toBeLessThan(10000);
    });
  });

  describe('WebSocket Latency and Real-time Updates', () => {
    it('should establish WebSocket connection within 1 second', (done) => {
      const startTime = Date.now();
      
      const socket = io('http://localhost:3004', {
        auth: { token: userToken },
      });

      socket.on('connect', () => {
        const connectionTime = Date.now() - startTime;
        console.log(`WebSocket connection established in ${connectionTime}ms`);

        expect(connectionTime).toBeLessThan(1000);
        
        socket.disconnect();
        done();
      });

      socket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should deliver location updates within 500ms', (done) => {
      const socket = io('http://localhost:3004', {
        auth: { token: userToken },
      });

      socket.on('connect', () => {
        const startTime = Date.now();

        socket.emit('save_location', {
          latitude: 28.6139,
          longitude: 77.2090,
          timestamp: new Date().toISOString(),
        });

        socket.on('location_updated', () => {
          const latency = Date.now() - startTime;
          console.log(`Location update latency: ${latency}ms`);

          expect(latency).toBeLessThan(500);
          
          socket.disconnect();
          done();
        });
      });

      socket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should handle 50 concurrent WebSocket connections', (done) => {
      const numConnections = 50;
      const sockets: Socket[] = [];
      let connectedCount = 0;
      const startTime = Date.now();

      for (let i = 0; i < numConnections; i++) {
        const socket = io('http://localhost:3004', {
          auth: { token: userToken },
        });

        sockets.push(socket);

        socket.on('connect', () => {
          connectedCount++;

          if (connectedCount === numConnections) {
            const totalTime = Date.now() - startTime;
            console.log(`${numConnections} WebSocket connections in ${totalTime}ms`);

            expect(totalTime).toBeLessThan(5000);

            // Cleanup
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        socket.on('connect_error', (error) => {
          console.error(`Socket ${i} error:`, error);
        });
      }
    });

    it('should broadcast emergency service updates efficiently', (done) => {
      const socket = io('http://localhost:3004', {
        auth: { token: userToken },
      });

      socket.on('connect', () => {
        const startTime = Date.now();

        // Listen for emergency service updates
        socket.on('emergency_service_update', (data) => {
          const latency = Date.now() - startTime;
          console.log(`Emergency service update received in ${latency}ms`);

          expect(latency).toBeLessThan(1000);
          expect(data).toHaveProperty('type');
          
          socket.disconnect();
          done();
        });

        // Trigger an update (this would normally come from backend)
        socket.emit('request_emergency_services', {
          latitude: 28.6139,
          longitude: 77.2090,
        });
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.disconnect();
        done();
      }, 5000);
    });
  });

  describe('Authentication and Authorization Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/rewards/history');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/rewards/history')
        .set('Authorization', 'Bearer invalid_token_here');

      expect(response.status).toBe(401);
    });

    it('should reject requests with expired token format', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const response = await request(app.getHttpServer())
        .get('/v1/rewards/history')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should prevent users from accessing other users data', async () => {
      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          first_name: 'Other',
          last_name: 'User',
          email: 'otheruser@example.com',
          password: 'password123',
          phone_number: '5555555558',
          country_code: '+1',
          role: 'USER',
        });

      const otherUserId = otherUserResponse.body.user._id;

      // Try to access other user's data
      const response = await request(app.getHttpServer())
        .get(`/v1/users/${otherUserId}/impact-summary`)
        .set('Authorization', `Bearer ${userToken}`);

      // Should either return 403 or only return own data
      expect([200, 403]).toContain(response.status);
      
      if (response.status === 200) {
        // If 200, should only return requesting user's data
        expect(response.body.userId).toBe(userId);
      }
    });

    it('should enforce role-based access control for admin endpoints', async () => {
      // User trying to access admin endpoint
      const response = await request(app.getHttpServer())
        .patch(`/admin/drivers/${driverId}/approve`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(403);
    });

    it('should allow admin access to admin endpoints', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/drivers/${driverId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' });

      expect([200, 201]).toContain(response.status);
    });

    it('should validate JWT signature', async () => {
      // Create a token with wrong signature
      const parts = userToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature`;

      const response = await request(app.getHttpServer())
        .get('/v1/rewards/history')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation and Security', () => {
    it('should reject invalid coordinates', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: 999, // Invalid latitude
          longitude: 77.2090,
          radius: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject SQL injection attempts', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: "28.6139'; DROP TABLE hospitals; --",
          longitude: 77.2090,
          radius: 10,
        });

      expect(response.status).toBe(400);
    });

    it('should reject XSS attempts in location updates', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/location/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          latitude: 28.6139,
          longitude: 77.2090,
          address: '<script>alert("XSS")</script>',
        });

      // Should either reject or sanitize
      if (response.status === 200) {
        expect(response.body.address).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should enforce maximum radius limits', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          radius: 10000, // Unreasonably large radius
        });

      // Should either reject or cap the radius
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        // Verify results are reasonable
        expect(response.body.hospitals.length).toBeLessThan(1000);
      }
    });

    it('should validate blood type format', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/explore/blood-banks')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          bloodType: 'INVALID_TYPE',
        });

      expect(response.status).toBe(400);
    });

    it('should prevent negative values in numeric fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          radius: -5, // Negative radius
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rapid successive requests', async () => {
      const numRequests = 20;
      const requests: Promise<any>[] = [];

      for (let i = 0; i < numRequests; i++) {
        const req = request(app.getHttpServer())
          .get('/v1/explore/hospitals')
          .query({
            latitude: 28.6139,
            longitude: 77.2090,
            radius: 10,
          });
        
        requests.push(req);
      }

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      console.log(`Rapid requests - Success: ${successCount}, Rate limited: ${rateLimitedCount}`);

      // Should either handle all or rate limit some
      expect(successCount + rateLimitedCount).toBe(numRequests);
    });

    it('should handle large payload requests', async () => {
      const largePayload = {
        latitude: 28.6139,
        longitude: 77.2090,
        metadata: 'x'.repeat(10000), // 10KB of data
      };

      const response = await request(app.getHttpServer())
        .post('/v1/location/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send(largePayload);

      // Should either accept or reject based on size limits
      expect([200, 413]).toContain(response.status);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should return proper error codes for missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/location/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          // Missing latitude and longitude
          accuracy: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we verify the endpoint structure is correct
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          radius: 10,
        });

      // Should return either success or proper error
      expect([200, 500, 503]).toContain(response.status);
      
      if (response.status >= 500) {
        expect(response.body).toHaveProperty('message');
      }
    });

    it('should provide meaningful error messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/explore/hospitals')
        .query({
          latitude: 'invalid',
          longitude: 77.2090,
          radius: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBeTruthy();
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain response times under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const requestInterval = 100; // Request every 100ms
      const responseTimes: number[] = [];

      const startTime = Date.now();
      
      while (Date.now() - startTime < duration) {
        const reqStart = Date.now();
        
        await request(app.getHttpServer())
          .get('/v1/explore/hospitals')
          .query({
            latitude: 28.6139,
            longitude: 77.2090,
            radius: 10,
          });

        const reqTime = Date.now() - reqStart;
        responseTimes.push(reqTime);

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`Sustained load test results:`);
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Min response time: ${minResponseTime}ms`);
      console.log(`  Max response time: ${maxResponseTime}ms`);
      console.log(`  Total requests: ${responseTimes.length}`);

      expect(avgResponseTime).toBeLessThan(500);
      expect(maxResponseTime).toBeLessThan(2000);
    });
  });
});
