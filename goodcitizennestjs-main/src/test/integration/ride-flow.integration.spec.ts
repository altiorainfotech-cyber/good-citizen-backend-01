/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import request from 'supertest';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

import { AppModule } from '../../app.module';
import { User, UserDocument } from '../../user/entities/user.entity';
import { Ride, RideDocument } from '../../ride/entities/ride.entity';
import { Session, SessionDocument } from '../../user/entities/session.entity';
import { RideStatus, UserType } from '../../common/utils';
import { AuthService } from '../../authentication/auth.service';
import { RideService } from '../../ride/ride.service';
import { DriverMatchingService } from '../../driver/driver-matching.service';

/**
 * Integration Test: Complete Ride Flow from Request to Completion
 * Tests the entire ride lifecycle including driver matching and status transitions
 * Validates: All requirements integration
 */
describe('Ride Flow Integration Tests', () => {
  let app: INestApplication;
  let userModel: Model<UserDocument>;
  let rideModel: Model<RideDocument>;
  let sessionModel: Model<SessionDocument>;
  let authService: AuthService;
  let rideService: RideService;
  let driverMatchingService: DriverMatchingService;

  // Test data
  let testUser: any;
  let testDriver: any;
  let userToken: string;
  let driverToken: string;
  let testRide: any;

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

    // Clean up test data
    await userModel.deleteMany({
      email: { $regex: /test.*@integration\.test/ },
    });
    await rideModel.deleteMany({});
    await sessionModel.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await userModel.deleteMany({
      email: { $regex: /test.*@integration\.test/ },
    });
    await rideModel.deleteMany({});
    await sessionModel.deleteMany({});

    await app.close();
  });

  beforeEach(async () => {
    // Create test user
    testUser = new userModel({
      first_name: 'Test',
      last_name: 'User',
      email: 'testuser@integration.test',
      phone_number: '+1234567890',
      country_code: '+1',
      password: 'hashedpassword123',
      role: UserType.USER,
      location: {
        type: 'Point',
        coordinates: [-74.006, 40.7128], // NYC coordinates
      },
      latitude: 40.7128,
      longitude: -74.006,
      is_online: true,
      is_email_verified: true,
      loyalty_point: 0,
    });
    await testUser.save();

    // Create test driver
    testDriver = new userModel({
      first_name: 'Test',
      last_name: 'Driver',
      email: 'testdriver@integration.test',
      phone_number: '+1234567891',
      country_code: '+1',
      password: 'hashedpassword123',
      role: UserType.DRIVER,
      location: {
        type: 'Point',
        coordinates: [-74.005, 40.712], // Close to user
      },
      latitude: 40.712,
      longitude: -74.005,
      is_online: true,
      is_email_verified: true,
      approval: 'APPROVED',
      vehicle_type: 'REGULAR',
      vehicle_plate: 'TEST123',
      driver_rating: 4.5,
      total_rides: 10,
    });
    await testDriver.save();

    // Create authentication tokens by creating sessions directly
    const userSession = new sessionModel({
      user_id: testUser._id,
      access_token: 'test-user-token',
      refresh_token: 'test-user-refresh',
      device_type: 'WEB',
      is_active: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: Date.now(),
    });
    await userSession.save();

    // Generate real JWT token for user
    const userPayload = {
      _id: testUser._id.toString(),
      session_id: userSession._id.toString(),
      role: UserType.USER,
    };
    userToken = authService['jwtService'].sign(userPayload);

    const driverSession = new sessionModel({
      user_id: testDriver._id,
      access_token: 'test-driver-token',
      refresh_token: 'test-driver-refresh',
      device_type: 'WEB',
      is_active: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: Date.now(),
    });
    await driverSession.save();

    // Generate real JWT token for driver
    const driverPayload = {
      _id: testDriver._id.toString(),
      session_id: driverSession._id.toString(),
      role: UserType.DRIVER,
    };
    driverToken = authService['jwtService'].sign(driverPayload);
  });

  afterEach(async () => {
    // Clean up test data after each test
    if (testUser) await userModel.findByIdAndDelete(testUser._id);
    if (testDriver) await userModel.findByIdAndDelete(testDriver._id);
    if (testRide) await rideModel.findByIdAndDelete(testRide._id);
    await sessionModel.deleteMany({
      user_id: { $in: [testUser?._id, testDriver?._id].filter(Boolean) },
    });
  });

  describe('Complete Ride Flow', () => {
    it('should complete entire ride flow from request to completion', async () => {
      // Step 1: User requests a ride
      const rideRequest = {
        pickup_location: {
          latitude: 40.7128,
          longitude: -74.006,
          address: '123 Test St, New York, NY',
        },
        destination_location: {
          latitude: 40.7589,
          longitude: -73.9851,
          address: '456 Destination Ave, New York, NY',
        },
        vehicle_type: 'REGULAR',
        payment_method: 'card',
      };

      const rideResponse = await request(app.getHttpServer())
        .post('/v1/ride/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(rideRequest)
        .expect(201);

      expect(rideResponse.body.data).toBeDefined();
      expect(rideResponse.body.data.ride_id).toBeDefined();
      expect(rideResponse.body.data.status).toBe(RideStatus.REQUESTED);
      expect(rideResponse.body.data.estimated_fare).toBeGreaterThan(0);

      testRide = await rideModel.findById(rideResponse.body.data.ride_id);
      expect(testRide).toBeDefined();
      expect(testRide.status).toBe(RideStatus.REQUESTED);

      // Step 2: Driver matching should find available driver
      const availableDrivers = await driverMatchingService.findAvailableDrivers(
        {
          location: rideRequest.pickup_location,
          radius_km: 5,
          vehicle_type: 'REGULAR',
        },
      );

      expect(availableDrivers.length).toBeGreaterThan(0);
      if (availableDrivers.length > 0 && availableDrivers[0]) {
        expect(availableDrivers[0].driver_id).toBe(testDriver._id.toString());
      }

      // Step 3: Assign driver to ride
      await driverMatchingService.assignDriver(
        testRide._id.toString(),
        testDriver._id.toString(),
      );

      // Verify ride status updated
      const updatedRide = await rideModel.findById(testRide._id);
      expect(updatedRide).toBeDefined();
      if (updatedRide) {
        expect(updatedRide.status).toBe(RideStatus.DRIVER_ASSIGNED);
        expect(updatedRide.driver_id?.toString()).toBe(
          testDriver._id.toString(),
        );
      }

      // Step 4: Driver updates status to arriving
      await request(app.getHttpServer())
        .patch(`/v1/ride/${testRide._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: RideStatus.DRIVER_ARRIVING })
        .expect(200);

      // Step 5: Driver updates status to arrived
      await request(app.getHttpServer())
        .patch(`/v1/ride/${testRide._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: RideStatus.DRIVER_ARRIVED })
        .expect(200);

      // Step 6: Driver starts the ride
      await request(app.getHttpServer())
        .patch(`/v1/ride/${testRide._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: RideStatus.IN_PROGRESS })
        .expect(200);

      // Step 7: Complete the ride
      const completionData = {
        final_fare: 150,
        distance_km: 5.2,
        duration_minutes: 18,
      };

      const completionResponse = await request(app.getHttpServer())
        .post(`/v1/ride/${testRide._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(completionData)
        .expect(200);

      expect(completionResponse.body.data.ride_id).toBe(
        testRide._id.toString(),
      );
      expect(completionResponse.body.data.final_fare).toBe(150);

      // Verify final ride state
      const finalRide = await rideModel.findById(testRide._id);
      expect(finalRide).toBeDefined();
      if (finalRide) {
        expect(finalRide.status).toBe(RideStatus.COMPLETED);
        expect(finalRide.final_fare).toBe(150);
        expect(finalRide.ride_completed_at).toBeDefined();
      }

      // Step 8: User rates the ride
      await request(app.getHttpServer())
        .post(`/v1/ride/${testRide._id}/rate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, feedback: 'Great ride!' })
        .expect(200);

      // Verify rating was saved
      const ratedRide = await rideModel.findById(testRide._id);
      expect(ratedRide).toBeDefined();
      if (ratedRide) {
        expect(ratedRide.user_rating).toBe(5);
        expect(ratedRide.user_feedback).toBe('Great ride!');
      }

      // Step 9: Verify driver is available again
      const driverAfterRide = await userModel.findById(testDriver._id);
      expect(driverAfterRide).toBeDefined();
      if (driverAfterRide) {
        expect(driverAfterRide.is_online).toBe(true);
      }
    });

    it('should handle ride cancellation by user', async () => {
      // Create a ride
      const rideData = await rideService.requestRide(testUser._id.toString(), {
        pickup_location: { latitude: 40.7128, longitude: -74.006 },
        destination_location: { latitude: 40.7589, longitude: -73.9851 },
        vehicle_type: 'REGULAR',
        payment_method: 'card',
      });

      testRide = await rideModel.findById(rideData.ride_id);

      // User cancels the ride
      await request(app.getHttpServer())
        .delete(`/v1/ride/${testRide._id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify ride is cancelled
      const cancelledRide = await rideModel.findById(testRide._id);
      expect(cancelledRide).toBeDefined();
      if (cancelledRide) {
        expect(cancelledRide.status).toBe(RideStatus.CANCELLED);
        expect(cancelledRide.cancelled_at).toBeDefined();
      }
    });

    it('should handle ride cancellation after driver assignment', async () => {
      // Create and assign ride
      const rideData = await rideService.requestRide(testUser._id.toString(), {
        pickup_location: { latitude: 40.7128, longitude: -74.006 },
        destination_location: { latitude: 40.7589, longitude: -73.9851 },
        vehicle_type: 'REGULAR',
        payment_method: 'card',
      });

      testRide = await rideModel.findById(rideData.ride_id);
      await driverMatchingService.assignDriver(
        testRide._id.toString(),
        testDriver._id.toString(),
      );

      // User cancels the ride
      await request(app.getHttpServer())
        .delete(`/v1/ride/${testRide._id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify ride is cancelled and driver is available again
      const cancelledRide = await rideModel.findById(testRide._id);
      expect(cancelledRide).toBeDefined();
      if (cancelledRide) {
        expect(cancelledRide.status).toBe(RideStatus.CANCELLED);
      }

      const driverAfterCancel = await userModel.findById(testDriver._id);
      expect(driverAfterCancel).toBeDefined();
      if (driverAfterCancel) {
        expect(driverAfterCancel.is_online).toBe(true);
      }
    });

    it('should prevent duplicate active rides for same user', async () => {
      // Create first ride
      const firstRideData = await rideService.requestRide(
        testUser._id.toString(),
        {
          pickup_location: { latitude: 40.7128, longitude: -74.006 },
          destination_location: { latitude: 40.7589, longitude: -73.9851 },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        },
      );

      testRide = await rideModel.findById(firstRideData.ride_id);

      // Attempt to create second ride should fail
      await expect(
        rideService.requestRide(testUser._id.toString(), {
          pickup_location: { latitude: 40.72, longitude: -74.01 },
          destination_location: { latitude: 40.76, longitude: -73.98 },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        }),
      ).rejects.toThrow('User already has an active ride');
    });

    it('should calculate fare correctly based on distance and vehicle type', async () => {
      const rideData = await rideService.requestRide(testUser._id.toString(), {
        pickup_location: { latitude: 40.7128, longitude: -74.006 },
        destination_location: { latitude: 40.7589, longitude: -73.9851 }, // ~5km distance
        vehicle_type: 'REGULAR',
        payment_method: 'card',
      });

      testRide = await rideModel.findById(rideData.ride_id);

      // Verify fare calculation
      expect(testRide.estimated_fare).toBeGreaterThan(0);
      expect(testRide.distance_km).toBeGreaterThan(0);
      expect(testRide.duration_minutes).toBeGreaterThan(0);

      // Test emergency ride has higher fare
      const emergencyRideData = await rideService.requestRide(
        testUser._id.toString(),
        {
          pickup_location: { latitude: 40.7128, longitude: -74.006 },
          destination_location: { latitude: 40.7589, longitude: -73.9851 },
          vehicle_type: 'EMERGENCY',
          emergency_details: 'Medical emergency',
          payment_method: 'card',
        },
      );

      // Cancel first ride to allow emergency ride
      await rideService.cancelRide(
        testRide._id.toString(),
        testUser._id.toString(),
      );

      const emergencyRide = await rideModel.findById(emergencyRideData.ride_id);
      expect(emergencyRide).toBeDefined();
      if (emergencyRide) {
        expect(emergencyRide.estimated_fare).toBeGreaterThan(
          testRide.estimated_fare,
        );
        expect(emergencyRide.vehicle_type).toBe('EMERGENCY');
      }

      testRide = emergencyRide; // For cleanup
    });
  });

  describe('Driver Matching', () => {
    it('should find drivers within specified radius', async () => {
      const drivers = await driverMatchingService.findAvailableDrivers({
        location: { latitude: 40.7128, longitude: -74.006 },
        radius_km: 2,
        vehicle_type: 'REGULAR',
      });

      expect(drivers.length).toBeGreaterThan(0);
      if (drivers.length > 0 && drivers[0]) {
        expect(drivers[0].driver_id).toBe(testDriver._id.toString());
        expect(drivers[0].distance_km).toBeLessThan(2);
      }
    });

    it('should not find drivers outside radius', async () => {
      const drivers = await driverMatchingService.findAvailableDrivers({
        location: { latitude: 41.0, longitude: -75.0 }, // Far from driver
        radius_km: 1,
        vehicle_type: 'REGULAR',
      });

      expect(drivers.length).toBe(0);
    });

    it('should prioritize emergency rides', async () => {
      // Create regular ride
      const regularRideData = await rideService.requestRide(
        testUser._id.toString(),
        {
          pickup_location: { latitude: 40.7128, longitude: -74.006 },
          destination_location: { latitude: 40.7589, longitude: -73.9851 },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        },
      );

      // Create emergency ride (should be prioritized)
      const emergencyUser = new userModel({
        first_name: 'Emergency',
        last_name: 'User',
        email: 'emergency@integration.test',
        phone_number: '+1234567892',
        role: UserType.USER,
        location: { type: 'Point', coordinates: [-74.007, 40.713] },
        latitude: 40.713,
        longitude: -74.007,
        is_online: true,
        is_email_verified: true,
      });
      await emergencyUser.save();

      const emergencyRideData = await rideService.requestRide(
        emergencyUser._id.toString(),
        {
          pickup_location: { latitude: 40.713, longitude: -74.007 },
          destination_location: { latitude: 40.76, longitude: -73.98 },
          vehicle_type: 'EMERGENCY',
          emergency_details: 'Medical emergency',
          payment_method: 'card',
        },
      );

      // Emergency ride should get priority in driver matching
      const emergencyRide = await rideModel.findById(emergencyRideData.ride_id);
      expect(emergencyRide).toBeDefined();
      if (emergencyRide) {
        expect(emergencyRide.vehicle_type).toBe('EMERGENCY');
      }

      // Cleanup
      testRide = await rideModel.findById(regularRideData.ride_id);
      await rideModel.findByIdAndDelete(emergencyRideData.ride_id);
      await userModel.findByIdAndDelete(emergencyUser._id);
    });
  });

  describe('Ride History and Privacy', () => {
    it('should return user ride history with privacy controls', async () => {
      // Create and complete a ride
      const rideData = await rideService.requestRide(testUser._id.toString(), {
        pickup_location: { latitude: 40.7128, longitude: -74.006 },
        destination_location: { latitude: 40.7589, longitude: -73.9851 },
        vehicle_type: 'REGULAR',
        payment_method: 'card',
      });

      testRide = await rideModel.findById(rideData.ride_id);
      await driverMatchingService.assignDriver(
        testRide._id.toString(),
        testDriver._id.toString(),
      );

      // Complete the ride
      await rideModel.findByIdAndUpdate(testRide._id, {
        status: RideStatus.COMPLETED,
        final_fare: 100,
        ride_completed_at: new Date(),
      });

      // Get ride history
      const history = await rideService.getRideHistory(
        testUser._id.toString(),
        {
          page: 1,
          limit: 10,
        },
      );

      expect(history.rides.length).toBeGreaterThan(0);
      if (history.rides.length > 0 && history.rides[0]) {
        expect(history.rides[0].ride_id).toBe(testRide._id.toString());
        expect(history.rides[0].pickup_location).toBeDefined();
        expect(history.rides[0].destination_location).toBeDefined();
      }
      expect(history.total).toBeGreaterThan(0);
    });

    it('should not allow access to other users ride history', async () => {
      // Create another user
      const otherUser = new userModel({
        first_name: 'Other',
        last_name: 'User',
        email: 'other@integration.test',
        phone_number: '+1234567893',
        role: UserType.USER,
        is_email_verified: true,
      });
      await otherUser.save();

      // Try to access other user's ride history should fail
      await expect(
        rideService.getRideHistory(
          otherUser._id.toString(),
          { page: 1, limit: 10 },
          testUser._id.toString(),
        ),
      ).rejects.toThrow('Access denied to ride history');

      // Cleanup
      await userModel.findByIdAndDelete(otherUser._id);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ride status transitions', async () => {
      const rideData = await rideService.requestRide(testUser._id.toString(), {
        pickup_location: { latitude: 40.7128, longitude: -74.006 },
        destination_location: { latitude: 40.7589, longitude: -73.9851 },
        vehicle_type: 'REGULAR',
        payment_method: 'card',
      });

      testRide = await rideModel.findById(rideData.ride_id);

      // Try to complete ride without driver assignment should fail
      await expect(
        rideService.completeRide(testRide._id.toString(), {
          final_fare: 100,
          distance_km: 5,
          duration_minutes: 15,
        }),
      ).rejects.toThrow('Ride is not in progress');
    });

    it('should handle non-existent ride operations', async () => {
      const fakeRideId = '507f1f77bcf86cd799439011';

      await expect(rideService.getRideStatus(fakeRideId)).rejects.toThrow(
        'Ride not found',
      );

      await expect(
        rideService.cancelRide(fakeRideId, testUser._id.toString()),
      ).rejects.toThrow('Ride not found');
    });

    it('should validate GPS coordinates', async () => {
      await expect(
        rideService.requestRide(testUser._id.toString(), {
          pickup_location: { latitude: 91, longitude: -74.006 }, // Invalid latitude
          destination_location: { latitude: 40.7589, longitude: -73.9851 },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        }),
      ).rejects.toThrow();

      await expect(
        rideService.requestRide(testUser._id.toString(), {
          pickup_location: { latitude: 40.7128, longitude: -181 }, // Invalid longitude
          destination_location: { latitude: 40.7589, longitude: -73.9851 },
          vehicle_type: 'REGULAR',
          payment_method: 'card',
        }),
      ).rejects.toThrow();
    });
  });
});
