/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import * as fc from 'fast-check';

import { RideService } from '../ride/ride.service';
import { PrivacyService } from '../common/privacy.service';
import { RideStateMachineService } from '../ride/ride-state-machine.service';
import { DriverMatchingService } from '../driver/driver-matching.service';
import { User } from '../user/entities/user.entity';
import { Ride } from '../ride/entities/ride.entity';
import { Session } from '../user/entities/session.entity';
import { Notification } from '../entities/notification.entity';
import { RideStatus } from '../common/utils';

describe('Ride History Privacy Property Tests', () => {
  let rideService: RideService;

  // Mock models
  const mockUserModel = {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockRideModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockSessionModel = {
    find: jest.fn(),
    findById: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockNotificationModel = {
    find: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockRideStateMachine = {
    transitionRideStatus: jest.fn(),
    getRideStatusHistory: jest.fn(),
    canCancelRide: jest.fn(),
  };

  const mockDriverMatchingService = {
    distributeRideOffers: jest.fn(),
    assignDriver: jest.fn(),
    findAvailableDrivers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RideService,
        PrivacyService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Ride.name),
          useValue: mockRideModel,
        },
        {
          provide: getModelToken(Session.name),
          useValue: mockSessionModel,
        },
        {
          provide: getModelToken(Notification.name),
          useValue: mockNotificationModel,
        },
        {
          provide: RideStateMachineService,
          useValue: mockRideStateMachine,
        },
        {
          provide: DriverMatchingService,
          useValue: mockDriverMatchingService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-key'),
          },
        },
      ],
    }).compile();

    rideService = module.get<RideService>(RideService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  /**
   * Property 13: Ride History Privacy
   * For any user requesting ride history, the returned rides should only include
   * rides where the user is either the passenger or the assigned driver, never rides from other users.
   * Validates: Requirements 2.7, 9.4, 9.5
   */
  describe('Property 13: Ride History Privacy', () => {
    it('should only return rides where user is passenger or driver for all valid users', async () => {
      // Feature: ride-hailing-backend-integration, Property 13: Ride History Privacy

      const userArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        first_name: fc.string({ minLength: 1, maxLength: 50 }),
        last_name: fc.string({ minLength: 1, maxLength: 50 }),
        email: fc.emailAddress(),
        role: fc.constantFrom('USER', 'DRIVER', 'ADMIN'),
      });

      const locationArbitrary = fc.record({
        latitude: fc.double({ min: -90, max: 90 }),
        longitude: fc.double({ min: -180, max: 180 }),
        address: fc.option(fc.string({ minLength: 5, maxLength: 100 }), {
          nil: undefined,
        }),
      });

      const rideArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        user_id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        driver_id: fc.option(
          fc
            .hexaString({ minLength: 24, maxLength: 24 })
            .map((s) => new Types.ObjectId(s)),
          { nil: undefined },
        ),
        pickup_location: locationArbitrary,
        destination_location: locationArbitrary,
        status: fc.constantFrom(...Object.values(RideStatus)),
        estimated_fare: fc.integer({ min: 50, max: 1000 }),
        final_fare: fc.option(fc.integer({ min: 50, max: 1000 }), {
          nil: undefined,
        }),
        duration_minutes: fc.option(fc.integer({ min: 5, max: 120 }), {
          nil: undefined,
        }),
        created_at: fc.date(),
      });

      const testScenarioArbitrary = fc.record({
        requestingUser: userArbitrary,
        targetUser: userArbitrary,
        rides: fc.array(rideArbitrary, { minLength: 1, maxLength: 10 }),
        pagination: fc.record({
          page: fc.integer({ min: 1, max: 5 }),
          limit: fc.integer({ min: 5, max: 20 }),
        }),
      });

      await fc.assert(
        fc.asyncProperty(testScenarioArbitrary, async (scenario) => {
          const { requestingUser, targetUser, rides, pagination } = scenario;

          // Mock user lookup
          mockUserModel.findById.mockImplementation((id) => {
            if (id.toString() === requestingUser._id.toString()) {
              return Promise.resolve(requestingUser);
            }
            if (id.toString() === targetUser._id.toString()) {
              return Promise.resolve(targetUser);
            }
            return Promise.resolve(null);
          });

          // Create rides with mixed ownership
          const userRides = rides.map((ride) => ({
            ...ride,
            user_id:
              Math.random() > 0.5 ? targetUser._id : new Types.ObjectId(),
            driver_id:
              Math.random() > 0.5
                ? targetUser._id
                : Math.random() > 0.5
                  ? new Types.ObjectId()
                  : undefined,
          }));

          // Filter rides that should be accessible to target user
          const accessibleRides = userRides.filter(
            (ride) =>
              ride.user_id.toString() === targetUser._id.toString() ||
              (ride.driver_id &&
                ride.driver_id.toString() === targetUser._id.toString()),
          );

          // Mock ride queries with proper pagination
          const skip = (pagination.page - 1) * pagination.limit;
          const paginatedRides = accessibleRides.slice(
            skip,
            skip + pagination.limit,
          );

          mockRideModel.find.mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue(paginatedRides),
                }),
              }),
            }),
          });

          mockRideModel.countDocuments.mockResolvedValue(
            accessibleRides.length,
          );

          // Mock privacy validation - allow access if requesting own data or admin
          const hasAccess =
            requestingUser._id.toString() === targetUser._id.toString() ||
            requestingUser.role === 'ADMIN';

          if (!hasAccess) {
            // Should throw ForbiddenException for unauthorized access
            await expect(
              rideService.getRideHistory(
                targetUser._id.toString(),
                pagination,
                requestingUser._id.toString(),
              ),
            ).rejects.toThrow('Access denied to ride history');
            return;
          }

          // Execute the ride history request
          const result = await rideService.getRideHistory(
            targetUser._id.toString(),
            pagination,
            requestingUser._id.toString(),
          );

          // Verify privacy constraints
          expect(result).toBeDefined();
          expect(result.rides).toBeDefined();
          expect(Array.isArray(result.rides)).toBe(true);

          // Property: All returned rides should involve the target user as passenger or driver
          for (const returnedRide of result.rides) {
            const originalRide = accessibleRides.find(
              (r) => r._id.toString() === returnedRide.ride_id,
            );
            expect(originalRide).toBeDefined();

            const isPassenger =
              originalRide!.user_id.toString() === targetUser._id.toString();
            const isDriver =
              originalRide!.driver_id?.toString() === targetUser._id.toString();

            expect(isPassenger || isDriver).toBe(true);
          }

          // Verify pagination is respected
          expect(result.rides.length).toBeLessThanOrEqual(pagination.limit);
          expect(result.page).toBe(pagination.page);
          expect(result.limit).toBe(pagination.limit);
          expect(result.total).toBe(accessibleRides.length);
        }),
        { numRuns: 100 },
      );
    });

    it('should filter sensitive location data for non-involved users', async () => {
      // Feature: ride-hailing-backend-integration, Property 13: Ride History Privacy

      const sensitiveRideArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        user_id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        driver_id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        pickup_location: fc.record({
          latitude: fc.double({ min: -90, max: 90 }),
          longitude: fc.double({ min: -180, max: 180 }),
          address: fc.string({ minLength: 10, maxLength: 100 }), // Always include address
        }),
        destination_location: fc.record({
          latitude: fc.double({ min: -90, max: 90 }),
          longitude: fc.double({ min: -180, max: 180 }),
          address: fc.string({ minLength: 10, maxLength: 100 }), // Always include address
        }),
        status: fc.constantFrom(...Object.values(RideStatus)),
        estimated_fare: fc.integer({ min: 50, max: 1000 }),
      });

      const testScenarioArbitrary = fc.record({
        adminUser: fc.record({
          _id: fc
            .hexaString({ minLength: 24, maxLength: 24 })
            .map((s) => new Types.ObjectId(s)),
          role: fc.constant('ADMIN'),
        }),
        targetUser: fc.record({
          _id: fc
            .hexaString({ minLength: 24, maxLength: 24 })
            .map((s) => new Types.ObjectId(s)),
          role: fc.constantFrom('USER', 'DRIVER'),
        }),
        thirdPartyUser: fc.record({
          _id: fc
            .hexaString({ minLength: 24, maxLength: 24 })
            .map((s) => new Types.ObjectId(s)),
          role: fc.constantFrom('USER', 'DRIVER'),
        }),
        ride: sensitiveRideArbitrary,
      });

      await fc.assert(
        fc.asyncProperty(testScenarioArbitrary, async (scenario) => {
          const { adminUser, targetUser, thirdPartyUser, ride } = scenario;

          // Ensure the ride involves the target user but not the third party user
          const modifiedRide = {
            ...ride,
            user_id: targetUser._id,
            driver_id: new Types.ObjectId(), // Different from thirdPartyUser
          };

          // Mock user lookups
          mockUserModel.findById.mockImplementation((id) => {
            if (id.toString() === adminUser._id.toString())
              return Promise.resolve(adminUser);
            if (id.toString() === targetUser._id.toString())
              return Promise.resolve(targetUser);
            if (id.toString() === thirdPartyUser._id.toString())
              return Promise.resolve(thirdPartyUser);
            return Promise.resolve(null);
          });

          // Mock ride queries
          mockRideModel.find.mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([modifiedRide]),
                }),
              }),
            }),
          });

          mockRideModel.countDocuments.mockResolvedValue(1);

          const pagination = { page: 1, limit: 10 };

          // Test 1: Target user accessing their own data should see full details
          const ownDataResult = await rideService.getRideHistory(
            targetUser._id.toString(),
            pagination,
            targetUser._id.toString(),
          );

          expect(ownDataResult.rides).toHaveLength(1);
          const ownRide = ownDataResult.rides[0];
          if (ownRide) {
            expect(ownRide.pickup_location.address).toBeDefined();
            expect(ownRide.destination_location.address).toBeDefined();
          }

          // Test 2: Admin accessing user data should see full details
          const adminDataResult = await rideService.getRideHistory(
            targetUser._id.toString(),
            pagination,
            adminUser._id.toString(),
          );

          expect(adminDataResult.rides).toHaveLength(1);
          const adminRide = adminDataResult.rides[0];
          if (adminRide) {
            expect(adminRide.pickup_location.address).toBeDefined();
            expect(adminRide.destination_location.address).toBeDefined();
          }

          // Test 3: Third party user should be denied access
          await expect(
            rideService.getRideHistory(
              targetUser._id.toString(),
              pagination,
              thirdPartyUser._id.toString(),
            ),
          ).rejects.toThrow('Access denied to ride history');
        }),
        { numRuns: 100 },
      );
    });

    it('should handle edge cases with empty ride history', async () => {
      // Feature: ride-hailing-backend-integration, Property 13: Ride History Privacy

      const userArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        role: fc.constantFrom('USER', 'DRIVER'),
      });

      await fc.assert(
        fc.asyncProperty(userArbitrary, async (user) => {
          // Mock user lookup
          mockUserModel.findById.mockResolvedValue(user);

          // Mock empty ride results
          mockRideModel.find.mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          });

          mockRideModel.countDocuments.mockResolvedValue(0);

          const pagination = { page: 1, limit: 10 };

          // Execute the ride history request
          const result = await rideService.getRideHistory(
            user._id.toString(),
            pagination,
            user._id.toString(),
          );

          // Verify empty results are handled correctly
          expect(result).toBeDefined();
          expect(result.rides).toEqual([]);
          expect(result.total).toBe(0);
          expect(result.page).toBe(pagination.page);
          expect(result.limit).toBe(pagination.limit);
        }),
        { numRuns: 100 },
      );
    });
  });
});
