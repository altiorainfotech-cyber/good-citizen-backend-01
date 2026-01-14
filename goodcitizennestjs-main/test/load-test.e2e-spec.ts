/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { io, Socket } from 'socket.io-client';

describe('Performance and Load Testing (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const testUsers: Array<{ token: string; id: string }> = [];
  const testDrivers: Array<{ token: string; id: string }> = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(3003); // Use different port for load testing

    // Create admin user for approving drivers
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@example.com',
        password: 'password123',
        phone_number: '0000000000',
        country_code: '+1',
        role: 'ADMIN',
      });

    adminToken = adminResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Concurrent User Load Testing', () => {
    it('should handle 100 concurrent user registrations', async () => {
      const concurrentRegistrations: Promise<any>[] = [];
      const numUsers = 100;

      for (let i = 0; i < numUsers; i++) {
        const registrationPromise = request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            first_name: `LoadUser${i}`,
            last_name: 'Test',
            email: `loaduser${i}@example.com`,
            password: 'password123',
            phone_number: `1111111${String(i).padStart(3, '0')}`,
            country_code: '+1',
            role: 'USER',
          });

        concurrentRegistrations.push(registrationPromise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRegistrations);
      const endTime = Date.now();

      // Verify all registrations were successful
      let successCount = 0;
      responses.forEach((response, index) => {
        if (response?.status === 201) {
          successCount++;
          testUsers.push({
            token: response?.body?.access_token,
            id: response?.body?.user?._id,
          });
        }
      });

      expect(successCount).toBeGreaterThan(95); // Allow for some failures

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / numUsers;

      console.log(`100 concurrent registrations completed in ${totalTime}ms`);
      console.log(`Average response time: ${avgResponseTime}ms`);

      // Performance requirement: should complete within 10 seconds
      expect(totalTime).toBeLessThan(10000);
      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
    });

    it('should handle 50 concurrent driver registrations and approvals', async () => {
      const concurrentDriverRegistrations: Promise<any>[] = [];
      const numDrivers = 50;

      for (let i = 0; i < numDrivers; i++) {
        const registrationPromise = request(app.getHttpServer())
          .post('/auth/driver/signup')
          .send({
            first_name: `LoadDriver${i}`,
            last_name: 'Test',
            email: `loaddriver${i}@example.com`,
            password: 'password123',
            phone_number: `2222222${String(i).padStart(3, '0')}`,
            country_code: '+1',
            vehicle_type: 'REGULAR',
            license_plate: `LOAD${String(i).padStart(3, '0')}`,
          });

        concurrentDriverRegistrations.push(registrationPromise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(concurrentDriverRegistrations);
      const registrationEndTime = Date.now();

      // Store successful driver registrations
      const driverIds: any[] = [];
      responses.forEach((response) => {
        if (response?.status === 201) {
          testDrivers.push({
            token: response?.body?.access_token,
            id: response?.body?.user?._id,
          });
          driverIds.push(response?.body?.user?._id);
        }
      });

      // Concurrent driver approvals
      const approvalPromises = driverIds.map((driverId) =>
        request(app.getHttpServer())
          .patch(`/admin/drivers/${driverId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'APPROVED' }),
      );

      await Promise.all(approvalPromises);
      const approvalEndTime = Date.now();

      const totalRegistrationTime = registrationEndTime - startTime;
      const totalApprovalTime = approvalEndTime - registrationEndTime;

      console.log(
        `50 driver registrations completed in ${totalRegistrationTime}ms`,
      );
      console.log(`50 driver approvals completed in ${totalApprovalTime}ms`);

      expect(testDrivers.length).toBeGreaterThan(45); // Allow for some failures
      expect(totalRegistrationTime).toBeLessThan(8000);
      expect(totalApprovalTime).toBeLessThan(5000);
    });

    it('should handle 200 concurrent ride requests', async () => {
      const concurrentRideRequests: Promise<any>[] = [];
      const numRides = Math.min(200, testUsers.length);

      for (let i = 0; i < numRides; i++) {
        const user = testUsers[i % testUsers.length];
        const rideRequest = request(app.getHttpServer())
          .post('/ride/request')
          .set('Authorization', `Bearer ${user?.token}`)
          .send({
            pickup_location: {
              latitude: 40.7128 + i * 0.001,
              longitude: -74.006 + i * 0.001,
              address: `Load Test Location ${i}`,
            },
            destination_location: {
              latitude: 40.7589 + i * 0.0005,
              longitude: -73.9851 + i * 0.0005,
              address: `Load Test Destination ${i}`,
            },
            vehicle_type: 'REGULAR',
            payment_method: 'card',
          });

        concurrentRideRequests.push(rideRequest);
      }

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRideRequests);
      const endTime = Date.now();

      let successCount = 0;
      responses.forEach((response) => {
        if (response?.status === 201) {
          successCount++;
        }
      });

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / numRides;

      console.log(
        `${numRides} concurrent ride requests completed in ${totalTime}ms`,
      );
      console.log(
        `Success rate: ${((successCount / numRides) * 100).toFixed(2)}%`,
      );
      console.log(`Average response time: ${avgResponseTime}ms`);

      expect(successCount).toBeGreaterThan(numRides * 0.9); // 90% success rate
      expect(totalTime).toBeLessThan(15000); // 15 seconds max
      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
    });
  });

  describe('WebSocket Load Testing', () => {
    it('should handle 100 concurrent WebSocket connections', (done) => {
      const numConnections = Math.min(100, testUsers.length);
      const sockets: Socket[] = [];
      let connectedCount = 0;
      let locationUpdatesReceived = 0;

      const startTime = Date.now();

      for (let i = 0; i < numConnections; i++) {
        const user = testUsers[i];
        const socket = io('http://localhost:3003', {
          auth: {
            token: user?.token,
          },
        });

        sockets.push(socket);

        socket.on('connect', () => {
          connectedCount++;

          // Send location update
          socket.emit('save_location', {
            latitude: 40.7128 + i * 0.001,
            longitude: -74.006 + i * 0.001,
            timestamp: new Date().toISOString(),
          });

          if (connectedCount === numConnections) {
            const connectionTime = Date.now() - startTime;
            console.log(
              `${numConnections} WebSocket connections established in ${connectionTime}ms`,
            );

            // Wait for location updates to be processed
            setTimeout(() => {
              // Cleanup
              sockets.forEach((s) => s.disconnect());

              expect(connectedCount).toBe(numConnections);
              expect(connectionTime).toBeLessThan(5000); // 5 seconds max
              done();
            }, 2000);
          }
        });

        socket.on('location_updated', () => {
          locationUpdatesReceived++;
        });

        socket.on('connect_error', (error) => {
          console.error(`Socket ${i} connection error:`, error);
        });
      }
    });

    it('should handle rapid location updates from multiple drivers', async () => {
      const numDrivers = Math.min(20, testDrivers.length);
      const updatesPerDriver = 25;
      const totalUpdates = numDrivers * updatesPerDriver;

      // Set drivers as available first
      const availabilityPromises = testDrivers
        .slice(0, numDrivers)
        .map((driver, index) =>
          request(app.getHttpServer())
            .patch('/driver/availability')
            .set('Authorization', `Bearer ${driver.token}`)
            .send({
              is_online: true,
              location: {
                latitude: 40.7128 + index * 0.01,
                longitude: -74.006 + index * 0.01,
              },
            }),
        );

      await Promise.all(availabilityPromises);

      // Generate rapid location updates
      const locationUpdates: Promise<any>[] = [];
      for (let driverIndex = 0; driverIndex < numDrivers; driverIndex++) {
        const driver = testDrivers[driverIndex];

        for (
          let updateIndex = 0;
          updateIndex < updatesPerDriver;
          updateIndex++
        ) {
          const updatePromise = request(app.getHttpServer())
            .post('/websocket/location-update')
            .set('Authorization', `Bearer ${driver?.token}`)
            .send({
              latitude: 40.7128 + driverIndex * 0.01 + updateIndex * 0.0001,
              longitude: -74.006 + driverIndex * 0.01 + updateIndex * 0.0001,
              bearing: (updateIndex * 10) % 360,
              speed: 30 + (updateIndex % 30),
              timestamp: new Date().toISOString(),
            });

          locationUpdates.push(updatePromise);
        }
      }

      const startTime = Date.now();
      const responses = await Promise.all(locationUpdates);
      const endTime = Date.now();

      let successCount = 0;
      responses.forEach((response) => {
        if (response.status === 200) {
          successCount++;
        }
      });

      const totalTime = endTime - startTime;
      const updatesPerSecond = (successCount / totalTime) * 1000;

      console.log(
        `${totalUpdates} location updates completed in ${totalTime}ms`,
      );
      console.log(
        `Success rate: ${((successCount / totalUpdates) * 100).toFixed(2)}%`,
      );
      console.log(`Updates per second: ${updatesPerSecond.toFixed(2)}`);

      expect(successCount).toBeGreaterThan(totalUpdates * 0.95); // 95% success rate
      expect(updatesPerSecond).toBeGreaterThan(100); // At least 100 updates/second
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
    });
  });

  describe('Database Performance Testing', () => {
    it('should handle concurrent geospatial queries efficiently', async () => {
      const numQueries = 50;
      const queryPromises: Promise<any>[] = [];

      for (let i = 0; i < numQueries; i++) {
        const queryPromise = request(app.getHttpServer())
          .get('/driver/available')
          .query({
            latitude: 40.7128 + i * 0.01,
            longitude: -74.006 + i * 0.01,
            radius: 5 + (i % 10), // Varying radius
            vehicle_type: i % 2 === 0 ? 'REGULAR' : 'EMERGENCY',
          });

        queryPromises.push(queryPromise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(queryPromises);
      const endTime = Date.now();

      let successCount = 0;
      responses.forEach((response) => {
        if (response.status === 200) {
          successCount++;
        }
      });

      const totalTime = endTime - startTime;
      const avgQueryTime = totalTime / numQueries;

      console.log(
        `${numQueries} geospatial queries completed in ${totalTime}ms`,
      );
      console.log(`Average query time: ${avgQueryTime}ms`);

      expect(successCount).toBe(numQueries);
      expect(avgQueryTime).toBeLessThan(100); // Sub-100ms query times
      expect(totalTime).toBeLessThan(3000); // 3 seconds max for all queries
    });

    it('should handle concurrent ride history queries', async () => {
      const numQueries = 100;
      const queryPromises: Promise<any>[] = [];

      for (let i = 0; i < numQueries; i++) {
        const user = testUsers[i % testUsers.length];
        const queryPromise = request(app.getHttpServer())
          .get('/ride/history')
          .set('Authorization', `Bearer ${user?.token}`)
          .query({
            page: 1,
            limit: 10,
          });

        queryPromises.push(queryPromise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(queryPromises);
      const endTime = Date.now();

      let successCount = 0;
      responses.forEach((response) => {
        if (response.status === 200) {
          successCount++;
        }
      });

      const totalTime = endTime - startTime;
      const avgQueryTime = totalTime / numQueries;

      console.log(
        `${numQueries} ride history queries completed in ${totalTime}ms`,
      );
      console.log(`Average query time: ${avgQueryTime}ms`);

      expect(successCount).toBe(numQueries);
      expect(avgQueryTime).toBeLessThan(200); // Sub-200ms query times
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();

      // Simulate sustained load
      const sustainedRequests: Promise<any>[] = [];
      const numRequests = 500;

      for (let i = 0; i < numRequests; i++) {
        const user = testUsers[i % testUsers.length];
        const requestPromise = request(app.getHttpServer())
          .get('/user/profile')
          .set('Authorization', `Bearer ${user?.token}`);

        sustainedRequests.push(requestPromise);

        // Add small delay to simulate sustained load
        if (i % 50 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      await Promise.all(sustainedRequests);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent =
        (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(
        `Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(`Memory increase: ${memoryIncreasePercent.toFixed(2)}%`);

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });
  });

  describe('Error Rate Under Load', () => {
    it('should maintain low error rate under high concurrent load', async () => {
      const numRequests = 1000;
      const concurrentRequests: Promise<any>[] = [];

      // Mix of different request types
      for (let i = 0; i < numRequests; i++) {
        const user = testUsers[i % testUsers.length];
        let requestPromise;

        switch (i % 4) {
          case 0:
            requestPromise = request(app.getHttpServer())
              .get('/user/profile')
              .set('Authorization', `Bearer ${user?.token}`);
            break;
          case 1:
            requestPromise = request(app.getHttpServer())
              .get('/ride/history')
              .set('Authorization', `Bearer ${user?.token}`);
            break;
          case 2:
            requestPromise = request(app.getHttpServer())
              .get('/driver/available')
              .query({
                latitude: 40.7128,
                longitude: -74.006,
                radius: 5,
              });
            break;
          case 3:
            requestPromise = request(app.getHttpServer())
              .get('/notifications/recent')
              .set('Authorization', `Bearer ${user?.token}`);
            break;
        }

        concurrentRequests.push(requestPromise);
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();

      let successCount = 0;
      let errorCount = 0;

      responses.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.status < 400) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      const errorRate = (errorCount / numRequests) * 100;
      const totalTime = endTime - startTime;

      console.log(`${numRequests} mixed requests completed in ${totalTime}ms`);
      console.log(`Success count: ${successCount}`);
      console.log(`Error count: ${errorCount}`);
      console.log(`Error rate: ${errorRate.toFixed(2)}%`);

      expect(errorRate).toBeLessThan(5); // Less than 5% error rate
      expect(totalTime).toBeLessThan(20000); // 20 seconds max
    });
  });
});
