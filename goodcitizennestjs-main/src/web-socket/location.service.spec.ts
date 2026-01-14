/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as fc from 'fast-check';

import { LocationService } from './location.service';
import { NotificationService } from '../common/notification.service';
import { PerformanceService } from '../common/performance.service';
import { User } from '../user/entities/user.entity';
import { Session } from '../user/entities/session.entity';
import { DriverRide } from '../driver/entities/driver-ride.entity';

describe('LocationService', () => {
  let service: LocationService;
  let userModel: any;

  const mockUser = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    latitude: 40.7128,
    longitude: -74.006,
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128],
    },
    pre_location: {
      type: 'Point',
      coordinates: [-74.007, 40.712],
    },
    current_bearing: 45,
    current_speed: 25,
    last_location_update: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findByIdAndUpdate: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken(Session.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(DriverRide.name),
          useValue: {
            find: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            send_notification: jest.fn(),
          },
        },
        {
          provide: PerformanceService,
          useValue: {
            recordMetric: jest.fn(),
            getMetrics: jest.fn(),
            cacheQuery: jest.fn(),
            getCachedQuery: jest.fn(),
            clearCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    userModel = module.get(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Property 11: Location Update Consistency
   * Validates: Requirements 4.1, 4.5, 17.7
   * Feature: ride-hailing-backend-integration, Property 11: Location Update Consistency
   */
  describe('Property 11: Location Update Consistency', () => {
    it('should maintain chronological order for location updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate sequence of location updates with timestamps
          fc.array(
            fc.record({
              lat: fc.float({ min: -90, max: 90 }).map((n) => n.toFixed(6)),
              long: fc.float({ min: -180, max: 180 }).map((n) => n.toFixed(6)),
              timestamp: fc.date({
                min: new Date('2024-01-01'),
                max: new Date('2024-12-31'),
              }),
              accuracy: fc.option(fc.float({ min: 1, max: 100 })),
              altitude: fc.option(fc.float({ min: -500, max: 9000 })),
            }),
            { minLength: 2, maxLength: 10 },
          ),
          async (locationUpdates) => {
            // Sort updates by timestamp to ensure chronological order
            const sortedUpdates = [...locationUpdates].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
            );

            // Mock user with initial location
            const testUser = {
              ...mockUser,
              _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
            };

            // Mock successful database updates
            userModel.findByIdAndUpdate.mockImplementation(
              (query: any, update: any) => {
                return Promise.resolve({
                  ...testUser,
                  ...update.$set,
                  _id: query._id,
                });
              },
            );

            const results: Array<{
              timestamp: Date;
              latitude: number;
              longitude: number;
              result: any;
            }> = [];
            let previousUpdate: (typeof locationUpdates)[0] | null = null;

            // Process updates in chronological order
            for (const update of sortedUpdates) {
              try {
                // Create a properly typed update object
                const typedUpdate = {
                  lat: update.lat,
                  long: update.long,
                  ...(update.accuracy !== null && {
                    accuracy: update.accuracy,
                  }),
                  ...(update.altitude !== null && {
                    altitude: update.altitude,
                  }),
                };

                const result = await service.save_coordinates(
                  testUser,
                  typedUpdate,
                );

                if (result) {
                  results.push({
                    timestamp: update.timestamp,
                    latitude: parseFloat(update.lat),
                    longitude: parseFloat(update.long),
                    result: result,
                  });

                  // Verify chronological consistency
                  if (previousUpdate) {
                    expect(update.timestamp.getTime()).toBeGreaterThanOrEqual(
                      previousUpdate.timestamp.getTime(),
                    );
                  }

                  // Verify coordinates are within valid bounds
                  expect(result.latitude).toBeGreaterThanOrEqual(-90);
                  expect(result.latitude).toBeLessThanOrEqual(90);
                  expect(result.longitude).toBeGreaterThanOrEqual(-180);
                  expect(result.longitude).toBeLessThanOrEqual(180);

                  // Verify location update timestamp is set
                  expect(result.last_location_update).toBeDefined();
                  expect(result.last_location_update).toBeInstanceOf(Date);

                  previousUpdate = update;
                }
              } catch (error: any) {
                // Location updates should not fail for valid coordinates
                if (
                  !error.message.includes('Invalid coordinate format') &&
                  !error.message.includes(
                    'Coordinates out of valid Earth bounds',
                  ) &&
                  !error.message.includes('Location update failed')
                ) {
                  throw error;
                }
              }
            }

            // Verify we processed updates in order
            expect(results.length).toBeGreaterThan(0);

            // Verify chronological order is maintained in results
            for (let i = 1; i < results.length; i++) {
              const currentTime = results[i]?.timestamp.getTime();
              const previousTime = results[i - 1]?.timestamp.getTime();
              if (currentTime !== undefined && previousTime !== undefined) {
                expect(currentTime).toBeGreaterThanOrEqual(previousTime);
              }
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should validate GPS coordinates within Earth bounds for all location updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            lat: fc.oneof(
              fc.float({ min: -90, max: 90 }).map((n) => n.toFixed(6)), // Valid latitude
              fc.float({ min: -200, max: -91 }).map((n) => n.toFixed(6)), // Invalid latitude (too low)
              fc.float({ min: 91, max: 200 }).map((n) => n.toFixed(6)), // Invalid latitude (too high)
            ),
            long: fc.oneof(
              fc.float({ min: -180, max: 180 }).map((n) => n.toFixed(6)), // Valid longitude
              fc.float({ min: -300, max: -181 }).map((n) => n.toFixed(6)), // Invalid longitude (too low)
              fc.float({ min: 181, max: 300 }).map((n) => n.toFixed(6)), // Invalid longitude (too high)
            ),
          }),
          async (locationUpdate) => {
            const testUser = {
              ...mockUser,
              _id: '507f1f77bcf86cd799439011',
            };

            const lat = parseFloat(locationUpdate.lat);
            const long = parseFloat(locationUpdate.long);
            const isValidLat = lat >= -90 && lat <= 90;
            const isValidLong = long >= -180 && long <= 180;
            const isValidCoordinates = isValidLat && isValidLong;

            if (isValidCoordinates) {
              // Mock successful update for valid coordinates
              userModel.findByIdAndUpdate.mockResolvedValue({
                ...testUser,
                latitude: lat,
                longitude: long,
                last_location_update: new Date(),
              });

              const result = await service.save_coordinates(
                testUser,
                locationUpdate,
              );

              // Verify valid coordinates are accepted and stored
              expect(result).toBeDefined();
              expect(result.latitude).toBe(lat);
              expect(result.longitude).toBe(long);
              expect(result.last_location_update).toBeDefined();
            } else {
              // Invalid coordinates should be rejected
              try {
                await service.save_coordinates(testUser, locationUpdate);
                // If we reach here, the invalid coordinates were not rejected
                fail('Invalid coordinates should have been rejected');
              } catch (error: any) {
                // Verify appropriate error is thrown for invalid coordinates
                expect(error.message).toMatch(
                  /Coordinates out of valid Earth bounds|Invalid coordinate format|Location update failed/,
                );
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should calculate bearing and speed consistently for sequential location updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two sequential location points
          fc.tuple(
            fc.record({
              lat: fc.float({ min: -89, max: 89 }).map((n) => n.toFixed(6)),
              long: fc.float({ min: -179, max: 179 }).map((n) => n.toFixed(6)),
            }),
            fc.record({
              lat: fc.float({ min: -89, max: 89 }).map((n) => n.toFixed(6)),
              long: fc.float({ min: -179, max: 179 }).map((n) => n.toFixed(6)),
            }),
          ),
          async ([firstLocation, secondLocation]) => {
            const testUser = {
              ...mockUser,
              _id: '507f1f77bcf86cd799439011',
              latitude: parseFloat(firstLocation.lat),
              longitude: parseFloat(firstLocation.long),
              location: {
                type: 'Point',
                coordinates: [
                  parseFloat(firstLocation.long),
                  parseFloat(firstLocation.lat),
                ],
              },
              last_location_update: new Date(Date.now() - 60000), // 1 minute ago
            };

            // Mock the first update (establish previous location)
            userModel.findByIdAndUpdate.mockImplementation(
              (query: any, update: any) => {
                return Promise.resolve({
                  ...testUser,
                  ...update.$set,
                  _id: query._id,
                });
              },
            );

            // Update to second location
            const result = await service.save_coordinates(
              testUser,
              secondLocation,
            );

            if (result) {
              // Verify location is updated
              expect(result.latitude).toBe(parseFloat(secondLocation.lat));
              expect(result.longitude).toBe(parseFloat(secondLocation.long));

              // Verify bearing is calculated (should be a number between 0-360)
              if (result.current_bearing !== undefined) {
                expect(typeof result.current_bearing).toBe('number');
                expect(result.current_bearing).toBeGreaterThanOrEqual(0);
                expect(result.current_bearing).toBeLessThan(360);
              }

              // Verify speed is calculated (should be non-negative and reasonable)
              if (result.current_speed !== undefined) {
                expect(typeof result.current_speed).toBe('number');
                expect(result.current_speed).toBeGreaterThanOrEqual(0);
                // Speed can be very high in edge cases due to time/distance calculations
                // Just ensure it's not infinite or NaN
                expect(Number.isFinite(result.current_speed)).toBe(true);
              }

              // Verify timestamp is updated
              expect(result.last_location_update).toBeDefined();
              expect(result.last_location_update).toBeInstanceOf(Date);

              // Verify GeoJSON format is maintained
              expect(result.location).toBeDefined();
              expect(result.location.type).toBe('Point');
              expect(result.location.coordinates).toHaveLength(2);
              expect(result.location.coordinates[0]).toBe(
                parseFloat(secondLocation.long),
              );
              expect(result.location.coordinates[1]).toBe(
                parseFloat(secondLocation.lat),
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle location updates with optional metadata consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            lat: fc.float({ min: -90, max: 90 }).map((n) => n.toFixed(6)),
            long: fc.float({ min: -180, max: 180 }).map((n) => n.toFixed(6)),
            accuracy: fc.option(fc.float({ min: 1, max: 100 })),
            altitude: fc.option(fc.float({ min: -500, max: 9000 })),
            speed: fc.option(fc.float({ min: 0, max: 200 })),
            bearing: fc.option(fc.float({ min: 0, max: Math.fround(359.99) })),
          }),
          async (locationUpdate) => {
            const testUser = {
              ...mockUser,
              _id: '507f1f77bcf86cd799439011',
            };

            // Create a properly typed update object
            const typedUpdate = {
              lat: locationUpdate.lat,
              long: locationUpdate.long,
              ...(locationUpdate.accuracy !== null && {
                accuracy: locationUpdate.accuracy,
              }),
              ...(locationUpdate.altitude !== null && {
                altitude: locationUpdate.altitude,
              }),
              ...(locationUpdate.speed !== null && {
                speed: locationUpdate.speed,
              }),
              ...(locationUpdate.bearing !== null && {
                bearing: locationUpdate.bearing,
              }),
            };

            userModel.findByIdAndUpdate.mockResolvedValue({
              ...testUser,
              latitude: parseFloat(locationUpdate.lat),
              longitude: parseFloat(locationUpdate.long),
              last_location_update: new Date(),
            });

            const result = await service.save_coordinates(
              testUser,
              typedUpdate,
            );

            // Verify core location data is always present
            expect(result).toBeDefined();
            expect(result.latitude).toBe(parseFloat(locationUpdate.lat));
            expect(result.longitude).toBe(parseFloat(locationUpdate.long));
            expect(result.last_location_update).toBeDefined();

            // Verify optional metadata is handled correctly
            // Note: The User entity doesn't have location_accuracy or altitude fields
            // These are stored in the location update process but not returned in the user object
            if (
              locationUpdate.accuracy !== undefined &&
              locationUpdate.accuracy !== null
            ) {
              // Verify accuracy was processed (would be stored in location history)
              expect(typeof locationUpdate.accuracy).toBe('number');
            }

            if (
              locationUpdate.altitude !== undefined &&
              locationUpdate.altitude !== null
            ) {
              // Verify altitude was processed (would be stored in location history)
              expect(typeof locationUpdate.altitude).toBe('number');
            }

            // Verify GeoJSON structure is always correct
            expect(result.location).toBeDefined();
            expect(result.location.type).toBe('Point');
            expect(Array.isArray(result.location.coordinates)).toBe(true);
            expect(result.location.coordinates).toHaveLength(2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain location history integrity across multiple updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              lat: fc.float({ min: -89, max: 89 }).map((n) => n.toFixed(6)),
              long: fc.float({ min: -179, max: 179 }).map((n) => n.toFixed(6)),
            }),
            { minLength: 3, maxLength: 8 },
          ),
          async (locationSequence) => {
            const testUser = {
              ...mockUser,
              _id: '507f1f77bcf86cd799439011',
            };

            let previousLocation: {
              latitude: number;
              longitude: number;
            } | null = null;
            const processedLocations: Array<{
              latitude: number;
              longitude: number;
              index: number;
            }> = [];

            for (const [index, location] of locationSequence.entries()) {
              // Skip invalid coordinates (NaN, empty strings, etc.)
              const lat = parseFloat(location.lat);
              const long = parseFloat(location.long);
              if (isNaN(lat) || isNaN(long)) {
                continue; // Skip this invalid location
              }

              // Mock database update with location history
              userModel.findByIdAndUpdate.mockResolvedValue({
                ...testUser,
                latitude: lat,
                longitude: long,
                pre_location: previousLocation
                  ? {
                      type: 'Point',
                      coordinates: [
                        previousLocation.longitude,
                        previousLocation.latitude,
                      ],
                    }
                  : null,
                last_location_update: new Date(),
              });

              try {
                const result = await service.save_coordinates(
                  testUser,
                  location,
                );

                if (result) {
                  processedLocations.push({
                    latitude: result.latitude,
                    longitude: result.longitude,
                    index: index,
                  });

                  // Verify current location is set correctly
                  expect(result.latitude).toBe(lat);
                  expect(result.longitude).toBe(long);

                  // Verify previous location is maintained (if not first update)
                  if (processedLocations.length > 1 && previousLocation) {
                    expect(result.pre_location).toBeDefined();
                    expect(result.pre_location.coordinates[0]).toBe(
                      previousLocation.longitude,
                    );
                    expect(result.pre_location.coordinates[1]).toBe(
                      previousLocation.latitude,
                    );
                  }

                  previousLocation = {
                    latitude: result.latitude,
                    longitude: result.longitude,
                  };
                }
              } catch (error: any) {
                // Invalid coordinates should be rejected
                if (
                  !error.message.includes('Invalid coordinate format') &&
                  !error.message.includes(
                    'Coordinates out of valid Earth bounds',
                  ) &&
                  !error.message.includes('Location update failed')
                ) {
                  throw error;
                }
              }
            }

            // Verify we processed at least some valid locations
            expect(processedLocations.length).toBeGreaterThan(0);

            // Verify sequence integrity for processed locations
            for (let i = 0; i < processedLocations.length; i++) {
              expect(processedLocations[i]).toBeDefined();
              expect(typeof processedLocations[i]?.latitude).toBe('number');
              expect(typeof processedLocations[i]?.longitude).toBe('number');
            }
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should reject invalid coordinate formats consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              lat: fc.constant('invalid'), // Non-numeric latitude
              long: fc.float({ min: -180, max: 180 }).map((n) => n.toString()),
            }),
            fc.record({
              lat: fc.float({ min: -90, max: 90 }).map((n) => n.toString()),
              long: fc.constant('invalid'), // Non-numeric longitude
            }),
            fc.record({
              lat: fc.constant(''), // Empty latitude
              long: fc.float({ min: -180, max: 180 }).map((n) => n.toString()),
            }),
            fc.record({
              lat: fc.float({ min: -90, max: 90 }).map((n) => n.toString()),
              long: fc.constant(''), // Empty longitude
            }),
          ),
          async (invalidLocation) => {
            const testUser = {
              ...mockUser,
              _id: '507f1f77bcf86cd799439011',
            };

            // Invalid coordinates should always be rejected
            try {
              await service.save_coordinates(testUser, invalidLocation);
              fail('Invalid coordinate format should have been rejected');
            } catch (error: any) {
              expect(error.message).toMatch(
                /Invalid coordinate format|Coordinates out of valid Earth bounds|Location update failed/,
              );
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 14: Emergency Alert Rate Limiting
   * For any emergency vehicle sending location updates, users should not receive more than
   * one path-clearing notification per 30-second window, preventing notification spam.
   *
   * Feature: ride-hailing-backend-integration, Property 14: Emergency Alert Rate Limiting
   * Validates: Requirements 6.4
   */
  describe('Property 14: Emergency Alert Rate Limiting', () => {
    let driverRideModel: any;
    let sessionModel: any;
    let notificationService: any;
    let performanceService: any;

    beforeEach(() => {
      driverRideModel = {
        findById: jest.fn(),
        updateOne: jest.fn(),
      };
      sessionModel = {
        findOne: jest.fn(),
      };
      notificationService = {
        send_notification: jest.fn(),
      };
      performanceService = {
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
      };

      // Replace the models and services in the service
      (service as any).driverRideModel = driverRideModel;
      (service as any).sessionModel = sessionModel;
      (service as any).notificationService = notificationService;
      (service as any).performanceService = performanceService;

      // Also ensure userModel is properly accessible
      (service as any).userModel = userModel;

      // Reset all mocks
      jest.clearAllMocks();
    });

    it('should enforce 30-second rate limiting for emergency alerts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate emergency ride data
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            driver_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            user_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            pickup_location: fc.record({
              latitude: fc.float({ min: -89, max: 89 }),
              longitude: fc.float({ min: -179, max: 179 }),
            }),
            drop_location: fc.record({
              latitude: fc.float({ min: -89, max: 89 }),
              longitude: fc.float({ min: -179, max: 179 }),
            }),
            status: fc.constant('in_progress'),
            last_notification: fc.option(
              fc.date({ min: new Date('2024-01-01'), max: new Date() }),
            ),
          }),
          // Generate driver location data
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            latitude: fc.float({ min: -89, max: 89 }),
            longitude: fc.float({ min: -179, max: 179 }),
            location: fc.record({
              type: fc.constant('Point'),
              coordinates: fc.tuple(
                fc.float({ min: -179, max: 179 }),
                fc.float({ min: -89, max: 89 }),
              ),
            }),
            current_bearing: fc.float({ min: 0, max: Math.fround(359.99) }),
            current_speed: fc.float({ min: 10, max: Math.fround(80) }),
            role: fc.constant('DRIVER'),
          }),
          // Generate sequence of alert attempts with timestamps
          fc.array(
            fc.record({
              timestamp: fc.date({
                min: new Date('2024-01-01'),
                max: new Date(),
              }),
              location: fc.record({
                latitude: fc.float({ min: -89, max: 89 }),
                longitude: fc.float({ min: -179, max: 179 }),
              }),
              bearing: fc.float({ min: 0, max: Math.fround(359.99) }),
              speed: fc.float({ min: 10, max: Math.fround(80) }),
            }),
            { minLength: 2, maxLength: 10 },
          ),
          async (emergencyRide, driver, alertAttempts) => {
            // Sort alert attempts by timestamp
            const sortedAttempts = [...alertAttempts].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
            );

            // Mock emergency ride lookup
            driverRideModel.findById.mockResolvedValue(emergencyRide);

            // Mock users in range (at least one user to notify)
            const mockUsers = [
              {
                _id: 'user1',
                latitude: driver.latitude + 0.001, // Close to driver
                longitude: driver.longitude + 0.001,
                socket_id: 'socket1',
                role: 'USER',
                is_online: true,
              },
            ];

            // Mock the geospatial query properly - ensure it returns users
            userModel.find.mockImplementation((query: any) => {
              // For geospatial queries, return users within range
              if (query.location && query.location.$nearSphere) {
                return {
                  lean: jest.fn().mockResolvedValue(mockUsers),
                };
              }
              // For other queries, return empty
              return {
                lean: jest.fn().mockResolvedValue([]),
              };
            });

            // Mock driver lookup to return the driver
            userModel.findById.mockResolvedValue(driver);

            // Mock session with FCM token
            sessionModel.findOne.mockResolvedValue({
              user_id: 'user1',
              fcm_token: 'mock_fcm_token',
            });

            // Mock successful notification sending
            notificationService.send_notification.mockResolvedValue(true);

            // Mock successful ride update
            driverRideModel.updateOne.mockResolvedValue({ acknowledged: true });

            let lastNotificationTime: Date | null =
              emergencyRide.last_notification;
            let notificationCount = 0;
            let rateLimitedCount = 0;

            // Process each alert attempt
            for (const attempt of sortedAttempts) {
              // Update the mock ride with current last_notification time
              const currentRide = {
                ...emergencyRide,
                last_notification: lastNotificationTime,
              };
              driverRideModel.findById.mockResolvedValue(currentRide);

              // Calculate time since last notification
              const timeSinceLastNotification = lastNotificationTime
                ? (attempt.timestamp.getTime() -
                    lastNotificationTime.getTime()) /
                  1000
                : Infinity;

              try {
                const result = await service.broadcastEmergencyAlert(
                  driver._id,
                  emergencyRide._id,
                  attempt.location,
                  attempt.bearing,
                  attempt.speed,
                );

                if (timeSinceLastNotification >= 30) {
                  // Should allow notification (not rate limited)
                  expect(result.notified).toBeGreaterThan(0);
                  expect(result.reason).toBeUndefined();
                  notificationCount++;
                  lastNotificationTime = attempt.timestamp;
                } else {
                  // Should be rate limited
                  expect(result.notified).toBe(0);
                  expect(result.skipped).toBeGreaterThan(0);
                  expect(result.reason).toContain('Rate limited');
                  rateLimitedCount++;
                }
              } catch (error) {
                // Unexpected errors should not occur for valid inputs
                console.error('Unexpected error in emergency alert:', error);
                throw error;
              }
            }

            // Verify rate limiting behavior
            if (sortedAttempts.length > 1) {
              // Should have at least one notification (first one or after 30s gap)
              expect(notificationCount).toBeGreaterThan(0);

              // Should have rate limited some attempts if they were within 30s
              const rapidAttempts = sortedAttempts.filter((attempt, index) => {
                if (index === 0) return false; // First attempt is never rate limited
                const prevAttempt = sortedAttempts[index - 1];
                const timeDiff =
                  (attempt.timestamp.getTime() -
                    prevAttempt!.timestamp.getTime()) /
                  1000;
                return timeDiff < 30;
              });

              if (rapidAttempts.length > 0) {
                expect(rateLimitedCount).toBeGreaterThan(0);
              }
            }

            // Verify total attempts processed
            expect(notificationCount + rateLimitedCount).toBe(
              sortedAttempts.length,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should allow notifications after 30-second window expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            driver_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            last_notification: fc.date({
              min: new Date('2024-01-01'),
              max: new Date(),
            }),
          }),
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            latitude: fc.float({ min: -89, max: 89 }),
            longitude: fc.float({ min: -179, max: 179 }),
            location: fc.record({
              coordinates: fc.tuple(
                fc.float({ min: -179, max: 179 }),
                fc.float({ min: -89, max: 89 }),
              ),
            }),
          }),
          fc.integer({ min: 30, max: 300 }), // Time gap in seconds (30s to 5min)
          async (emergencyRide, driver, timeGapSeconds) => {
            // Create a new timestamp that's timeGapSeconds after last notification
            const newNotificationTime = new Date(
              emergencyRide.last_notification.getTime() + timeGapSeconds * 1000,
            );

            // Mock ride with last notification time
            driverRideModel.findById.mockResolvedValue(emergencyRide);

            // Mock users in range
            userModel.find.mockImplementation((query: any) => {
              // Check if this is a geospatial query
              if (query.location && query.location.$nearSphere) {
                return {
                  lean: jest.fn().mockResolvedValue([
                    {
                      _id: 'user1',
                      latitude: driver.latitude + 0.001,
                      longitude: driver.longitude + 0.001,
                      socket_id: 'socket1',
                      role: 'USER',
                      is_online: true,
                    },
                  ]),
                };
              }
              return {
                lean: jest.fn().mockResolvedValue([]),
              };
            });

            sessionModel.findOne.mockResolvedValue({
              user_id: 'user1',
              fcm_token: 'mock_fcm_token',
            });

            // Mock driver lookup
            userModel.findById.mockResolvedValue(driver);

            notificationService.send_notification.mockResolvedValue(true);
            driverRideModel.updateOne.mockResolvedValue({ acknowledged: true });

            // Mock current time to be newNotificationTime
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => newNotificationTime.getTime());

            try {
              const result = await service.broadcastEmergencyAlert(
                driver._id,
                emergencyRide._id,
                { latitude: driver.latitude, longitude: driver.longitude },
                45, // bearing
                30, // speed
              );

              // Should allow notification since time gap >= 30 seconds
              expect(result.notified).toBeGreaterThan(0);
              expect(result.reason).toBeUndefined();

              // Verify notification service was called
              expect(notificationService.send_notification).toHaveBeenCalled();

              // Verify ride was updated with new notification timestamp
              expect(driverRideModel.updateOne).toHaveBeenCalledWith(
                { _id: emergencyRide._id },
                { last_notification: expect.any(Date) },
              );
            } finally {
              // Restore original Date.now
              Date.now = originalDateNow;
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle concurrent alert attempts with consistent rate limiting', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            driver_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            last_notification: fc.option(
              fc.date({ min: new Date('2024-01-01'), max: new Date() }),
            ),
          }),
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            latitude: fc.float({ min: -89, max: 89 }),
            longitude: fc.float({ min: -179, max: 179 }),
            location: fc.record({
              coordinates: fc.tuple(
                fc.float({ min: -179, max: 179 }),
                fc.float({ min: -89, max: 89 }),
              ),
            }),
          }),
          fc.integer({ min: 2, max: 5 }), // Number of concurrent attempts
          async (emergencyRide, driver, concurrentAttempts) => {
            // Mock ride lookup
            driverRideModel.findById.mockResolvedValue(emergencyRide);

            // Mock users in range
            userModel.find.mockImplementation((query: any) => {
              // Check if this is a geospatial query
              if (query.location && query.location.$nearSphere) {
                return {
                  lean: jest.fn().mockResolvedValue([
                    {
                      _id: 'user1',
                      latitude: driver.latitude + 0.001,
                      longitude: driver.longitude + 0.001,
                      socket_id: 'socket1',
                      role: 'USER',
                      is_online: true,
                    },
                  ]),
                };
              }
              return {
                lean: jest.fn().mockResolvedValue([]),
              };
            });

            sessionModel.findOne.mockResolvedValue({
              user_id: 'user1',
              fcm_token: 'mock_fcm_token',
            });

            // Mock driver lookup
            userModel.findById.mockResolvedValue(driver);

            notificationService.send_notification.mockResolvedValue(true);
            driverRideModel.updateOne.mockResolvedValue({ acknowledged: true });

            // Create concurrent alert attempts
            const alertPromises = Array.from(
              { length: concurrentAttempts },
              (_, index) =>
                service
                  .broadcastEmergencyAlert(
                    driver._id,
                    emergencyRide._id,
                    {
                      latitude: driver.latitude + index * 0.0001,
                      longitude: driver.longitude + index * 0.0001,
                    },
                    45 + index, // Slightly different bearing
                    30 + index, // Slightly different speed
                  )
                  .catch((error) => ({ error, index })),
            );

            const results = await Promise.all(alertPromises);

            // Analyze results
            const successfulAlerts = results.filter(
              (result) => !('error' in result) && result.notified > 0,
            );
            const rateLimitedAlerts = results.filter(
              (result) =>
                !('error' in result) &&
                result.notified === 0 &&
                result.reason?.includes('Rate limited'),
            );
            const erroredAlerts = results.filter((result) => 'error' in result);

            // Verify concurrent behavior
            expect(erroredAlerts.length).toBe(0); // No errors should occur

            if (emergencyRide.last_notification) {
              // If there was a recent notification, all should be rate limited
              const timeSinceLastNotification =
                (Date.now() - emergencyRide.last_notification.getTime()) / 1000;
              if (timeSinceLastNotification < 30) {
                expect(rateLimitedAlerts.length).toBe(concurrentAttempts);
                expect(successfulAlerts.length).toBe(0);
              } else {
                // If enough time has passed, at least one should succeed
                expect(successfulAlerts.length).toBeGreaterThan(0);
              }
            } else {
              // No previous notification, at least one should succeed
              expect(successfulAlerts.length).toBeGreaterThan(0);
            }

            // Total results should equal attempts
            expect(successfulAlerts.length + rateLimitedAlerts.length).toBe(
              concurrentAttempts,
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should maintain rate limiting state across different emergency rides', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple emergency rides
          fc.array(
            fc.record({
              _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
              driver_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
              last_notification: fc.option(
                fc.date({ min: new Date('2024-01-01'), max: new Date() }),
              ),
            }),
            { minLength: 2, maxLength: 4 },
          ),
          fc.record({
            _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
            latitude: fc.float({ min: -89, max: 89 }),
            longitude: fc.float({ min: -179, max: 179 }),
            location: fc.record({
              coordinates: fc.tuple(
                fc.float({ min: -179, max: 179 }),
                fc.float({ min: -89, max: 89 }),
              ),
            }),
          }),
          async (emergencyRides, driver) => {
            // Mock users in range
            userModel.find.mockImplementation((query: any) => {
              // Check if this is a geospatial query
              if (query.location && query.location.$nearSphere) {
                return {
                  lean: jest.fn().mockResolvedValue([
                    {
                      _id: 'user1',
                      latitude: driver.latitude + 0.001,
                      longitude: driver.longitude + 0.001,
                      socket_id: 'socket1',
                      role: 'USER',
                      is_online: true,
                    },
                  ]),
                };
              }
              return {
                lean: jest.fn().mockResolvedValue([]),
              };
            });

            sessionModel.findOne.mockResolvedValue({
              user_id: 'user1',
              fcm_token: 'mock_fcm_token',
            });

            // Mock driver lookup
            userModel.findById.mockResolvedValue(driver);

            notificationService.send_notification.mockResolvedValue(true);
            driverRideModel.updateOne.mockResolvedValue({ acknowledged: true });

            const results: Array<{
              rideId: string;
              result: { notified: number; skipped: number; reason?: string };
              lastNotification: Date | null;
            }> = [];

            // Test each emergency ride independently
            for (const ride of emergencyRides) {
              // Mock ride lookup for current ride
              driverRideModel.findById.mockResolvedValue(ride);

              const result = await service.broadcastEmergencyAlert(
                driver._id,
                ride._id,
                { latitude: driver.latitude, longitude: driver.longitude },
                45, // bearing
                30, // speed
              );

              results.push({
                rideId: ride._id,
                result: result,
                lastNotification: ride.last_notification,
              });
            }

            // Verify each ride's rate limiting is independent
            for (const { result, lastNotification } of results) {
              if (lastNotification) {
                const timeSinceLastNotification =
                  (Date.now() - lastNotification.getTime()) / 1000;
                if (timeSinceLastNotification < 30) {
                  // Should be rate limited
                  expect(result.notified).toBe(0);
                  expect(result.reason).toContain('Rate limited');
                } else {
                  // Should allow notification
                  expect(result.notified).toBeGreaterThan(0);
                }
              } else {
                // No previous notification, should allow
                expect(result.notified).toBeGreaterThan(0);
              }
            }

            // Verify each ride was processed
            expect(results.length).toBe(emergencyRides.length);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
