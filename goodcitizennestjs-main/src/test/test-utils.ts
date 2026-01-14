import * as fc from 'fast-check';

/**
 * Property-based testing utilities for the ride-hailing backend
 */

// Common arbitraries for testing
export const arbitraries = {
  // User data generators
  email: () => fc.emailAddress(),
  password: () => fc.string({ minLength: 8, maxLength: 50 }),
  name: () => fc.string({ minLength: 1, maxLength: 50 }),
  phoneNumber: () => fc.string({ minLength: 10, maxLength: 15 }),

  // Location data generators
  latitude: () => fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: () => fc.double({ min: -180, max: 180, noNaN: true }),
  location: () =>
    fc.record({
      latitude: arbitraries.latitude(),
      longitude: arbitraries.longitude(),
    }),

  // JWT token generators
  jwtToken: () => fc.string({ minLength: 100, maxLength: 500 }),

  // Ride data generators
  rideStatus: () =>
    fc.constantFrom(
      'requested',
      'driver_assigned',
      'driver_arriving',
      'driver_arrived',
      'in_progress',
      'completed',
      'cancelled',
    ),
  vehicleType: () => fc.constantFrom('REGULAR', 'EMERGENCY'),

  // API response generators
  apiResponse: <T>(dataArbitrary: fc.Arbitrary<T>) =>
    fc.record({
      statusCode: fc.integer({ min: 200, max: 599 }),
      message: fc.string(),
      data: dataArbitrary,
      timestamp: fc.date(),
    }),

  // Error response generators
  errorResponse: () =>
    fc.record({
      statusCode: fc.integer({ min: 400, max: 599 }),
      message: fc.oneof(fc.string(), fc.array(fc.string())),
      error: fc.string(),
      timestamp: fc.string(),
      path: fc.string(),
    }),
};

// Property-based test configuration
export const pbtConfig = {
  numRuns: parseInt(process.env.PBT_NUM_RUNS || '100', 10),
  seed: parseInt(process.env.PBT_SEED || '42', 10),
  verbose: process.env.NODE_ENV === 'testing',
};

// Helper function to run property-based tests
export const runPropertyTest = (
  _name: string,
  property: fc.IProperty<unknown>,
  config: Partial<fc.Parameters<unknown>> = {},
) => {
  return fc.assert(property, {
    ...pbtConfig,
    ...config,
  });
};

// Common test data for Redux slice compatibility
export const reduxSliceData = {
  authSlice: () =>
    fc.record({
      user: fc.record({
        _id: fc.string(),
        first_name: fc.string(),
        last_name: fc.string(),
        email: arbitraries.email(),
        phone_number: arbitraries.phoneNumber(),
        role: fc.constantFrom('user', 'driver', 'admin'),
        loyalty_points: fc.integer({ min: 0, max: 10000 }),
      }),
      token: arbitraries.jwtToken(),
      userType: fc.constantFrom('user', 'ambulance_driver'),
      isAuthenticated: fc.boolean(),
      isVerified: fc.boolean(),
    }),

  rideSlice: () =>
    fc.record({
      currentRide: fc.record({
        ride_id: fc.string(),
        status: arbitraries.rideStatus(),
        pickup_location: arbitraries.location(),
        destination_location: arbitraries.location(),
        estimated_fare: fc.double({ min: 0, max: 1000 }),
      }),
      rideStatus: arbitraries.rideStatus(),
      driver: fc.option(
        fc.record({
          driver_id: fc.string(),
          name: fc.string(),
          rating: fc.double({ min: 1, max: 5 }),
          vehicle: fc.string(),
          plate: fc.string(),
          phone: arbitraries.phoneNumber(),
          current_location: arbitraries.location(),
        }),
      ),
      pickupLocation: arbitraries.location(),
      destinationLocation: arbitraries.location(),
      estimatedFare: fc.double({ min: 0, max: 1000 }),
    }),

  driverSlice: () =>
    fc.record({
      isOnline: fc.boolean(),
      currentRide: fc.option(
        fc.record({
          ride_id: fc.string(),
          pickup_location: arbitraries.location(),
          destination_location: arbitraries.location(),
          status: arbitraries.rideStatus(),
        }),
      ),
      rideStatus: fc.constantFrom(
        'idle',
        'request_received',
        'accepted',
        'picked_up',
        'in_progress',
        'completed',
      ),
      earnings: fc.record({
        today: fc.double({ min: 0, max: 1000 }),
        total: fc.double({ min: 0, max: 10000 }),
      }),
      stats: fc.record({
        totalRides: fc.integer({ min: 0, max: 10000 }),
        rating: fc.double({ min: 1, max: 5 }),
        acceptanceRate: fc.double({ min: 0, max: 1 }),
      }),
    }),
};

// Validation helpers
export const validators = {
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidLatitude: (lat: number): boolean => {
    return lat >= -90 && lat <= 90;
  },

  isValidLongitude: (lng: number): boolean => {
    return lng >= -180 && lng <= 180;
  },

  isValidJWT: (token: string): boolean => {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    return jwtRegex.test(token);
  },

  isValidRideStatus: (status: string): boolean => {
    const validStatuses = [
      'requested',
      'driver_assigned',
      'driver_arriving',
      'driver_arrived',
      'in_progress',
      'completed',
      'cancelled',
    ];
    return validStatuses.includes(status);
  },
};

// Mock data generators for testing
export const mockData = {
  user: () => ({
    _id: '507f1f77bcf86cd799439011',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone_number: '+1234567890',
    role: 'user' as const,
    loyalty_points: 100,
  }),

  driver: () => ({
    _id: '507f1f77bcf86cd799439012',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    phone_number: '+1234567891',
    role: 'driver' as const,
    vehicle_type: 'sedan',
    vehicle_plate: 'ABC123',
    driver_rating: 4.5,
    approval: 'APPROVED' as const,
  }),

  ride: () => ({
    _id: '507f1f77bcf86cd799439013',
    user_id: '507f1f77bcf86cd799439011',
    driver_id: '507f1f77bcf86cd799439012',
    pickup_location: {
      latitude: 40.7128,
      longitude: -74.006,
      address: '123 Main St, New York, NY',
    },
    destination_location: {
      latitude: 40.7589,
      longitude: -73.9851,
      address: '456 Broadway, New York, NY',
    },
    status: 'requested' as const,
    vehicle_type: 'REGULAR' as const,
    estimated_fare: 25.5,
  }),
};
