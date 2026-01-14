/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SocketGateway } from '../src/web-socket/web-socket.gateway';
import { io, Socket } from 'socket.io-client';

describe('Comprehensive Integration Tests (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userToken: string;
  let driverToken: string;
  let userId: string;
  let driverId: string;
  let rideId: string;
  let clientSocket: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
    await app.listen(3002); // Use different port for testing
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    await app.close();
  });

  describe('Complete Ride Flow Integration', () => {
    it('should complete full ride flow from user request to completion', async () => {
      // Step 1: Register and authenticate user
      const userSignupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          first_name: 'Test',
          last_name: 'User',
          email: 'testuser@example.com',
          password: 'password123',
          phone_number: '1234567890',
          country_code: '+1',
          role: 'USER',
        })
        .expect(201);

      userToken = userSignupResponse.body.access_token;
      userId = userSignupResponse.body.user._id;

      // Step 2: Register and authenticate driver
      const driverSignupResponse = await request(app.getHttpServer())
        .post('/auth/driver/signup')
        .send({
          first_name: 'Test',
          last_name: 'Driver',
          email: 'testdriver@example.com',
          password: 'password123',
          phone_number: '0987654321',
          country_code: '+1',
          vehicle_type: 'REGULAR',
          license_plate: 'ABC123',
        })
        .expect(201);

      driverToken = driverSignupResponse.body.access_token;
      driverId = driverSignupResponse.body.user._id;

      // Step 3: Approve driver (simulate admin approval)
      await request(app.getHttpServer())
        .patch(`/admin/drivers/${driverId}/approve`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      // Step 4: Set driver as available
      await request(app.getHttpServer())
        .patch('/driver/availability')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          is_online: true,
          location: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        })
        .expect(200);

      // Step 5: User requests ride
      const rideResponse = await request(app.getHttpServer())
        .post('/ride/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pickup_location: {
            latitude: 40.7128,
            longitude: -74.006,
            address: 'New York, NY',
          },
          destination_location: {
            latitude: 40.7589,
            longitude: -73.9851,
            address: 'Times Square, NY',
          },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        })
        .expect(201);

      rideId = rideResponse.body.ride_id;
      expect(rideResponse.body.status).toBe('requested');
      expect(rideResponse.body.estimated_fare).toBeGreaterThan(0);

      // Step 6: Driver accepts ride
      await request(app.getHttpServer())
        .post(`/driver/rides/${rideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      // Step 7: Check ride status after acceptance
      const statusResponse = await request(app.getHttpServer())
        .get(`/ride/${rideId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('driver_assigned');
      expect(statusResponse.body.driver).toBeDefined();
      expect(statusResponse.body.driver.driver_id).toBe(driverId);

      // Step 8: Driver marks as arriving
      await request(app.getHttpServer())
        .patch(`/driver/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'driver_arriving' })
        .expect(200);

      // Step 9: Driver marks as arrived
      await request(app.getHttpServer())
        .patch(`/driver/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'driver_arrived' })
        .expect(200);

      // Step 10: Start ride
      await request(app.getHttpServer())
        .patch(`/driver/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      // Step 11: Complete ride
      const completionResponse = await request(app.getHttpServer())
        .post(`/driver/rides/${rideId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          final_location: {
            latitude: 40.7589,
            longitude: -73.9851,
          },
          distance_km: 5.2,
          duration_minutes: 15,
        })
        .expect(200);

      expect(completionResponse.body.status).toBe('completed');
      expect(completionResponse.body.final_fare).toBeGreaterThan(0);

      // Step 12: User rates the ride
      await request(app.getHttpServer())
        .post(`/ride/${rideId}/rate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          feedback: 'Great ride!',
        })
        .expect(200);

      // Step 13: Verify ride history
      const historyResponse = await request(app.getHttpServer())
        .get('/ride/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(historyResponse.body.rides).toHaveLength(1);
      expect(historyResponse.body.rides[0].ride_id).toBe(rideId);
      expect(historyResponse.body.rides[0].status).toBe('completed');
    });
  });

  describe('Emergency Alert System Integration', () => {
    it('should handle emergency ride with path-clearing notifications', async () => {
      // Step 1: Create emergency ride
      const emergencyRideResponse = await request(app.getHttpServer())
        .post('/ride/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pickup_location: {
            latitude: 40.7128,
            longitude: -74.006,
            address: 'Emergency Location',
          },
          destination_location: {
            latitude: 40.7589,
            longitude: -73.9851,
            address: 'Hospital',
          },
          vehicle_type: 'EMERGENCY',
          emergency_details: 'Medical emergency - heart attack',
          payment_method: 'card',
        })
        .expect(201);

      const emergencyRideId = emergencyRideResponse.body.ride_id;
      expect(emergencyRideResponse.body.vehicle_type).toBe('EMERGENCY');

      // Step 2: Driver accepts emergency ride
      await request(app.getHttpServer())
        .post(`/driver/rides/${emergencyRideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      // Step 3: Start emergency ride
      await request(app.getHttpServer())
        .patch(`/driver/rides/${emergencyRideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      // Step 4: Simulate driver location updates that should trigger path clearing
      await request(app.getHttpServer())
        .post('/websocket/location-update')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          latitude: 40.715,
          longitude: -74.005,
          bearing: 45,
          speed: 60,
          ride_id: emergencyRideId,
        })
        .expect(200);

      // Step 5: Verify emergency notifications were sent
      const notificationsResponse = await request(app.getHttpServer())
        .get('/notifications/recent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const emergencyNotifications =
        notificationsResponse.body.notifications.filter(
          (n) => n.type === 'EMERGENCY_ALERT',
        );

      expect(emergencyNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Real-time Communication', () => {
    it('should establish WebSocket connection and handle real-time updates', (done) => {
      // Connect to WebSocket
      clientSocket = io('http://localhost:3002', {
        auth: {
          token: userToken,
        },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);

        // Test location update event
        clientSocket.emit('save_location', {
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: new Date().toISOString(),
        });

        // Listen for driver location updates
        clientSocket.on('driver_location', (data) => {
          expect(data).toBeDefined();
          expect(data.latitude).toBeDefined();
          expect(data.longitude).toBeDefined();
          done();
        });

        // Simulate driver location update
        setTimeout(() => {
          clientSocket.emit('driver_location', {
            driver_id: driverId,
            latitude: 40.715,
            longitude: -74.005,
            bearing: 45,
            timestamp: new Date().toISOString(),
          });
        }, 100);
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle multiple concurrent ride requests', async () => {
      const numRequests = 5;

      // Create multiple users
      const users: Array<{ token: any; id: any }> = [];
      for (let i = 0; i < numRequests; i++) {
        const userResponse = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            first_name: `User${i}`,
            last_name: 'Test',
            email: `user${i}@example.com`,
            password: 'password123',
            phone_number: `123456789${i}`,
            country_code: '+1',
            role: 'USER',
          })
          .expect(201);

        users.push({
          token: userResponse.body.access_token,
          id: userResponse.body.user._id,
        });
      }

      // Create concurrent ride requests
      const concurrentRequests: Promise<any>[] = [];
      for (let i = 0; i < numRequests; i++) {
        const rideRequest = request(app.getHttpServer())
          .post('/ride/request')
          .set('Authorization', `Bearer ${users[i]?.token}`)
          .send({
            pickup_location: {
              latitude: 40.7128 + i * 0.001,
              longitude: -74.006 + i * 0.001,
              address: `Location ${i}`,
            },
            destination_location: {
              latitude: 40.7589,
              longitude: -73.9851,
              address: 'Destination',
            },
            vehicle_type: 'REGULAR',
            payment_method: 'card',
          });

        concurrentRequests.push(rideRequest);
      }

      // Execute all requests concurrently
      const responses: any[] = await Promise.all(concurrentRequests);

      // Verify all requests were successful
      responses.forEach((response, index) => {
        expect(response?.status).toBe(201);
        expect(response?.body?.ride_id).toBeDefined();
        expect(response?.body?.status).toBe('requested');
      });

      // Verify each ride has unique ID
      const rideIds = responses.map((r) => r?.body?.ride_id).filter(Boolean);
      const uniqueRideIds = new Set(rideIds);
      expect(uniqueRideIds.size).toBe(numRequests);
    });

    it('should handle concurrent driver availability updates', async () => {
      // Create multiple drivers
      const drivers: Array<{ token: any; id: any }> = [];
      const numDrivers = 3;

      for (let i = 0; i < numDrivers; i++) {
        const driverResponse = await request(app.getHttpServer())
          .post('/auth/driver/signup')
          .send({
            first_name: `Driver${i}`,
            last_name: 'Test',
            email: `driver${i}@example.com`,
            password: 'password123',
            phone_number: `098765432${i}`,
            country_code: '+1',
            vehicle_type: 'REGULAR',
            license_plate: `XYZ${i}23`,
          })
          .expect(201);

        drivers.push({
          token: driverResponse.body.access_token,
          id: driverResponse.body.user._id,
        });

        // Approve driver
        await request(app.getHttpServer())
          .patch(`/admin/drivers/${driverResponse.body.user._id}/approve`)
          .set('Authorization', `Bearer ${driverResponse.body.access_token}`)
          .send({ status: 'APPROVED' })
          .expect(200);
      }

      // Concurrent availability updates
      const availabilityUpdates = drivers.map((driver, index) =>
        request(app.getHttpServer())
          .patch('/driver/availability')
          .set('Authorization', `Bearer ${driver?.token}`)
          .send({
            is_online: true,
            location: {
              latitude: 40.7128 + index * 0.01,
              longitude: -74.006 + index * 0.01,
            },
          }),
      );

      const updateResponses = await Promise.all(availabilityUpdates);

      // Verify all updates were successful
      updateResponses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Verify drivers are available for matching
      const availableDriversResponse = await request(app.getHttpServer())
        .get('/driver/available')
        .query({
          latitude: 40.7128,
          longitude: -74.006,
          radius: 10,
        })
        .expect(200);

      expect(availableDriversResponse.body.drivers.length).toBe(numDrivers);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid ride requests gracefully', async () => {
      // Invalid location coordinates
      await request(app.getHttpServer())
        .post('/ride/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pickup_location: {
            latitude: 200, // Invalid latitude
            longitude: -74.006,
            address: 'Invalid Location',
          },
          destination_location: {
            latitude: 40.7589,
            longitude: -73.9851,
            address: 'Valid Destination',
          },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        })
        .expect(400);

      // Missing required fields
      await request(app.getHttpServer())
        .post('/ride/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pickup_location: {
            latitude: 40.7128,
            longitude: -74.006,
          },
          // Missing destination_location
        })
        .expect(400);
    });

    it('should handle unauthorized access attempts', async () => {
      // Access without token
      await request(app.getHttpServer()).get('/ride/history').expect(401);

      // Access with invalid token
      await request(app.getHttpServer())
        .get('/ride/history')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Access other user's ride
      const otherUserResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          first_name: 'Other',
          last_name: 'User',
          email: 'otheruser@example.com',
          password: 'password123',
          phone_number: '5555555555',
          country_code: '+1',
          role: 'USER',
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/ride/${rideId}/status`)
        .set('Authorization', `Bearer ${otherUserResponse.body.access_token}`)
        .expect(403);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid location updates without degradation', async () => {
      const numUpdates = 50;
      const locationUpdates: Promise<any>[] = [];

      for (let i = 0; i < numUpdates; i++) {
        const updatePromise = request(app.getHttpServer())
          .post('/websocket/location-update')
          .set('Authorization', `Bearer ${driverToken}`)
          .send({
            latitude: 40.7128 + i * 0.0001,
            longitude: -74.006 + i * 0.0001,
            bearing: i % 360,
            speed: 30 + (i % 20),
            timestamp: new Date().toISOString(),
          });

        locationUpdates.push(updatePromise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(locationUpdates);
      const endTime = Date.now();

      // Verify all updates were successful
      responses.forEach((response) => {
        expect(response?.status).toBe(200);
      });

      // Verify performance (should complete within reasonable time)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 50 updates
    });
  });
});
