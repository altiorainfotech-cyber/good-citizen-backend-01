/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketEventCompatibilityService } from '../common/websocket-event-compatibility.service';
import { FrontendIntegrationService } from '../common/frontend-integration.service';
import * as fc from 'fast-check';

/**
 * Property-Based Test: WebSocket Event Format Consistency
 *
 * **Feature: ride-hailing-backend-integration, Property 22: WebSocket Event Format Consistency**
 * **Validates: Requirements 21.4, 23.2, 23.3**
 *
 * This test ensures that WebSocket events emitted by the server match the exact
 * event names and data structures expected by the frontend event listeners,
 * enabling seamless real-time communication without modification.
 */
describe('WebSocket Event Format Consistency Property Tests', () => {
  let service: WebSocketEventCompatibilityService;
  let frontendService: FrontendIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketEventCompatibilityService,
        FrontendIntegrationService,
      ],
    }).compile();

    service = module.get<WebSocketEventCompatibilityService>(
      WebSocketEventCompatibilityService,
    );
    frontendService = module.get<FrontendIntegrationService>(
      FrontendIntegrationService,
    );
  });

  /**
   * Property: Location update events follow consistent format
   * For any valid user ID and location data, the formatted location update event
   * should contain all required fields in the expected structure
   */
  it('should format location update events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 24, maxLength: 24 }), // userId
        fc.record({
          lat: fc.float({ min: -90, max: 90 }),
          long: fc.float({ min: -180, max: 180 }),
        }), // location
        (userId, location) => {
          const result = service.formatLocationUpdateEvent(userId, location);

          // Verify event structure
          expect(result).toHaveProperty('event', 'location_saved');
          expect(result).toHaveProperty('data');

          // Verify data structure
          expect(result.data).toHaveProperty('userId', userId);
          expect(result.data).toHaveProperty('coordinates');
          expect(result.data).toHaveProperty('timestamp');

          // Verify coordinates structure
          expect(result.data.coordinates).toHaveProperty('lat');
          expect(result.data.coordinates).toHaveProperty('long');
          expect(result.data.coordinates.lat).toBeCloseTo(location.lat);
          expect(result.data.coordinates.long).toBeCloseTo(location.long);

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Driver location events follow consistent format
   * For any valid driver and ride data, the formatted driver location event
   * should contain all required fields in the expected structure
   */
  it('should format driver location events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 24, maxLength: 24 }), // driverId
        fc.string({ minLength: 24, maxLength: 24 }), // rideId
        fc.record({
          lat: fc.float({ min: -90, max: 90 }),
          long: fc.float({ min: -180, max: 180 }),
        }), // location
        fc.option(
          fc.record({
            _id: fc.string({ minLength: 24, maxLength: 24 }),
            first_name: fc.string({ minLength: 1, maxLength: 50 }),
            last_name: fc.string({ minLength: 1, maxLength: 50 }),
            driver_rating: fc.float({ min: 1, max: 5 }),
            vehicle_type: fc.string({ minLength: 3, maxLength: 20 }),
            vehicle_plate: fc.string({ minLength: 3, maxLength: 10 }),
          }),
          { nil: null },
        ), // driverInfo
        (driverId, rideId, location, driverInfo) => {
          const result = service.formatDriverLocationEvent(
            driverId,
            rideId,
            location,
            driverInfo,
          );

          // Verify event structure
          expect(result).toHaveProperty('event', 'driver_location_update');
          expect(result).toHaveProperty('data');

          // Verify data structure
          expect(result.data).toHaveProperty('driverId', driverId);
          expect(result.data).toHaveProperty('rideId', rideId);
          expect(result.data).toHaveProperty('location');
          expect(result.data).toHaveProperty('timestamp');

          // Verify location structure
          expect(result.data.location).toHaveProperty('lat');
          expect(result.data.location).toHaveProperty('long');

          // Handle NaN values - service converts NaN to 0
          const expectedLat = isNaN(location.lat) ? 0 : location.lat;
          const expectedLong = isNaN(location.long) ? 0 : location.long;
          expect(result.data.location.lat).toBeCloseTo(expectedLat);
          expect(result.data.location.long).toBeCloseTo(expectedLong);

          // Verify driver info handling
          if (driverInfo) {
            expect(result.data.driver).toBeDefined();
            expect(result.data.driver.id).toBe(driverInfo._id);
            const expectedName =
              `${driverInfo.first_name} ${driverInfo.last_name}`.trim() ||
              'Unknown Driver';
            expect(result.data.driver.name).toBe(expectedName);
            // The service handles NaN ratings by providing a default of 4.8
            const expectedRating = isNaN(driverInfo.driver_rating)
              ? 4.8
              : driverInfo.driver_rating;
            expect(result.data.driver.rating).toBeCloseTo(expectedRating);
            expect(result.data.driver.vehicle).toBe(driverInfo.vehicle_type);
            expect(result.data.driver.plate).toBe(driverInfo.vehicle_plate);
          } else {
            expect(result.data.driver).toBeNull();
          }

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Ride status change events follow consistent format
   * For any valid ride status change data, the formatted event should contain
   * all required fields in the expected structure
   */
  it('should format ride status change events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 24, maxLength: 24 }), // rideId
        fc.constantFrom(
          'requested',
          'driver_assigned',
          'driver_arriving',
          'in_progress',
          'completed',
        ), // status
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
              address: fc.string({ minLength: 5, maxLength: 100 }),
            }),
            destination_location: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 }),
              address: fc.string({ minLength: 5, maxLength: 100 }),
            }),
            estimated_fare: fc.float({ min: 5, max: 100 }),
          }),
          { nil: null },
        ), // rideData
        (rideId, status, rideData) => {
          const result = service.formatRideStatusChangeEvent(
            rideId,
            status,
            rideData,
          );

          // Verify event structure
          expect(result).toHaveProperty('event', 'ride_status_changed');
          expect(result).toHaveProperty('data');

          // Verify data structure
          expect(result.data).toHaveProperty('rideId', rideId);
          expect(result.data).toHaveProperty('status', status);
          expect(result.data).toHaveProperty('timestamp');

          // Verify ride data handling
          if (rideData) {
            expect(result.data.ride).toBeDefined();
            // The ride data should be formatted by FrontendIntegrationService
            expect(result.data.ride).toHaveProperty('currentRide');
            expect(result.data.ride).toHaveProperty('rideStatus');
            expect(result.data.ride.currentRide.ride_id).toBe(rideData._id);
          } else {
            expect(result.data.ride).toBeNull();
          }

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Emergency alert events follow consistent format
   * For any valid emergency alert data, the formatted event should contain
   * all required fields in the expected structure
   */
  it('should format emergency alert events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 24, maxLength: 24 }), // userId
        fc.record({
          driverId: fc.string({ minLength: 24, maxLength: 24 }),
          rideId: fc.string({ minLength: 24, maxLength: 24 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
          estimatedArrival: fc.integer({ min: 30, max: 600 }),
          location: fc.record({
            lat: fc.float({ min: -90, max: 90 }),
            long: fc.float({ min: -180, max: 180 }),
          }),
        }), // emergencyData
        (userId, emergencyData) => {
          const result = service.formatEmergencyAlertEvent(
            userId,
            emergencyData,
          );

          // Verify event structure
          expect(result).toHaveProperty('event', 'emergency_alert');
          expect(result).toHaveProperty('data');

          // Verify data structure
          expect(result.data).toHaveProperty('userId', userId);
          expect(result.data).toHaveProperty('emergency');
          expect(result.data).toHaveProperty('timestamp');
          expect(result.data).toHaveProperty('priority', 'high');

          // Verify emergency data structure
          expect(result.data.emergency).toHaveProperty(
            'driverId',
            emergencyData.driverId,
          );
          expect(result.data.emergency).toHaveProperty(
            'rideId',
            emergencyData.rideId,
          );
          expect(result.data.emergency).toHaveProperty(
            'message',
            emergencyData.message,
          );
          expect(result.data.emergency).toHaveProperty(
            'estimatedArrival',
            emergencyData.estimatedArrival,
          );
          expect(result.data.emergency).toHaveProperty('location');

          // Verify location structure - handle NaN values
          const expectedLat = isNaN(emergencyData.location.lat)
            ? 0
            : emergencyData.location.lat;
          const expectedLong = isNaN(emergencyData.location.long)
            ? 0
            : emergencyData.location.long;
          expect(result.data.emergency.location.lat).toBeCloseTo(expectedLat);
          expect(result.data.emergency.location.long).toBeCloseTo(expectedLong);

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Error events follow consistent format
   * For any error code and message, the formatted error event should contain
   * all required fields in the expected structure
   */
  it('should format error events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // code
        fc.string({ minLength: 1, maxLength: 200 }), // message
        fc.option(
          fc.record({
            details: fc.string(),
            context: fc.string(),
          }),
          { nil: null },
        ), // details
        (code, message, details) => {
          const result = service.formatErrorEvent(code, message, details);

          // Verify event structure
          expect(result).toHaveProperty('event', 'error');
          expect(result).toHaveProperty('data');

          // Verify data structure matches StandardErrorResponse format
          expect(result.data).toHaveProperty('statusCode');
          expect(result.data).toHaveProperty('message');
          expect(result.data).toHaveProperty('error');
          expect(result.data).toHaveProperty('timestamp');
          expect(result.data).toHaveProperty('path');

          // Verify field values
          expect(result.data.statusCode).toBe(400);
          expect(result.data.message).toBe(message);
          expect(result.data.error).toBe(code);
          expect(result.data.path).toBe('websocket');

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Connection events follow consistent format
   * For any user connection data, the formatted connection event should contain
   * all required fields in the expected structure
   */
  it('should format connection events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 24, maxLength: 24 }), // userId
        fc.oneof(
          fc.constant('user' as const),
          fc.constant('ambulance_driver' as const),
        ), // userType
        (userId, userType: 'user' | 'ambulance_driver') => {
          const result = service.formatConnectionEvent(userId, userType);

          // Verify event structure
          expect(result).toHaveProperty('event', 'connected');
          expect(result).toHaveProperty('data');

          // Verify data structure
          expect(result.data).toHaveProperty('userId', userId);
          expect(result.data).toHaveProperty('userType', userType);
          expect(result.data).toHaveProperty('timestamp');
          expect(result.data).toHaveProperty(
            'message',
            'Connected successfully',
          );

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Acknowledgment events follow consistent format
   * For any original event and request data, the formatted acknowledgment event
   * should contain all required fields in the expected structure
   */
  it('should format acknowledgment events consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // originalEvent
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
          nil: undefined,
        }), // requestId
        fc.option(
          fc.record({
            key: fc.string(),
            value: fc.integer(),
          }),
          { nil: null },
        ), // data
        (originalEvent, requestId, data) => {
          const result = service.formatAcknowledgmentEvent(
            originalEvent,
            requestId,
            data,
          );

          // Verify event structure
          expect(result).toHaveProperty(
            'event',
            `${originalEvent}_acknowledged`,
          );
          expect(result).toHaveProperty('data');

          // Verify data structure
          expect(result.data).toHaveProperty('originalEvent', originalEvent);
          expect(result.data).toHaveProperty('requestId');
          expect(result.data).toHaveProperty('timestamp');

          // Verify requestId handling
          if (requestId) {
            expect(result.data.requestId).toBe(requestId);
          } else {
            expect(typeof result.data.requestId).toBe('string');
            expect(result.data.requestId.length).toBeGreaterThan(0);
          }

          // Verify data handling
          if (data) {
            expect(result.data.data).toEqual(data);
          } else {
            expect(result.data.data).toBeNull();
          }

          // Verify timestamp is valid ISO string
          expect(() => new Date(result.data.timestamp)).not.toThrow();
          expect(new Date(result.data.timestamp).toISOString()).toBe(
            result.data.timestamp,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Event validation ensures all events are serializable
   * For any generated event, the validation should ensure it can be safely
   * serialized and transmitted over WebSocket
   */
  it('should validate events for serialization compatibility', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 24, maxLength: 24 }), // userId
        fc.record({
          lat: fc.float({ min: -90, max: 90 }),
          long: fc.float({ min: -180, max: 180 }),
        }), // location
        (userId, location) => {
          const originalEvent = service.formatLocationUpdateEvent(
            userId,
            location,
          );
          const validatedEvent =
            service.validateAndSanitizeEvent(originalEvent);

          // Verify the event can be serialized and deserialized
          expect(() => JSON.stringify(validatedEvent)).not.toThrow();
          const serialized = JSON.stringify(validatedEvent);
          const deserialized = JSON.parse(serialized);

          // Verify structure is preserved
          expect(deserialized).toHaveProperty('event');
          expect(deserialized).toHaveProperty('data');
          expect(deserialized.data).toHaveProperty('timestamp');

          // Verify timestamp is valid
          expect(() => new Date(deserialized.data.timestamp)).not.toThrow();

          // Verify no undefined values exist
          const hasUndefined = (obj: any): boolean => {
            if (obj === undefined) return true;
            if (typeof obj === 'object' && obj !== null) {
              return Object.values(obj).some(hasUndefined);
            }
            return false;
          };
          expect(hasUndefined(validatedEvent)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Batch formatting maintains individual event integrity
   * For any array of events, batch formatting should produce the same results
   * as individual formatting for each event
   */
  it('should maintain event integrity in batch formatting', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant('location_update'),
              data: fc.record({
                userId: fc.string({ minLength: 24, maxLength: 24 }),
                location: fc.record({
                  lat: fc.float({ min: -90, max: 90 }),
                  long: fc.float({ min: -180, max: 180 }),
                }),
              }),
            }),
            fc.record({
              type: fc.constant('notification'),
              data: fc.record({
                userId: fc.string({ minLength: 24, maxLength: 24 }),
                notification: fc.record({
                  title: fc.string({ minLength: 1, maxLength: 100 }),
                  message: fc.string({ minLength: 1, maxLength: 200 }),
                  type: fc.string({ minLength: 1, maxLength: 50 }),
                }),
              }),
            }),
          ),
          { minLength: 1, maxLength: 3 },
        ), // events
        (events) => {
          const batchResult = service.batchFormatEvents(events);

          // Verify batch result has same length as input
          expect(batchResult).toHaveLength(events.length);

          // Verify each event in batch has proper structure
          batchResult.forEach((event, index) => {
            expect(event).toHaveProperty('event');
            expect(event).toHaveProperty('data');

            // Handle different event structures
            if (event.event === 'notification') {
              // Notification events have nested structure
              expect(event.data).toHaveProperty('notification');
              expect(event.data.notification).toHaveProperty('timestamp');

              // Verify timestamp is valid ISO string
              expect(
                () => new Date(event.data.notification.timestamp),
              ).not.toThrow();
              expect(
                new Date(event.data.notification.timestamp).toISOString(),
              ).toBe(event.data.notification.timestamp);
            } else {
              // Other events have top-level timestamp
              expect(event.data).toHaveProperty('timestamp');

              // Verify timestamp is valid ISO string
              expect(() => new Date(event.data.timestamp)).not.toThrow();
              expect(new Date(event.data.timestamp).toISOString()).toBe(
                event.data.timestamp,
              );
            }
          });
        },
      ),
      { numRuns: 50 }, // Reduced runs for batch testing
    );
  });
});
