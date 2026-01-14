/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';

import { AppModule } from '../../app.module';
import { User, UserDocument } from '../../user/entities/user.entity';
import { Ride, RideDocument } from '../../ride/entities/ride.entity';
import { Session, SessionDocument } from '../../user/entities/session.entity';
import { UserType, RideStatus } from '../../common/utils';
import { AuthService } from '../../authentication/auth.service';
import { RideService } from '../../ride/ride.service';
import { DriverMatchingService } from '../../driver/driver-matching.service';
import { WebSocketService } from '../../web-socket/web-socket.service';

/**
 * Performance Test: Load Testing with Multiple Concurrent Users and Rides
 * Tests system performance under high load conditions
 * Validates: Requirements 20.1, 20.2, 20.4
 */
describe('Load Testing Performance Tests', () => {
  let app: INestApplication;
  let userModel: Model<UserDocument>;
  let rideModel: Model<RideDocument>;
  let sessionModel: Model<SessionDocument>;
  let authService: AuthService;
  let rideService: RideService;
  let driverMatchingService: DriverMatchingService;
  let webSocketService: WebSocketService;

  // Test data
  let testUsers: any[] = [];
  let testDrivers: any[] = [];
  let userTokens: string[] = [];
  let driverTokens: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.testing',
        }),
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            uri:
              configService.get<string>('DATABASE_URL') ||
              'mongodb://localhost:27017/test-ride-hailing',
          }),
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get models and services
    userModel = moduleFixture.get<Model<UserDocument>>(
      getModelToken(User.name),
    );
    rideModel = moduleFixture.get<Model<RideDocument>>(
      getModelToken(Ride.name),
    );
    sessionModel = moduleFixture.get<Model<SessionDocument>>(
      getModelToken(Session.name),
    );
    authService = moduleFixture.get<AuthService>(AuthService);
    rideService = moduleFixture.get<RideService>(RideService);
    driverMatchingService = moduleFixture.get<DriverMatchingService>(
      DriverMatchingService,
    );
    webSocketService = moduleFixture.get<WebSocketService>(WebSocketService);

    // Clean up test data
    await userModel.deleteMany({
      email: { $regex: /test.*@performance\.test/ },
    });
    await sessionModel.deleteMany({});
    await rideModel.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await userModel.deleteMany({
      email: { $regex: /test.*@performance\.test/ },
    });
    await sessionModel.deleteMany({});
    await rideModel.deleteMany({});

    await app.close();
  });

  beforeEach(async () => {
    // Create multiple test users (100 users)
    const userPromises: Promise<any>[] = [];
    for (let i = 0; i < 100; i++) {
      const user = new userModel({
        first_name: `User${i}`,
        last_name: 'Test',
        email: `user${i}@performance.test`,
        phone_number: `+123456${i.toString().padStart(4, '0')}`,
        country_code: '+1',
        password: 'hashedpassword123',
        role: UserType.USER,
        location: {
          type: 'Point',
          coordinates: [
            -74.006 + (Math.random() - 0.5) * 0.1, // Random location within NYC area
            40.7128 + (Math.random() - 0.5) * 0.1,
          ],
        },
        latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
        longitude: -74.006 + (Math.random() - 0.5) * 0.1,
        is_online: true,
        is_email_verified: true,
        loyalty_point: Math.floor(Math.random() * 100),
      });
      userPromises.push(user.save());
    }
    testUsers = await Promise.all(userPromises);

    // Create multiple test drivers (20 drivers)
    const driverPromises: Promise<any>[] = [];
    for (let i = 0; i < 20; i++) {
      const driver = new userModel({
        first_name: `Driver${i}`,
        last_name: 'Test',
        email: `driver${i}@performance.test`,
        phone_number: `+123457${i.toString().padStart(4, '0')}`,
        country_code: '+1',
        password: 'hashedpassword123',
        role: UserType.DRIVER,
        location: {
          type: 'Point',
          coordinates: [
            -74.006 + (Math.random() - 0.5) * 0.1,
            40.7128 + (Math.random() - 0.5) * 0.1,
          ],
        },
        latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
        longitude: -74.006 + (Math.random() - 0.5) * 0.1,
        is_online: true,
        is_email_verified: true,
        approval: 'APPROVED',
        vehicle_type: i % 5 === 0 ? 'EMERGENCY' : 'REGULAR', // 20% emergency vehicles
        vehicle_plate: `TEST${i.toString().padStart(3, '0')}`,
        driver_rating: 4.0 + Math.random(),
        total_rides: Math.floor(Math.random() * 100),
      });
      driverPromises.push(driver.save());
    }
    testDrivers = await Promise.all(driverPromises);

    // Create authentication tokens for all users and drivers
    const tokenPromises: Promise<any>[] = [];

    // User tokens
    for (let i = 0; i < testUsers.length; i++) {
      const session = new sessionModel({
        user_id: testUsers[i]._id,
        access_token: `test-user-token-${i}`,
        refresh_token: `test-user-refresh-${i}`,
        device_type: 'ANDROID',
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: Date.now(),
      });
      tokenPromises.push(session.save());
    }

    // Driver tokens
    for (let i = 0; i < testDrivers.length; i++) {
      const session = new sessionModel({
        user_id: testDrivers[i]._id,
        access_token: `test-driver-token-${i}`,
        refresh_token: `test-driver-refresh-${i}`,
        device_type: 'ANDROID',
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: Date.now(),
      });
      tokenPromises.push(session.save());
    }

    await Promise.all(tokenPromises);

    // Generate JWT tokens
    for (let i = 0; i < testUsers.length; i++) {
      const payload = {
        _id: testUsers[i]._id.toString(),
        session_id: `session-user-${i}`,
        role: UserType.USER,
      };
      userTokens.push(authService['jwtService'].sign(payload));
    }

    for (let i = 0; i < testDrivers.length; i++) {
      const payload = {
        _id: testDrivers[i]._id.toString(),
        session_id: `session-driver-${i}`,
        role: UserType.DRIVER,
      };
      driverTokens.push(authService['jwtService'].sign(payload));
    }
  });

  afterEach(async () => {
    // Clean up test data
    const userIds = testUsers.map((u) => u._id);
    const driverIds = testDrivers.map((d) => d._id);

    await userModel.deleteMany({ _id: { $in: [...userIds, ...driverIds] } });
    await sessionModel.deleteMany({});
    await rideModel.deleteMany({});

    testUsers = [];
    testDrivers = [];
    userTokens = [];
    driverTokens = [];
  });

  describe('Concurrent Ride Requests', () => {
    it('should handle 50 concurrent ride requests within 2 seconds', async () => {
      const startTime = Date.now();
      const concurrentRequests = 50;

      // Create concurrent ride requests
      const ridePromises: Promise<any>[] = [];
      for (let i = 0; i < concurrentRequests; i++) {
        const userIndex = i % testUsers.length;
        const rideRequest = {
          pickup_location: {
            latitude: testUsers[userIndex].latitude,
            longitude: testUsers[userIndex].longitude,
            address: `${i} Test St, New York, NY`,
          },
          destination_location: {
            latitude: testUsers[userIndex].latitude + 0.01,
            longitude: testUsers[userIndex].longitude + 0.01,
            address: `${i} Destination Ave, New York, NY`,
          },
          vehicle_type: i % 10 === 0 ? 'EMERGENCY' : 'REGULAR', // 10% emergency
          payment_method: 'card',
        };

        const promise = request(app.getHttpServer())
          .post('/v1/ride/request')
          .set('Authorization', `Bearer ${userTokens[userIndex]}`)
          .send(rideRequest);

        ridePromises.push(promise);
      }

      // Execute all requests concurrently
      const responses = await Promise.allSettled(ridePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify performance requirements
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      // Count successful requests
      const successfulRequests = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value?.status === 201,
      ).length;

      // Should handle at least 80% of requests successfully
      expect(successfulRequests).toBeGreaterThanOrEqual(
        concurrentRequests * 0.8,
      );
// console.log removed
    }, 10000); // 10 second timeout

    it('should maintain response times under 500ms for API calls under load', async () => {
      // Create some rides first
      const initialRides: any[] = [];
      for (let i = 0; i < 10; i++) {
        const rideData = await rideService.requestRide(
          testUsers[i]._id.toString(),
          {
            pickup_location: {
              latitude: testUsers[i].latitude,
              longitude: testUsers[i].longitude,
            },
            destination_location: {
              latitude: testUsers[i].latitude + 0.01,
              longitude: testUsers[i].longitude + 0.01,
            },
            vehicle_type: 'REGULAR',
            payment_method: 'card',
          },
        );
        initialRides.push(rideData);
      }

      // Test concurrent API calls
      const apiCallPromises: Promise<any>[] = [];
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const userIndex = i % testUsers.length;
        const rideIndex = i % initialRides.length;

        // Mix different API calls
        if (
          i % 3 === 0 &&
          initialRides[rideIndex] &&
          initialRides[rideIndex].ride_id
        ) {
          // Get ride status
          apiCallPromises.push(
            request(app.getHttpServer())
              .get(`/v1/ride/${initialRides[rideIndex]!.ride_id}/status`)
              .set('Authorization', `Bearer ${userTokens[userIndex]}`),
          );
        } else if (i % 3 === 1) {
          // Get ride history
          apiCallPromises.push(
            request(app.getHttpServer())
              .get('/v1/ride/history?page=1&limit=10')
              .set('Authorization', `Bearer ${userTokens[userIndex]}`),
          );
        } else {
          // Get user profile
          apiCallPromises.push(
            request(app.getHttpServer())
              .get('/v1/user/profile')
              .set('Authorization', `Bearer ${userTokens[userIndex]}`),
          );
        }
      }

      const responses = await Promise.allSettled(apiCallPromises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const averageResponseTime = totalDuration / apiCallPromises.length;

      // Verify performance requirements
      expect(averageResponseTime).toBeLessThan(500); // Average response time under 500ms

      const successfulCalls = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' &&
          (result.value?.status === 200 || result.value?.status === 201),
      ).length;

      expect(successfulCalls).toBeGreaterThanOrEqual(
        apiCallPromises.length * 0.9,
      ); // 90% success rate

      console.log(
        `Average API response time: ${averageResponseTime.toFixed(2)}ms`,
      );
    }, 15000);
  });

  describe('Driver Matching Performance', () => {
    it('should find available drivers within 100ms for geospatial queries', async () => {
      const testLocations = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7589, longitude: -73.9851 },
        { latitude: 40.7505, longitude: -73.9934 },
        { latitude: 40.7282, longitude: -73.7949 },
        { latitude: 40.6892, longitude: -74.0445 },
      ];

      const queryPromises = testLocations.map(async (location) => {
        const startTime = Date.now();

        const drivers = await driverMatchingService.findAvailableDrivers({
          location,
          radius_km: 5,
          vehicle_type: 'REGULAR',
        });

        const endTime = Date.now();
        const queryTime = endTime - startTime;

        return { queryTime, driversFound: drivers.length };
      });

      const results = await Promise.all(queryPromises);

      // All queries should complete within 100ms
      results.forEach((result) => {
        expect(result.queryTime).toBeLessThan(100);
      });

      const averageQueryTime =
        results.reduce((sum, r) => sum + r.queryTime, 0) / results.length;
      console.log(
        `Average geospatial query time: ${averageQueryTime.toFixed(2)}ms`,
      );
    });

    it('should handle concurrent driver matching requests efficiently', async () => {
      const concurrentMatches = 20;
      const startTime = Date.now();

      const matchingPromises: Promise<any>[] = [];
      for (let i = 0; i < concurrentMatches; i++) {
        const location = {
          latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
          longitude: -74.006 + (Math.random() - 0.5) * 0.1,
        };

        matchingPromises.push(
          driverMatchingService.findAvailableDrivers({
            location,
            radius_km: 3,
            vehicle_type: 'REGULAR',
          }),
        );
      }

      const results = await Promise.all(matchingPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete all matching within 1 second
      expect(totalTime).toBeLessThan(1000);

      // Should find drivers for most requests
      const successfulMatches = results.filter(
        (drivers) => drivers && drivers.length > 0,
      ).length;
      expect(successfulMatches).toBeGreaterThan(0);
// console.log removed
    });
  });

  describe('Location Update Performance', () => {
    it('should handle 100 location updates per second', async () => {
      const updatesPerSecond = 100;
      const testDuration = 2000; // 2 seconds
      const totalUpdates = (updatesPerSecond * testDuration) / 1000;

      const startTime = Date.now();
      const updatePromises: Promise<any>[] = [];

      for (let i = 0; i < totalUpdates; i++) {
        const driverIndex = i % testDrivers.length;
        const driver = testDrivers[driverIndex];

        const locationPayload = {
          lat: (40.7128 + (Math.random() - 0.5) * 0.01).toString(),
          long: (-74.006 + (Math.random() - 0.5) * 0.01).toString(),
        };

        updatePromises.push(
          webSocketService.save_coordinates(driver, locationPayload),
        );

        // Add small delay to simulate real-time updates
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      const results = await Promise.allSettled(updatePromises);
      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      const successfulUpdates = results.filter(
        (result) => result.status === 'fulfilled',
      ).length;

      // Should handle at least 90% of updates successfully
      expect(successfulUpdates).toBeGreaterThanOrEqual(totalUpdates * 0.9);

      // Calculate actual updates per second
      const actualUpdatesPerSecond =
        (successfulUpdates / actualDuration) * 1000;
      expect(actualUpdatesPerSecond).toBeGreaterThanOrEqual(80); // At least 80 updates/second

      console.log(
        `Processed ${successfulUpdates} location updates in ${actualDuration}ms (${actualUpdatesPerSecond.toFixed(2)} updates/sec)`,
      );
    }, 10000);
  });

  describe('Database Performance', () => {
    it('should maintain query performance under concurrent load', async () => {
      // Create test data
      const testRides: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        const ride = new rideModel({
          user_id: testUsers[i % testUsers.length]._id,
          driver_id: testDrivers[i % testDrivers.length]._id,
          pickup_location: {
            latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
            longitude: -74.006 + (Math.random() - 0.5) * 0.1,
          },
          destination_location: {
            latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
            longitude: -74.006 + (Math.random() - 0.5) * 0.1,
          },
          vehicle_type: 'REGULAR',
          status: RideStatus.COMPLETED,
          estimated_fare: 100 + Math.random() * 100,
          final_fare: 100 + Math.random() * 100,
          distance_km: 1 + Math.random() * 10,
          duration_minutes: 5 + Math.random() * 30,
          requested_at: new Date(
            Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
          ),
          ride_completed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        });
        testRides.push(ride.save());
      }
      await Promise.all(testRides);

      // Test concurrent database queries
      const queryPromises: Promise<any>[] = [];
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const userIndex = i % testUsers.length;

        if (i % 4 === 0) {
          // Ride history query
          queryPromises.push(
            rideModel
              .find({
                user_id: testUsers[userIndex]._id,
              })
              .limit(10)
              .lean(),
          );
        } else if (i % 4 === 1) {
          // Driver query
          queryPromises.push(
            userModel
              .find({
                role: UserType.DRIVER,
                is_online: true,
              })
              .limit(10)
              .lean(),
          );
        } else if (i % 4 === 2) {
          // Geospatial query
          queryPromises.push(
            userModel
              .find({
                location: {
                  $nearSphere: {
                    $geometry: {
                      type: 'Point',
                      coordinates: [-74.006, 40.7128],
                    },
                    $maxDistance: 5000, // 5km
                  },
                },
              })
              .limit(10)
              .lean(),
          );
        } else {
          // Active rides query
          queryPromises.push(
            rideModel
              .find({
                status: { $in: [RideStatus.REQUESTED, RideStatus.IN_PROGRESS] },
              })
              .limit(10)
              .lean(),
          );
        }
      }

      const results = await Promise.allSettled(queryPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageQueryTime = totalTime / queryPromises.length;

      // Database queries should average under 100ms
      expect(averageQueryTime).toBeLessThan(100);

      const successfulQueries = results.filter(
        (result) => result.status === 'fulfilled',
      ).length;

      // Should have high success rate
      expect(successfulQueries).toBeGreaterThanOrEqual(
        queryPromises.length * 0.95,
      );

      console.log(
        `Average database query time: ${averageQueryTime.toFixed(2)}ms`,
      );
    }, 15000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not have significant memory leaks during high load', async () => {
      const initialMemory = process.memoryUsage();

      // Simulate high load operations
      const operations: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        const userIndex = i % testUsers.length;
        const driverIndex = i % testDrivers.length;

        // Mix of operations
        if (i % 3 === 0) {
          operations.push(
            rideService
              .requestRide(testUsers[userIndex]._id.toString(), {
                pickup_location: { latitude: 40.7128, longitude: -74.006 },
                destination_location: { latitude: 40.72, longitude: -74.0 },
                vehicle_type: 'REGULAR',
                payment_method: 'card',
              })
              .catch(() => {}), // Ignore errors for memory test
          );
        } else if (i % 3 === 1) {
          operations.push(
            driverMatchingService
              .findAvailableDrivers({
                location: { latitude: 40.7128, longitude: -74.006 },
                radius_km: 5,
                vehicle_type: 'REGULAR',
              })
              .catch(() => {}),
          );
        } else {
          operations.push(
            webSocketService
              .save_coordinates(testDrivers[driverIndex], {
                lat: '40.7128',
                long: '-74.006',
              })
              .catch(() => {}),
          );
        }
      }

      await Promise.allSettled(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncreaseMB).toBeLessThan(100);

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      console.log(
        `Final heap usage: ${(finalMemory.heapUsed / (1024 * 1024)).toFixed(2)}MB`,
      );
    }, 30000);
  });

  describe('Error Handling Under Load', () => {
    it('should handle errors gracefully under high concurrent load', async () => {
      const concurrentRequests = 100;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        // Mix valid and invalid requests to test error handling
        if (i % 10 === 0) {
          // Invalid request (missing required fields)
          promises.push(
            request(app.getHttpServer())
              .post('/v1/ride/request')
              .set(
                'Authorization',
                `Bearer ${userTokens[i % userTokens.length]}`,
              )
              .send({
                pickup_location: { latitude: 40.7128 }, // Missing longitude
                vehicle_type: 'REGULAR',
              })
              .catch(() => ({ status: 400 })), // Handle expected errors
          );
        } else if (i % 15 === 0) {
          // Invalid token
          promises.push(
            request(app.getHttpServer())
              .get('/v1/user/profile')
              .set('Authorization', 'Bearer invalid-token')
              .catch(() => ({ status: 401 })),
          );
        } else {
          // Valid request
          const userIndex = i % testUsers.length;
          promises.push(
            request(app.getHttpServer())
              .post('/v1/ride/request')
              .set('Authorization', `Bearer ${userTokens[userIndex]}`)
              .send({
                pickup_location: {
                  latitude: testUsers[userIndex].latitude,
                  longitude: testUsers[userIndex].longitude,
                },
                destination_location: {
                  latitude: testUsers[userIndex].latitude + 0.01,
                  longitude: testUsers[userIndex].longitude + 0.01,
                },
                vehicle_type: 'REGULAR',
                payment_method: 'card',
              }),
          );
        }
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle all requests (valid and invalid) within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Count different response types
      const validRequests = results.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value?.status === 201,
      ).length;

      const errorResponses = results.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' &&
          (result.value?.status === 400 || result.value?.status === 401),
      ).length;

      const systemErrors = results.filter(
        (
          result,
        ): result is PromiseRejectedResult | PromiseFulfilledResult<any> =>
          result.status === 'rejected' ||
          (result.status === 'fulfilled' && result.value?.status >= 500),
      ).length;

      // Should have minimal system errors (< 5%)
      expect(systemErrors).toBeLessThan(concurrentRequests * 0.05);
// console.log removed
    }, 15000);
  });
});
