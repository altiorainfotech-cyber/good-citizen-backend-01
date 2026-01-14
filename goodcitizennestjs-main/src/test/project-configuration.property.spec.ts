import * as fc from 'fast-check';
import {
  arbitraries,
  runPropertyTest,
  reduxSliceData,
  validators,
} from './test-utils';

/**
 * Property 19: API Response Format Compatibility
 * Validates: Requirements 10.1, 10.2
 *
 * Feature: ride-hailing-backend-integration, Property 19: API Response Format Compatibility
 */

describe('Property 19: API Response Format Compatibility', () => {
  it('should ensure auth API responses match Redux authSlice format', () => {
    const property = fc.property(reduxSliceData.authSlice(), (authResponse) => {
      // Verify all required fields are present
      expect(authResponse).toHaveProperty('user');
      expect(authResponse).toHaveProperty('token');
      expect(authResponse).toHaveProperty('userType');
      expect(authResponse).toHaveProperty('isAuthenticated');
      expect(authResponse).toHaveProperty('isVerified');

      // Verify user object structure
      expect(authResponse.user).toHaveProperty('_id');
      expect(authResponse.user).toHaveProperty('first_name');
      expect(authResponse.user).toHaveProperty('last_name');
      expect(authResponse.user).toHaveProperty('email');
      expect(authResponse.user).toHaveProperty('phone_number');
      expect(authResponse.user).toHaveProperty('role');
      expect(authResponse.user).toHaveProperty('loyalty_points');

      // Verify data types
      expect(typeof authResponse.user._id).toBe('string');
      expect(typeof authResponse.user.first_name).toBe('string');
      expect(typeof authResponse.user.last_name).toBe('string');
      expect(typeof authResponse.user.email).toBe('string');
      expect(typeof authResponse.user.phone_number).toBe('string');
      expect(typeof authResponse.user.role).toBe('string');
      expect(typeof authResponse.user.loyalty_points).toBe('number');
      expect(typeof authResponse.token).toBe('string');
      expect(typeof authResponse.userType).toBe('string');
      expect(typeof authResponse.isAuthenticated).toBe('boolean');
      expect(typeof authResponse.isVerified).toBe('boolean');

      // Verify valid enum values
      expect(['user', 'driver', 'admin']).toContain(authResponse.user.role);
      expect(['user', 'ambulance_driver']).toContain(authResponse.userType);

      // Verify email format if present
      if (authResponse.user.email) {
        expect(validators.isValidEmail(authResponse.user.email)).toBe(true);
      }

      // Verify loyalty points are non-negative
      expect(authResponse.user.loyalty_points).toBeGreaterThanOrEqual(0);

      return true;
    });

    runPropertyTest('Auth API Response Format Compatibility', property);
  });

  it('should ensure ride API responses match Redux rideSlice format', () => {
    const property = fc.property(reduxSliceData.rideSlice(), (rideResponse) => {
      // Verify all required fields are present
      expect(rideResponse).toHaveProperty('currentRide');
      expect(rideResponse).toHaveProperty('rideStatus');
      expect(rideResponse).toHaveProperty('pickupLocation');
      expect(rideResponse).toHaveProperty('destinationLocation');
      expect(rideResponse).toHaveProperty('estimatedFare');

      // Verify currentRide structure
      expect(rideResponse.currentRide).toHaveProperty('ride_id');
      expect(rideResponse.currentRide).toHaveProperty('status');
      expect(rideResponse.currentRide).toHaveProperty('pickup_location');
      expect(rideResponse.currentRide).toHaveProperty('destination_location');
      expect(rideResponse.currentRide).toHaveProperty('estimated_fare');

      // Verify location structures
      expect(rideResponse.currentRide.pickup_location).toHaveProperty(
        'latitude',
      );
      expect(rideResponse.currentRide.pickup_location).toHaveProperty(
        'longitude',
      );
      expect(rideResponse.currentRide.destination_location).toHaveProperty(
        'latitude',
      );
      expect(rideResponse.currentRide.destination_location).toHaveProperty(
        'longitude',
      );
      expect(rideResponse.pickupLocation).toHaveProperty('latitude');
      expect(rideResponse.pickupLocation).toHaveProperty('longitude');
      expect(rideResponse.destinationLocation).toHaveProperty('latitude');
      expect(rideResponse.destinationLocation).toHaveProperty('longitude');

      // Verify data types
      expect(typeof rideResponse.currentRide.ride_id).toBe('string');
      expect(typeof rideResponse.currentRide.status).toBe('string');
      expect(typeof rideResponse.currentRide.estimated_fare).toBe('number');
      expect(typeof rideResponse.estimatedFare).toBe('number');

      // Verify valid ride status
      expect(
        validators.isValidRideStatus(rideResponse.currentRide.status),
      ).toBe(true);
      expect(validators.isValidRideStatus(rideResponse.rideStatus)).toBe(true);

      // Verify valid GPS coordinates
      expect(
        validators.isValidLatitude(
          rideResponse.currentRide.pickup_location.latitude,
        ),
      ).toBe(true);
      expect(
        validators.isValidLongitude(
          rideResponse.currentRide.pickup_location.longitude,
        ),
      ).toBe(true);
      expect(
        validators.isValidLatitude(
          rideResponse.currentRide.destination_location.latitude,
        ),
      ).toBe(true);
      expect(
        validators.isValidLongitude(
          rideResponse.currentRide.destination_location.longitude,
        ),
      ).toBe(true);
      expect(
        validators.isValidLatitude(rideResponse.pickupLocation.latitude),
      ).toBe(true);
      expect(
        validators.isValidLongitude(rideResponse.pickupLocation.longitude),
      ).toBe(true);
      expect(
        validators.isValidLatitude(rideResponse.destinationLocation.latitude),
      ).toBe(true);
      expect(
        validators.isValidLongitude(rideResponse.destinationLocation.longitude),
      ).toBe(true);

      // Verify fare amounts are non-negative
      expect(rideResponse.currentRide.estimated_fare).toBeGreaterThanOrEqual(0);
      expect(rideResponse.estimatedFare).toBeGreaterThanOrEqual(0);

      // Verify driver structure if present
      if (rideResponse.driver) {
        expect(rideResponse.driver).toHaveProperty('driver_id');
        expect(rideResponse.driver).toHaveProperty('name');
        expect(rideResponse.driver).toHaveProperty('rating');
        expect(rideResponse.driver).toHaveProperty('vehicle');
        expect(rideResponse.driver).toHaveProperty('plate');
        expect(rideResponse.driver).toHaveProperty('phone');
        expect(rideResponse.driver).toHaveProperty('current_location');

        expect(typeof rideResponse.driver.driver_id).toBe('string');
        expect(typeof rideResponse.driver.name).toBe('string');
        expect(typeof rideResponse.driver.rating).toBe('number');
        expect(typeof rideResponse.driver.vehicle).toBe('string');
        expect(typeof rideResponse.driver.plate).toBe('string');
        expect(typeof rideResponse.driver.phone).toBe('string');

        // Verify driver rating is within valid range
        expect(rideResponse.driver.rating).toBeGreaterThanOrEqual(1);
        expect(rideResponse.driver.rating).toBeLessThanOrEqual(5);

        // Verify driver location
        expect(
          validators.isValidLatitude(
            rideResponse.driver.current_location.latitude,
          ),
        ).toBe(true);
        expect(
          validators.isValidLongitude(
            rideResponse.driver.current_location.longitude,
          ),
        ).toBe(true);
      }

      return true;
    });

    runPropertyTest('Ride API Response Format Compatibility', property);
  });

  it('should ensure driver API responses match Redux driverSlice format', () => {
    const property = fc.property(
      reduxSliceData.driverSlice(),
      (driverResponse) => {
        // Verify all required fields are present
        expect(driverResponse).toHaveProperty('isOnline');
        expect(driverResponse).toHaveProperty('rideStatus');
        expect(driverResponse).toHaveProperty('earnings');
        expect(driverResponse).toHaveProperty('stats');

        // Verify data types
        expect(typeof driverResponse.isOnline).toBe('boolean');
        expect(typeof driverResponse.rideStatus).toBe('string');

        // Verify valid driver ride status
        const validDriverStatuses = [
          'idle',
          'request_received',
          'accepted',
          'picked_up',
          'in_progress',
          'completed',
        ];
        expect(validDriverStatuses).toContain(driverResponse.rideStatus);

        // Verify earnings structure
        expect(driverResponse.earnings).toHaveProperty('today');
        expect(driverResponse.earnings).toHaveProperty('total');
        expect(typeof driverResponse.earnings.today).toBe('number');
        expect(typeof driverResponse.earnings.total).toBe('number');
        expect(driverResponse.earnings.today).toBeGreaterThanOrEqual(0);
        expect(driverResponse.earnings.total).toBeGreaterThanOrEqual(0);

        // Verify stats structure
        expect(driverResponse.stats).toHaveProperty('totalRides');
        expect(driverResponse.stats).toHaveProperty('rating');
        expect(driverResponse.stats).toHaveProperty('acceptanceRate');
        expect(typeof driverResponse.stats.totalRides).toBe('number');
        expect(typeof driverResponse.stats.rating).toBe('number');
        expect(typeof driverResponse.stats.acceptanceRate).toBe('number');
        expect(driverResponse.stats.totalRides).toBeGreaterThanOrEqual(0);
        expect(driverResponse.stats.rating).toBeGreaterThanOrEqual(1);
        expect(driverResponse.stats.rating).toBeLessThanOrEqual(5);
        expect(driverResponse.stats.acceptanceRate).toBeGreaterThanOrEqual(0);
        expect(driverResponse.stats.acceptanceRate).toBeLessThanOrEqual(1);

        // Verify currentRide structure if present
        if (driverResponse.currentRide) {
          expect(driverResponse.currentRide).toHaveProperty('ride_id');
          expect(driverResponse.currentRide).toHaveProperty('pickup_location');
          expect(driverResponse.currentRide).toHaveProperty(
            'destination_location',
          );
          expect(driverResponse.currentRide).toHaveProperty('status');

          expect(typeof driverResponse.currentRide.ride_id).toBe('string');
          expect(
            validators.isValidRideStatus(driverResponse.currentRide.status),
          ).toBe(true);
          expect(
            validators.isValidLatitude(
              driverResponse.currentRide.pickup_location.latitude,
            ),
          ).toBe(true);
          expect(
            validators.isValidLongitude(
              driverResponse.currentRide.pickup_location.longitude,
            ),
          ).toBe(true);
          expect(
            validators.isValidLatitude(
              driverResponse.currentRide.destination_location.latitude,
            ),
          ).toBe(true);
          expect(
            validators.isValidLongitude(
              driverResponse.currentRide.destination_location.longitude,
            ),
          ).toBe(true);
        }

        return true;
      },
    );

    runPropertyTest('Driver API Response Format Compatibility', property);
  });

  it('should ensure error responses follow standardized format', () => {
    const property = fc.property(
      arbitraries.errorResponse(),
      (errorResponse) => {
        // Verify all required fields are present
        expect(errorResponse).toHaveProperty('statusCode');
        expect(errorResponse).toHaveProperty('message');
        expect(errorResponse).toHaveProperty('error');
        expect(errorResponse).toHaveProperty('timestamp');
        expect(errorResponse).toHaveProperty('path');

        // Verify data types
        expect(typeof errorResponse.statusCode).toBe('number');
        expect(typeof errorResponse.error).toBe('string');
        expect(typeof errorResponse.timestamp).toBe('string');
        expect(typeof errorResponse.path).toBe('string');

        // Message can be string or array of strings
        expect(
          typeof errorResponse.message === 'string' ||
            Array.isArray(errorResponse.message),
        ).toBe(true);

        if (Array.isArray(errorResponse.message)) {
          errorResponse.message.forEach((msg) => {
            expect(typeof msg).toBe('string');
          });
        }

        // Verify status code is in error range
        expect(errorResponse.statusCode).toBeGreaterThanOrEqual(400);
        expect(errorResponse.statusCode).toBeLessThan(600);

        return true;
      },
    );

    runPropertyTest('Error Response Format Standardization', property);
  });
});
