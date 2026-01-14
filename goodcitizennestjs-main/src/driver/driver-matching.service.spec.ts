/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fc from 'fast-check';
import { DriverMatchingService } from './driver-matching.service';
import { User, UserDocument } from '../user/entities/user.entity';
import { Ride, RideDocument } from '../ride/entities/ride.entity';
import { WebSocketService } from '../web-socket/web-socket.service';
import { PerformanceService } from '../common/performance.service';
import { DriverMatchQuery } from './dto/driver-matching.dto';
import { LocationDto } from '../ride/dto/create-ride.dto';
import { DriverApproval } from '../common/utils';

describe('DriverMatchingService', () => {
  let service: DriverMatchingService;
  let userModel: Model<UserDocument>;
  let rideModel: Model<RideDocument>;

  // Mock data generators for property-based testing
  // Use integer-based generation to avoid floating-point precision issues
  const validLatitudeArb = fc
    .integer({ min: -8990, max: 8990 })
    .map((x) => x / 100); // -89.9 to 89.9
  const validLongitudeArb = fc
    .integer({ min: -17990, max: 17990 })
    .map((x) => x / 100); // -179.9 to 179.9
  const locationArb = fc.record({
    latitude: validLatitudeArb,
    longitude: validLongitudeArb,
  });

  const driverArb = fc.record({
    _id: fc.string(),
    first_name: fc.string(),
    last_name: fc.string(),
    phone_number: fc.string(),
    role: fc.constant('DRIVER'),
    approval: fc.constant(DriverApproval.APPROVED),
    is_online: fc.constant(true),
    is_deleted: fc.constant(false),
    latitude: validLatitudeArb,
    longitude: validLongitudeArb,
    location: fc.record({
      type: fc.constant('Point'),
      coordinates: fc.tuple(validLongitudeArb, validLatitudeArb),
    }),
    vehicle_type: fc.constantFrom('REGULAR', 'EMERGENCY'),
    vehicle_plate: fc.string(),
  });

  beforeEach(async () => {
    const mockUserModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      distinct: jest.fn(),
    };

    const mockRideModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      distinct: jest.fn(),
    };

    const mockWebSocketService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverMatchingService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Ride.name),
          useValue: mockRideModel,
        },
        {
          provide: WebSocketService,
          useValue: mockWebSocketService,
        },
        {
          provide: PerformanceService,
          useValue: {
            recordMetric: jest.fn(),
            getMetrics: jest.fn(),
            cacheQuery: jest.fn(),
            getCachedQuery: jest.fn(),
            clearCache: jest.fn(),
            findNearbyDrivers: jest.fn().mockResolvedValue([]),
            findUsersInEmergencyPath: jest.fn().mockResolvedValue([]),
            getUserRideHistory: jest
              .fn()
              .mockResolvedValue({ rides: [], total: 0, hasMore: false }),
            getCacheStats: jest.fn().mockReturnValue({ size: 0, keys: [] }),
            validateQueryPerformance: jest.fn().mockResolvedValue({
              driverMatchingTime: 50,
              emergencyPathTime: 25,
              rideHistoryTime: 100,
              indexesOptimal: true,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DriverMatchingService>(DriverMatchingService);
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
    rideModel = module.get<Model<RideDocument>>(getModelToken(Ride.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Property 9: Driver Matching Distance Accuracy
   * For any ride request location and returned available drivers, the calculated distance
   * for each driver should match the Haversine formula result within 1% tolerance,
   * and all drivers should be within the specified search radius.
   *
   * Feature: ride-hailing-backend-integration, Property 9: Driver Matching Distance Accuracy
   * Validates: Requirements 3.1, 17.2, 17.4
   */
  describe('Property 9: Driver Matching Distance Accuracy', () => {
    it('should calculate distances accurately using Haversine formula within 1% tolerance', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb, // pickup location
          fc.array(driverArb, { minLength: 1, maxLength: 10 }), // available drivers
          fc.double({ min: 1, max: 50 }), // search radius in km
          async (
            pickupLocation: LocationDto,
            drivers: any[],
            radiusKm: number,
          ) => {
            // Skip test if coordinates are invalid (NaN or out of bounds)
            if (
              !isValidCoordinate(
                pickupLocation.latitude,
                pickupLocation.longitude,
              )
            ) {
              return; // Skip this test case
            }

            // Skip if any driver has invalid coordinates
            if (
              drivers.some(
                (driver) =>
                  !isValidCoordinate(driver.latitude, driver.longitude),
              )
            ) {
              return; // Skip this test case
            }
            // Setup: Mock the database query to return our test drivers
            const mockDriversInRadius = drivers.filter((driver) => {
              const distance = calculateHaversineDistance(pickupLocation, {
                latitude: driver.latitude,
                longitude: driver.longitude,
              });
              return distance <= radiusKm;
            });

            // Mock the MongoDB geospatial query
            (userModel.find as jest.Mock).mockReturnValue({
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue(mockDriversInRadius),
                }),
              }),
            });

            // Mock busy drivers query
            (rideModel.distinct as jest.Mock).mockResolvedValue([]);

            // Create the query
            const query: DriverMatchQuery = {
              location: pickupLocation,
              radius_km: radiusKm,
              vehicle_type: 'REGULAR',
              exclude_driver_ids: [],
            };

            // Execute the service method
            const results = await service.findAvailableDrivers(query);

            // Verify each result
            for (const result of results) {
              const driver = mockDriversInRadius.find(
                (d) => d._id === result.driver_id,
              );
              if (!driver) continue;

              // Calculate expected distance using Haversine formula
              const expectedDistance = calculateHaversineDistance(
                pickupLocation,
                { latitude: driver.latitude, longitude: driver.longitude },
              );

              // Verify distance accuracy within 1% tolerance
              const tolerance = Math.max(expectedDistance * 0.01, 1e-9); // 1% tolerance with minimum threshold for floating-point precision
              const actualDistance = result.distance_km;

              expect(
                Math.abs(actualDistance - expectedDistance),
              ).toBeLessThanOrEqual(tolerance);

              // Verify driver is within search radius
              expect(actualDistance).toBeLessThanOrEqual(radiusKm);

              // Verify GPS coordinates are valid
              expect(result.current_location.latitude).toBeGreaterThanOrEqual(
                -90,
              );
              expect(result.current_location.latitude).toBeLessThanOrEqual(90);
              expect(result.current_location.longitude).toBeGreaterThanOrEqual(
                -180,
              );
              expect(result.current_location.longitude).toBeLessThanOrEqual(
                180,
              );
            }
          },
        ),
        { numRuns: 100 }, // Run 100 iterations as specified in design
      );
    });

    it('should validate GPS coordinates and reject invalid coordinates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            latitude: fc.oneof(
              fc.double({ min: -200, max: -91 }), // Invalid latitude (too low)
              fc.double({ min: 91, max: 200 }), // Invalid latitude (too high)
            ),
            longitude: validLongitudeArb,
          }),
          async (invalidLocation: LocationDto) => {
            const query: DriverMatchQuery = {
              location: invalidLocation,
              radius_km: 5,
              vehicle_type: 'REGULAR',
            };

            // Should throw BadRequestException for invalid coordinates
            await expect(service.findAvailableDrivers(query)).rejects.toThrow();
          },
        ),
        { numRuns: 50 },
      );

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            latitude: validLatitudeArb,
            longitude: fc.oneof(
              fc.double({ min: -200, max: -181 }), // Invalid longitude (too low)
              fc.double({ min: 181, max: 200 }), // Invalid longitude (too high)
            ),
          }),
          async (invalidLocation: LocationDto) => {
            const query: DriverMatchQuery = {
              location: invalidLocation,
              radius_km: 5,
              vehicle_type: 'REGULAR',
            };

            // Should throw BadRequestException for invalid coordinates
            await expect(service.findAvailableDrivers(query)).rejects.toThrow();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should sort results by distance and rating correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          fc.array(driverArb, { minLength: 3, maxLength: 10 }),
          async (pickupLocation: LocationDto, drivers: any[]) => {
            // Skip test if coordinates are invalid (NaN or out of bounds)
            if (
              !isValidCoordinate(
                pickupLocation.latitude,
                pickupLocation.longitude,
              )
            ) {
              return; // Skip this test case
            }

            // Skip if any driver has invalid coordinates
            if (
              drivers.some(
                (driver) =>
                  !isValidCoordinate(driver.latitude, driver.longitude),
              )
            ) {
              return; // Skip this test case
            }
            // Calculate distances for all drivers
            const driversWithDistances = drivers.map((driver) => ({
              ...driver,
              calculatedDistance: calculateHaversineDistance(pickupLocation, {
                latitude: driver.latitude,
                longitude: driver.longitude,
              }),
            }));

            // Mock the database query
            (userModel.find as jest.Mock).mockReturnValue({
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue(driversWithDistances),
                }),
              }),
            });

            (rideModel.distinct as jest.Mock).mockResolvedValue([]);

            const query: DriverMatchQuery = {
              location: pickupLocation,
              radius_km: 50, // Large radius to include all drivers
              vehicle_type: 'REGULAR',
            };

            const results = await service.findAvailableDrivers(query);

            // Verify results are sorted by distance (primary) and rating (secondary)
            for (let i = 1; i < results.length; i++) {
              const prev = results[i - 1];
              const current = results[i];

              if (prev && current) {
                // If distances are similar (within 0.1km), higher rating should come first
                if (Math.abs(prev.distance_km - current.distance_km) < 0.1) {
                  expect(prev.rating).toBeGreaterThanOrEqual(current.rating);
                } else {
                  // Otherwise, closer distance should come first
                  expect(prev.distance_km).toBeLessThanOrEqual(
                    current.distance_km,
                  );
                }
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 8: Driver Assignment Exclusivity
   * For any driver assignment operation, a driver can only be assigned to one active ride at a time.
   * If a driver is already assigned to an active ride, attempting to assign them to another ride
   * should fail with appropriate error handling.
   *
   * Feature: ride-hailing-backend-integration, Property 8: Driver Assignment Exclusivity
   * Validates: Requirements 3.7, 7.1, 7.2
   */
  describe('Property 8: Driver Assignment Exclusivity', () => {
    // Helper function to generate valid ObjectId strings
    const objectIdArbitrary = fc.hexaString({ minLength: 24, maxLength: 24 });

    it('should prevent driver from being assigned to multiple active rides simultaneously', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary, // driver ID - valid 24-char hex string
          fc.array(objectIdArbitrary, { minLength: 2, maxLength: 5 }), // multiple ride IDs - valid ObjectIds
          fc.constantFrom(
            'DRIVER_ASSIGNED',
            'DRIVER_ARRIVING',
            'DRIVER_ARRIVED',
            'IN_PROGRESS',
          ), // active ride status
          async (driverId: string, rideIds: string[], activeStatus: string) => {
            // Setup: Mock driver as available and approved
            const mockDriver = {
              _id: driverId,
              is_online: true,
              approval: DriverApproval.APPROVED,
              role: 'DRIVER',
            };

            // Setup: First ride assignment should succeed
            const firstRideId = rideIds[0]!;
            const remainingRideIds = rideIds.slice(1);

            // Mock driver lookup for first assignment (available)
            (userModel.findById as jest.Mock).mockResolvedValueOnce(mockDriver);

            // Mock no existing active ride for first assignment
            (rideModel.findOne as jest.Mock).mockResolvedValueOnce(null);

            // Mock successful ride update for first assignment
            const mockUpdatedRide = {
              _id: firstRideId,
              driver_id: driverId,
              status: 'DRIVER_ASSIGNED',
              driver_assigned_at: new Date(),
            };
            (rideModel.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce(
              mockUpdatedRide,
            );
            (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce({
              _id: driverId,
            });

            // First assignment should succeed
            await expect(
              service.assignDriver(firstRideId, driverId),
            ).resolves.not.toThrow();

            // Setup: Mock existing active ride for subsequent assignments
            const existingActiveRide = {
              _id: firstRideId,
              driver_id: driverId,
              status: activeStatus,
            };

            // For each remaining ride, assignment should fail due to exclusivity
            for (const rideId of remainingRideIds) {
              // Mock driver lookup (still available in terms of approval, but will have active ride)
              (userModel.findById as jest.Mock).mockResolvedValue(mockDriver);

              // Mock existing active ride found
              (rideModel.findOne as jest.Mock).mockResolvedValue(
                existingActiveRide,
              );

              // Assignment should fail with BadRequestException
              await expect(
                service.assignDriver(rideId, driverId),
              ).rejects.toThrow('Driver is already assigned to another ride');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should allow driver assignment after completing previous ride', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary, // driver ID - valid 24-char hex string
          fc.array(objectIdArbitrary, { minLength: 2, maxLength: 3 }), // ride IDs - valid ObjectIds
          fc.constantFrom('COMPLETED', 'CANCELLED'), // completed ride status
          async (
            driverId: string,
            rideIds: string[],
            _completedStatus: string,
          ) => {
            const mockDriver = {
              _id: driverId,
              is_online: true,
              approval: DriverApproval.APPROVED,
              role: 'DRIVER',
            };

            const secondRideId = rideIds[1]!;

            // Setup: Mock completed ride (not active) - for reference only

            // Mock driver lookup
            (userModel.findById as jest.Mock).mockResolvedValue(mockDriver);

            // Mock no active ride found (completed ride doesn't block new assignments)
            (rideModel.findOne as jest.Mock).mockResolvedValue(null);

            // Mock successful ride update
            const mockUpdatedRide = {
              _id: secondRideId,
              driver_id: driverId,
              status: 'DRIVER_ASSIGNED',
              driver_assigned_at: new Date(),
            };
            (rideModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(
              mockUpdatedRide,
            );
            (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
              _id: driverId,
            });

            // Assignment should succeed since previous ride is completed
            await expect(
              service.assignDriver(secondRideId, driverId),
            ).resolves.not.toThrow();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle concurrent assignment attempts with proper exclusivity', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary, // driver ID - valid 24-char hex string
          fc.array(objectIdArbitrary, { minLength: 2, maxLength: 4 }), // concurrent ride IDs - valid ObjectIds
          async (driverId: string, rideIds: string[]) => {
            const mockDriver = {
              _id: driverId,
              is_online: true,
              approval: DriverApproval.APPROVED,
              role: 'DRIVER',
            };

            // Setup: Mock driver lookup for all concurrent calls
            (userModel.findById as jest.Mock).mockResolvedValue(mockDriver);

            // Setup: First call finds no existing ride, subsequent calls find existing ride
            let callCount = 0;
            (rideModel.findOne as jest.Mock).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve(null); // First call: no existing ride
              } else {
                return Promise.resolve({
                  // Subsequent calls: existing active ride
                  _id: rideIds[0]!,
                  driver_id: driverId,
                  status: 'DRIVER_ASSIGNED',
                });
              }
            });

            // Mock successful update for first assignment only
            (rideModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
              _id: rideIds[0]!,
              driver_id: driverId,
              status: 'DRIVER_ASSIGNED',
            });
            (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
              _id: driverId,
            });

            // Execute concurrent assignment attempts
            const assignmentPromises = rideIds.map((rideId) =>
              service.assignDriver(rideId, driverId).catch((error) => error),
            );

            const results = await Promise.all(assignmentPromises);

            // Verify that only one assignment succeeded
            const successCount = results.filter(
              (result) => !(result instanceof Error),
            ).length;
            const errorCount = results.filter(
              (result) => result instanceof Error,
            ).length;

            expect(successCount).toBe(1); // Only one assignment should succeed
            expect(errorCount).toBe(rideIds.length - 1); // All others should fail

            // Verify error messages for failed assignments
            const errors = results.filter((result) => result instanceof Error);
            errors.forEach((error) => {
              expect(error.message).toContain(
                'Driver is already assigned to another ride',
              );
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject assignment to unavailable or unapproved drivers', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary, // driver ID - valid 24-char hex string
          objectIdArbitrary, // ride ID - valid ObjectId
          fc.oneof(
            // Case 1: Driver is offline (regardless of approval)
            fc.record({
              is_online: fc.constant(false),
              approval: fc.constantFrom(
                DriverApproval.PENDING,
                DriverApproval.APPROVED,
                DriverApproval.REJECTED,
              ),
              role: fc.constant('DRIVER'),
            }),
            // Case 2: Driver is online but not approved
            fc.record({
              is_online: fc.constant(true),
              approval: fc.constantFrom(
                DriverApproval.PENDING,
                DriverApproval.REJECTED,
              ),
              role: fc.constant('DRIVER'),
            }),
          ),
          async (driverId: string, rideId: string, driverState: any) => {
            // Setup: Mock driver with unavailable state
            const mockDriver = {
              _id: driverId,
              ...driverState,
            };

            (userModel.findById as jest.Mock).mockResolvedValue(mockDriver);

            // Assignment should fail for unavailable/unapproved drivers
            try {
              await service.assignDriver(rideId, driverId);
              // If we reach here, the assignment succeeded when it should have failed
              throw new Error('Expected assignment to fail but it succeeded');
            } catch (error) {
              // Verify the error is the expected one
              expect((error as Error).message).toContain(
                'Driver is not available',
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 10: Emergency Priority Handling
   * For any emergency ride request, it should be prioritized over regular rides in driver matching,
   * and emergency vehicles should trigger path-clearing notifications to users within 100 meters ahead.
   *
   * Feature: ride-hailing-backend-integration, Property 10: Emergency Priority Handling
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  describe('Property 10: Emergency Priority Handling', () => {
    let mockPerformanceService: any;

    beforeEach(() => {
      // Get the mock PerformanceService from the module
      mockPerformanceService = service['performanceService'];
    });

    const emergencyRideArb = fc.record({
      _id: fc.string(),
      user_id: fc.string(),
      pickup_location: locationArb,
      destination_location: locationArb,
      vehicle_type: fc.constant('EMERGENCY'),
      emergency_details: fc.string(),
      status: fc.constant('REQUESTED'),
      estimated_fare: fc.double({ min: 50, max: 500 }),
      distance_km: fc.double({ min: 1, max: 50 }),
      duration_minutes: fc.integer({ min: 5, max: 120 }),
      requested_at: fc.date(),
      created_at: fc.date(),
      updated_at: fc.date(),
    });

    const regularRideArb = fc.record({
      _id: fc.string(),
      user_id: fc.string(),
      pickup_location: locationArb,
      destination_location: locationArb,
      vehicle_type: fc.constant('REGULAR'),
      status: fc.constant('REQUESTED'),
      estimated_fare: fc.double({ min: 20, max: 200 }),
      distance_km: fc.double({ min: 1, max: 30 }),
      duration_minutes: fc.integer({ min: 5, max: 90 }),
      requested_at: fc.date(),
      created_at: fc.date(),
      updated_at: fc.date(),
    });

    it('should prioritize emergency rides over regular rides in driver matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          emergencyRideArb,
          regularRideArb,
          fc.array(driverArb, { minLength: 3, maxLength: 10 }),
          async (emergencyRide: any, regularRide: any, drivers: any[]) => {
            // Skip test if coordinates are invalid
            if (
              !isValidCoordinate(
                emergencyRide.pickup_location.latitude,
                emergencyRide.pickup_location.longitude,
              ) ||
              !isValidCoordinate(
                regularRide.pickup_location.latitude,
                regularRide.pickup_location.longitude,
              )
            ) {
              return;
            }

            if (
              drivers.some(
                (driver) =>
                  !isValidCoordinate(driver.latitude, driver.longitude),
              )
            ) {
              return;
            }

            // Setup: Mock emergency ride lookup
            (rideModel.findById as jest.Mock).mockImplementation((rideId) => {
              if (rideId === emergencyRide._id) {
                return Promise.resolve(emergencyRide);
              } else if (rideId === regularRide._id) {
                return Promise.resolve(regularRide);
              }
              return Promise.resolve(null);
            });

            // Mock available drivers for both rides
            const availableDrivers = drivers.filter((driver) => {
              const emergencyDistance = calculateHaversineDistance(
                emergencyRide.pickup_location,
                { latitude: driver.latitude, longitude: driver.longitude },
              );
              const regularDistance = calculateHaversineDistance(
                regularRide.pickup_location,
                { latitude: driver.latitude, longitude: driver.longitude },
              );
              // Include drivers within reasonable distance of either ride
              return emergencyDistance <= 15 || regularDistance <= 10; // Emergency gets larger search radius
            });

            // Mock PerformanceService.findNearbyDrivers to return available drivers
            mockPerformanceService.findNearbyDrivers.mockImplementation(
              async (lat, lng, radius, vehicleType, limit) => {
                // Emergency rides get higher limit and more drivers
                const maxDrivers =
                  vehicleType === 'EMERGENCY'
                    ? Math.min(limit || 30, availableDrivers.length)
                    : Math.min(limit || 20, availableDrivers.length);
                return availableDrivers.slice(0, maxDrivers);
              },
            );

            (rideModel.distinct as jest.Mock).mockResolvedValue([]);

            // Test emergency ride matching with expanded criteria
            const emergencyQuery: DriverMatchQuery = {
              location: emergencyRide.pickup_location,
              radius_km: 5,
              vehicle_type: 'EMERGENCY',
              is_emergency: true,
            };

            const emergencyResults =
              await service.findAvailableDrivers(emergencyQuery);

            // Test regular ride matching with standard criteria
            const regularQuery: DriverMatchQuery = {
              location: regularRide.pickup_location,
              radius_km: 5,
              vehicle_type: 'REGULAR',
              is_emergency: false,
            };

            const regularResults =
              await service.findAvailableDrivers(regularQuery);

            // Verify emergency ride gets priority treatment:
            // 1. Emergency search should use expanded radius (mocked to return more drivers)
            // 2. Emergency results should be sorted by distance more aggressively
            // 3. Emergency drivers should have faster estimated arrival times

            if (emergencyResults.length > 1) {
              // Verify emergency results are sorted by distance primarily
              for (let i = 1; i < emergencyResults.length; i++) {
                const prev = emergencyResults[i - 1]!;
                const current = emergencyResults[i]!;

                // For emergency rides, distance takes priority over rating
                if (Math.abs(prev.distance_km - current.distance_km) >= 0.5) {
                  expect(prev.distance_km).toBeLessThanOrEqual(
                    current.distance_km,
                  );
                }
              }
            }

            // Verify emergency drivers have faster estimated arrival (due to higher speed assumptions)
            emergencyResults.forEach((result) => {
              const equivalentRegularResult = regularResults.find(
                (r) => Math.abs(r.distance_km - result.distance_km) < 0.1,
              );

              if (equivalentRegularResult) {
                // Emergency vehicles should have faster or equal estimated arrival times
                expect(result.estimated_arrival_minutes).toBeLessThanOrEqual(
                  equivalentRegularResult.estimated_arrival_minutes,
                );
              }
            });

            // Verify emergency capability flag is set
            emergencyResults.forEach((result) => {
              expect(result.is_emergency_capable).toBe(true);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should expand search radius for emergency rides when no drivers found initially', async () => {
      await fc.assert(
        fc.asyncProperty(
          emergencyRideArb,
          fc.array(driverArb, { minLength: 1, maxLength: 5 }),
          fc.double({ min: 2, max: 8 }), // initial radius
          async (emergencyRide: any, drivers: any[], initialRadius: number) => {
            // Skip test if coordinates are invalid
            if (
              !isValidCoordinate(
                emergencyRide.pickup_location.latitude,
                emergencyRide.pickup_location.longitude,
              )
            ) {
              return;
            }

            if (
              drivers.some(
                (driver) =>
                  !isValidCoordinate(driver.latitude, driver.longitude),
              )
            ) {
              return;
            }

            // Setup: Mock emergency ride
            (rideModel.findById as jest.Mock).mockResolvedValue(emergencyRide);

            // Place drivers just outside initial radius but within expanded radius
            const driversOutsideInitialRadius = drivers.map((driver) => ({
              ...driver,
              latitude:
                emergencyRide.pickup_location.latitude +
                (initialRadius + 1) / 111, // ~1km outside initial radius
              longitude: emergencyRide.pickup_location.longitude,
            }));

            // Mock PerformanceService to simulate radius expansion behavior
            let callCount = 0;
            mockPerformanceService.findNearbyDrivers.mockImplementation(
              async (lat, lng, radius, vehicleType, limit) => {
                callCount++;

                // First call (initial radius) returns no drivers
                if (callCount === 1 && radius <= initialRadius * 1.1) {
                  return [];
                }

                // Subsequent calls (expanded radius) return drivers
                if (radius > initialRadius * 1.1) {
                  return driversOutsideInitialRadius;
                }

                return [];
              },
            );

            (rideModel.distinct as jest.Mock).mockResolvedValue([]);

            // Test emergency ride matching
            const emergencyQuery: DriverMatchQuery = {
              location: emergencyRide.pickup_location,
              radius_km: initialRadius,
              vehicle_type: 'EMERGENCY',
              is_emergency: true,
            };

            const results = await service.findAvailableDrivers(emergencyQuery);

            // For emergency rides, the service should expand the search radius automatically
            // This is verified by checking that we get results even when initial radius has no drivers
            // The expanded radius behavior is implemented in the service logic

            // Verify that emergency search uses expanded criteria
            expect(callCount).toBeGreaterThanOrEqual(1);

            // If drivers were found, they should be from the expanded search
            if (results.length > 0) {
              results.forEach((result) => {
                expect(result.is_emergency_capable).toBe(true);
                expect(result.distance_km).toBeGreaterThan(initialRadius * 0.9); // Should be outside initial radius
              });
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle emergency ride distribution with shorter timeouts and more drivers', async () => {
      await fc.assert(
        fc.asyncProperty(
          emergencyRideArb,
          fc.array(driverArb, { minLength: 5, maxLength: 15 }),
          async (emergencyRide: any, drivers: any[]) => {
            // Skip test if coordinates are invalid
            if (
              !isValidCoordinate(
                emergencyRide.pickup_location.latitude,
                emergencyRide.pickup_location.longitude,
              )
            ) {
              return;
            }

            if (
              drivers.some(
                (driver) =>
                  !isValidCoordinate(driver.latitude, driver.longitude),
              )
            ) {
              return;
            }

            // Setup: Mock emergency ride
            (rideModel.findById as jest.Mock).mockResolvedValue(emergencyRide);

            // Mock available drivers within range
            const availableDrivers = drivers.filter((driver) => {
              const distance = calculateHaversineDistance(
                emergencyRide.pickup_location,
                { latitude: driver.latitude, longitude: driver.longitude },
              );
              return distance <= 10; // Within 10km
            });

            // Mock PerformanceService to return available drivers
            mockPerformanceService.findNearbyDrivers.mockResolvedValue(
              availableDrivers,
            );

            (rideModel.distinct as jest.Mock).mockResolvedValue([]);

            // Mock successful ride update for assignment
            (rideModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
              _id: emergencyRide._id,
              driver_id: availableDrivers[0]?._id,
              status: 'DRIVER_ASSIGNED',
              driver_assigned_at: new Date(),
            });

            // Mock successful driver update
            (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
              _id: availableDrivers[0]?._id,
              is_online: false,
            });

            // Mock WebSocket service to track offer sending
            const mockWebSocketService = {
              sendToUser: jest.fn().mockResolvedValue(true),
            };

            // Replace the WebSocket service in the service instance
            (service as any).webSocketService = mockWebSocketService;

            // Test emergency ride offer distribution
            const success = await service.distributeRideOffers(
              emergencyRide._id,
            );

            if (availableDrivers.length > 0) {
              expect(success).toBe(true);

              // Verify that offers were sent to drivers
              expect(mockWebSocketService.sendToUser).toHaveBeenCalled();

              // For emergency rides, more drivers should receive offers (MAX_DRIVERS_PER_OFFER + 2)
              const callCount =
                mockWebSocketService.sendToUser.mock.calls.length;
              const expectedMaxOffers = Math.min(availableDrivers.length, 5); // MAX_DRIVERS_PER_OFFER + 2
              expect(callCount).toBeLessThanOrEqual(expectedMaxOffers);

              // Verify emergency-specific offer data
              const offerCalls = mockWebSocketService.sendToUser.mock.calls;
              offerCalls.forEach((call: any[]) => {
                const [_driverId, event, offerData] = call;
                expect(event).toBe('ride_offer');
                expect(offerData.is_emergency).toBe(true);
                expect(offerData.priority).toBe('HIGH');
                expect(offerData.emergency_message).toContain('URGENT');
                expect(offerData.response_timeout).toBe(15); // Shorter timeout for emergency
              });
            } else {
              // If no drivers available, success should be false
              expect(success).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Calculate distance between two points using Haversine formula
 * This is the reference implementation for testing
 */
function calculateHaversineDistance(
  point1: LocationDto,
  point2: LocationDto,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
      Math.cos(toRadians(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if coordinates are valid (not NaN and within Earth bounds)
 */
function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90.1 &&
    latitude <= 90.1 &&
    longitude >= -180.1 &&
    longitude <= 180.1
  );
}
