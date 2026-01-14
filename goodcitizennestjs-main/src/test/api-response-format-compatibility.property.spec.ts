import { Test, TestingModule } from '@nestjs/testing';
import { FrontendIntegrationService } from '../common/frontend-integration.service';
import * as fc from 'fast-check';

/**
 * Property-Based Test: Frontend API Response Compatibility
 *
 * **Feature: ride-hailing-backend-integration, Property 21: Frontend API Response Compatibility**
 * **Validates: Requirements 21.1, 21.2, 21.3**
 *
 * This test ensures that API responses are formatted to match the exact data structures
 * expected by the Redux slices in both the user app and partner app, enabling seamless
 * frontend integration without requiring data transformation.
 */
describe('Frontend API Response Compatibility Property Tests', () => {
  let service: FrontendIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FrontendIntegrationService],
    }).compile();

    service = module.get<FrontendIntegrationService>(
      FrontendIntegrationService,
    );
  });

  /**
   * Property: Authentication responses match Redux authSlice format
   * For any valid user and token data, the formatted auth response should contain
   * all required fields in the exact structure expected by the frontend authSlice
   */
  it('should format authentication responses compatible with Redux authSlice', () => {
    fc.assert(
      fc.property(
        // Generate random user data
        fc.record({
          _id: fc.string({ minLength: 24, maxLength: 24 }),
          first_name: fc.string({ minLength: 1, maxLength: 50 }),
          last_name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.emailAddress(),
          phone_number: fc.string({ minLength: 10, maxLength: 15 }),
          role: fc.constantFrom('USER', 'DRIVER'),
          loyalty_points: fc.integer({ min: 0, max: 10000 }),
          is_email_verified: fc.boolean(),
        }),
        // Generate random token data
        fc.record({
          access_token: fc.string({ minLength: 100, maxLength: 200 }),
          refresh_token: fc.string({ minLength: 100, maxLength: 200 }),
        }),
        (user, tokens) => {
          const result = service.formatAuthResponse(user, tokens);

          // Verify all required authSlice fields are present
          expect(result).toHaveProperty('user');
          expect(result).toHaveProperty('token');
          expect(result).toHaveProperty('userType');
          expect(result).toHaveProperty('isAuthenticated');
          expect(result).toHaveProperty('isVerified');

          // Verify user object structure matches authSlice expectations
          expect(result.user).toHaveProperty('_id', user._id);
          expect(result.user).toHaveProperty('first_name', user.first_name);
          expect(result.user).toHaveProperty('last_name', user.last_name);
          expect(result.user).toHaveProperty('email', user.email);
          expect(result.user).toHaveProperty('phone_number', user.phone_number);
          expect(result.user).toHaveProperty('role', user.role);
          expect(result.user).toHaveProperty(
            'loyalty_points',
            user.loyalty_points,
          );

          // Verify token is the access token
          expect(result.token).toBe(tokens.access_token);

          // Verify userType mapping is correct
          const expectedUserType =
            user.role === 'DRIVER' ? 'ambulance_driver' : 'user';
          expect(result.userType).toBe(expectedUserType);

          // Verify boolean fields
          expect(result.isAuthenticated).toBe(true);
          expect(result.isVerified).toBe(user.is_email_verified);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Ride responses match Redux rideSlice format
   * For any valid ride data, the formatted ride response should contain
   * all required fields in the exact structure expected by the frontend rideSlice
   */
  it('should format ride responses compatible with Redux rideSlice', () => {
    fc.assert(
      fc.property(
        // Generate random ride data
        fc.record({
          _id: fc.string({ minLength: 24, maxLength: 24 }),
          status: fc.constantFrom(
            'requested',
            'driver_assigned',
            'driver_arriving',
            'in_progress',
            'completed',
          ),
          pickup_location: fc.record({
            latitude: fc.float({ min: -90, max: 90 }),
            longitude: fc.float({ min: -180, max: 180 }),
            address: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          destination_location: fc.record({
            latitude: fc.float({ min: -90, max: 90 }),
            longitude: fc.float({ min: -180, max: 180 }),
            address: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          estimated_fare: fc.float({ min: 5, max: 100 }),
        }),
        // Generate optional driver data
        fc.option(
          fc.record({
            _id: fc.string({ minLength: 24, maxLength: 24 }),
            first_name: fc.string({ minLength: 1, maxLength: 50 }),
            last_name: fc.string({ minLength: 1, maxLength: 50 }),
            driver_rating: fc.float({ min: 1, max: 5 }),
            vehicle_type: fc.string({ minLength: 3, maxLength: 20 }),
            vehicle_plate: fc.string({ minLength: 3, maxLength: 10 }),
            phone_number: fc.string({ minLength: 10, maxLength: 15 }),
            location: fc.record({
              coordinates: fc.tuple(
                fc.float({ min: -180, max: 180 }), // longitude
                fc.float({ min: -90, max: 90 }), // latitude
              ),
            }),
          }),
          { nil: null },
        ),
        (ride, driver) => {
          const result = service.formatRideResponse(ride, driver);

          // Verify all required rideSlice fields are present
          expect(result).toHaveProperty('currentRide');
          expect(result).toHaveProperty('rideStatus');
          expect(result).toHaveProperty('pickupLocation');
          expect(result).toHaveProperty('destinationLocation');
          expect(result).toHaveProperty('estimatedFare');

          // Verify currentRide structure
          expect(result.currentRide).toHaveProperty('ride_id', ride._id);
          expect(result.currentRide).toHaveProperty('status', ride.status);
          // The service formats locations and handles NaN values by converting to 0
          const expectedPickupLat = isNaN(ride.pickup_location.latitude)
            ? 0
            : ride.pickup_location.latitude;
          const expectedPickupLng = isNaN(ride.pickup_location.longitude)
            ? 0
            : ride.pickup_location.longitude;
          const expectedDestLat = isNaN(ride.destination_location.latitude)
            ? 0
            : ride.destination_location.latitude;
          const expectedDestLng = isNaN(ride.destination_location.longitude)
            ? 0
            : ride.destination_location.longitude;

          expect(result.currentRide.pickup_location.latitude).toBeCloseTo(
            expectedPickupLat,
          );
          expect(result.currentRide.pickup_location.longitude).toBeCloseTo(
            expectedPickupLng,
          );
          expect(result.currentRide.pickup_location.address).toBe(
            ride.pickup_location.address || '',
          );

          expect(result.currentRide.destination_location.latitude).toBeCloseTo(
            expectedDestLat,
          );
          expect(result.currentRide.destination_location.longitude).toBeCloseTo(
            expectedDestLng,
          );
          expect(result.currentRide.destination_location.address).toBe(
            ride.destination_location.address || '',
          );

          expect(result.currentRide).toHaveProperty(
            'estimated_fare',
            ride.estimated_fare,
          );

          // Verify top-level fields match currentRide
          expect(result.rideStatus).toBe(ride.status);
          expect(result.pickupLocation).toEqual(
            result.currentRide.pickup_location,
          );
          expect(result.destinationLocation).toEqual(
            result.currentRide.destination_location,
          );
          expect(result.estimatedFare).toBe(ride.estimated_fare);

          // Verify driver field handling
          if (driver) {
            expect(result.driver).toBeDefined();
            expect(result.driver!.driver_id).toBe(driver._id);
            // The service now handles empty names by providing a fallback
            const expectedName =
              `${driver.first_name} ${driver.last_name}`.trim() ||
              'Unknown Driver';
            expect(result.driver!.name).toBe(expectedName);
            // Handle NaN ratings by expecting the default value
            const expectedRating = isNaN(driver.driver_rating)
              ? 4.8
              : driver.driver_rating;
            expect(result.driver!.rating).toBe(expectedRating);
            expect(result.driver!.vehicle).toBe(driver.vehicle_type);
            expect(result.driver!.plate).toBe(driver.vehicle_plate);
            expect(result.driver!.phone).toBe(driver.phone_number);
            // Handle floating point precision issues (-0 vs 0) and NaN values
            const expectedDriverLat = isNaN(driver.location.coordinates[1])
              ? 0
              : driver.location.coordinates[1];
            const expectedDriverLng = isNaN(driver.location.coordinates[0])
              ? 0
              : driver.location.coordinates[0];
            expect(result.driver!.current_location.latitude).toBeCloseTo(
              expectedDriverLat,
            );
            expect(result.driver!.current_location.longitude).toBeCloseTo(
              expectedDriverLng,
            );
          } else {
            expect(result.driver).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Driver responses match Redux driverSlice format (Partner App)
   * For any valid driver data, the formatted driver response should contain
   * all required fields in the exact structure expected by the partner app driverSlice
   */
  it('should format driver responses compatible with Redux driverSlice', () => {
    fc.assert(
      fc.property(
        // Generate random driver data
        fc.record({
          _id: fc.string({ minLength: 24, maxLength: 24 }),
          is_online: fc.boolean(),
          total_rides: fc.integer({ min: 0, max: 1000 }),
          driver_rating: fc.float({ min: 1, max: 5 }),
        }),
        // Generate optional current ride data
        fc.option(
          fc.record({
            _id: fc.string({ minLength: 24, maxLength: 24 }),
            status: fc.constantFrom(
              'requested',
              'driver_assigned',
              'in_progress',
            ),
            pickup_location: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 }),
            }),
            destination_location: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 }),
            }),
          }),
          { nil: null },
        ),
        // Generate earnings data
        fc.record({
          today: fc.float({ min: 0, max: 500 }),
          total: fc.float({ min: 0, max: 10000 }),
        }),
        // Generate stats data
        fc.record({
          totalRides: fc.integer({ min: 0, max: 1000 }),
          rating: fc.float({ min: 1, max: 5 }),
          acceptanceRate: fc.integer({ min: 0, max: 100 }),
        }),
        (driver, currentRide, earnings, stats) => {
          const result = service.formatDriverResponse(
            driver,
            currentRide,
            earnings,
            stats,
          );

          // Verify all required driverSlice fields are present
          expect(result).toHaveProperty('isOnline');
          expect(result).toHaveProperty('rideStatus');
          expect(result).toHaveProperty('earnings');
          expect(result).toHaveProperty('stats');

          // Verify boolean and basic fields
          expect(result.isOnline).toBe(driver.is_online);

          // Verify currentRide handling
          if (currentRide) {
            expect(result.currentRide).toBeDefined();
            expect(result.currentRide!.ride_id).toBe(currentRide._id);
            expect(result.currentRide!.status).toBe(currentRide.status);
            // The service now formats locations, so we need to expect the formatted version
            // Handle floating point precision issues and NaN values
            const expectedPickupLat = isNaN(
              currentRide.pickup_location.latitude,
            )
              ? 0
              : currentRide.pickup_location.latitude;
            const expectedPickupLng = isNaN(
              currentRide.pickup_location.longitude,
            )
              ? 0
              : currentRide.pickup_location.longitude;
            const expectedDestLat = isNaN(
              currentRide.destination_location.latitude,
            )
              ? 0
              : currentRide.destination_location.latitude;
            const expectedDestLng = isNaN(
              currentRide.destination_location.longitude,
            )
              ? 0
              : currentRide.destination_location.longitude;

            expect(result.currentRide!.pickup_location.latitude).toBeCloseTo(
              expectedPickupLat,
            );
            expect(result.currentRide!.pickup_location.longitude).toBeCloseTo(
              expectedPickupLng,
            );
            expect(result.currentRide!.pickup_location.address).toBe(''); // Service adds empty address if not provided

            expect(
              result.currentRide!.destination_location.latitude,
            ).toBeCloseTo(expectedDestLat);
            expect(
              result.currentRide!.destination_location.longitude,
            ).toBeCloseTo(expectedDestLng);
            expect(result.currentRide!.destination_location.address).toBe(''); // Service adds empty address if not provided

            // Verify status mapping
            expect(typeof result.rideStatus).toBe('string');
            expect([
              'idle',
              'request_received',
              'accepted',
              'picked_up',
              'in_progress',
              'completed',
            ]).toContain(result.rideStatus);
          } else {
            expect(result.currentRide).toBeNull();
            expect(result.rideStatus).toBe('idle');
          }

          // Verify earnings structure
          const expectedTodayEarnings = earnings.today || 0;
          const expectedTotalEarnings = earnings.total || 0;
          expect(result.earnings).toHaveProperty(
            'today',
            expectedTodayEarnings,
          );
          expect(result.earnings).toHaveProperty(
            'total',
            expectedTotalEarnings,
          );

          // Verify stats structure - handle service fallback logic and NaN values
          // The service uses fallback logic: stats.totalRides || driver.total_rides || 0
          const expectedTotalRides =
            stats.totalRides || driver.total_rides || 0;
          expect(result.stats).toHaveProperty('totalRides', expectedTotalRides);
          // The service handles NaN ratings by falling back to driver.driver_rating or 4.8
          const expectedRating = isNaN(stats.rating)
            ? driver.driver_rating || 4.8
            : stats.rating;
          expect(result.stats).toHaveProperty('rating', expectedRating);
          // The service uses nullish coalescing, so 0 is preserved, null/undefined defaults to 95
          const expectedAcceptanceRate = stats.acceptanceRate ?? 95;
          expect(result.stats).toHaveProperty(
            'acceptanceRate',
            expectedAcceptanceRate,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Error responses follow standard format
   * For any error data, the formatted error response should follow the standard
   * error format expected by frontend error handling
   */
  it('should format error responses in standard format for frontend compatibility', () => {
    fc.assert(
      fc.property(
        // Generate random error data
        fc.record({
          status: fc.integer({ min: 400, max: 599 }),
          message: fc.string({ minLength: 1, maxLength: 100 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.string({ minLength: 1, maxLength: 100 }), // path
        (error, path) => {
          const result = service.formatErrorResponse(error, path);

          // Verify all required error fields are present
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('message');
          expect(result).toHaveProperty('error');
          expect(result).toHaveProperty('timestamp');
          expect(result).toHaveProperty('path');

          // Verify field values
          expect(result.statusCode).toBe(error.status);
          expect(result.message).toBe(error.message);
          expect(result.error).toBe(error.name);
          expect(result.path).toBe(path);

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.timestamp)).not.toThrow();
          expect(new Date(result.timestamp).toISOString()).toBe(
            result.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Navigation data validation ensures React Navigation compatibility
   * For any screen name and parameters, the validated navigation data should be
   * serializable and compatible with React Navigation
   */
  it('should validate navigation data for React Navigation compatibility', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // screenName
        fc.option(
          fc.record({
            id: fc.string(),
            count: fc.integer(),
            flag: fc.boolean(),
            nested: fc.record({
              value: fc.string(),
              number: fc.integer(),
            }),
          }),
          { nil: null },
        ), // params
        (screenName, params) => {
          const result = service.validateNavigationData(screenName, params);

          // Verify structure
          expect(result).toHaveProperty('screenName', screenName);
          expect(result).toHaveProperty('params');

          // Verify params are serializable (no functions, undefined, etc.)
          if (params) {
            expect(JSON.parse(JSON.stringify(result.params))).toEqual(
              result.params,
            );
          } else {
            expect(result.params).toEqual({});
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
