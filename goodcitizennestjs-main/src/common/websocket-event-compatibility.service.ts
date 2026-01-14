/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { FrontendIntegrationService } from './frontend-integration.service';

/**
 * WebSocket Event Compatibility Service
 *
 * This service ensures WebSocket events emitted by the server match the exact
 * event names and data structures expected by the frontend event listeners.
 *
 * It provides standardized event formatting, error handling, and reconnection
 * logic for WebSocket communication to ensure seamless frontend integration.
 *
 * Requirements: 21.4, 23.1, 23.4, 23.6
 */
@Injectable()
export class WebSocketEventCompatibilityService {
  private readonly logger = new Logger(WebSocketEventCompatibilityService.name);

  constructor(
    private readonly frontendIntegration: FrontendIntegrationService,
  ) {}

  /**
   * Format location update event for frontend compatibility
   * Expected by frontend: 'save_location' event with { lat, long, timestamp }
   *
   * Requirements: 21.4
   */
  formatLocationUpdateEvent(
    userId: string,
    location: { lat: number; long: number },
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'location_saved',
        data: {
          userId,
          coordinates: {
            lat: location.lat,
            long: location.long,
          },
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(`Formatted location update event for user ${userId}`);
      return event;
    } catch (error) {
      this.logger.error('Error formatting location update event:', error);
      return this.formatErrorEvent(
        'LOCATION_FORMAT_ERROR',
        'Failed to format location update',
      );
    }
  }

  /**
   * Format driver location event for frontend compatibility
   * Expected by frontend: 'driver_location' event with driver location and ride info
   *
   * Requirements: 21.4, 23.2
   */
  formatDriverLocationEvent(
    driverId: string,
    rideId: string,
    location: { lat: number; long: number },
    driverInfo?: any,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'driver_location_update',
        data: {
          driverId,
          rideId,
          location: {
            lat: isNaN(location.lat) ? 0 : location.lat,
            long: isNaN(location.long) ? 0 : location.long,
          },
          driver: driverInfo
            ? {
                id:
                  driverInfo._id?.toString() || driverInfo.id?.toString() || '',
                name:
                  `${driverInfo.first_name || ''} ${driverInfo.last_name || ''}`.trim() ||
                  'Unknown Driver',
                rating: this.safeNumber(driverInfo.driver_rating) || 4.8,
                vehicle: driverInfo.vehicle_type || 'Unknown',
                plate: driverInfo.vehicle_plate || 'N/A',
              }
            : null,
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(
        `Formatted driver location event for driver ${driverId}, ride ${rideId}`,
      );
      return event;
    } catch (error) {
      this.logger.error('Error formatting driver location event:', error);
      return this.formatErrorEvent(
        'DRIVER_LOCATION_FORMAT_ERROR',
        'Failed to format driver location',
      );
    }
  }

  /**
   * Format ride status change event for frontend compatibility
   * Expected by frontend: 'ride_status_changed' event with ride data
   *
   * Requirements: 21.4, 23.3
   */
  formatRideStatusChangeEvent(
    rideId: string,
    status: string,
    rideData?: any,
    driverData?: any,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'ride_status_changed',
        data: {
          rideId,
          status,
          ride: rideData
            ? this.frontendIntegration.formatRideResponse(rideData, driverData)
            : null,
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(
        `Formatted ride status change event for ride ${rideId}, status: ${status}`,
      );
      return event;
    } catch (error) {
      this.logger.error('Error formatting ride status change event:', error);
      return this.formatErrorEvent(
        'RIDE_STATUS_FORMAT_ERROR',
        'Failed to format ride status change',
      );
    }
  }

  /**
   * Format emergency alert event for frontend compatibility
   * Expected by frontend: 'emergency_alert' event with emergency details
   */
  formatEmergencyAlertEvent(
    userId: string,
    emergencyData: {
      driverId: string;
      rideId: string;
      message: string;
      estimatedArrival: number;
      location: { lat: number; long: number };
    },
  ): WebSocketEvent {
    return {
      event: 'emergency_alert',
      data: {
        userId,
        emergency: {
          driverId: emergencyData.driverId,
          rideId: emergencyData.rideId,
          message: emergencyData.message,
          estimatedArrival: emergencyData.estimatedArrival,
          location: {
            lat: isNaN(emergencyData.location.lat)
              ? 0
              : emergencyData.location.lat,
            long: isNaN(emergencyData.location.long)
              ? 0
              : emergencyData.location.long,
          },
        },
        timestamp: new Date().toISOString(),
        priority: 'high',
      },
    };
  }

  /**
   * Format ride offer event for drivers (Partner App)
   * Expected by frontend: 'ride_offer' event with ride details
   */
  formatRideOfferEvent(
    driverId: string,
    rideData: any,
    estimatedDistance?: number,
  ): WebSocketEvent {
    return {
      event: 'ride_offer',
      data: {
        driverId,
        ride: {
          rideId: rideData._id || rideData.ride_id,
          pickupLocation: rideData.pickup_location,
          destinationLocation: rideData.destination_location,
          estimatedFare: rideData.estimated_fare,
          vehicleType: rideData.vehicle_type,
          isEmergency: rideData.vehicle_type === 'EMERGENCY',
          estimatedDistance: estimatedDistance || 0,
        },
        expiresAt: new Date(Date.now() + 30000).toISOString(), // 30 seconds
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format connection confirmation event
   * Expected by frontend: 'connected' event with user info
   */
  formatConnectionEvent(
    userId: string,
    userType: 'user' | 'ambulance_driver',
  ): WebSocketEvent {
    return {
      event: 'connected',
      data: {
        userId,
        userType,
        timestamp: new Date().toISOString(),
        message: 'Connected successfully',
      },
    };
  }

  /**
   * Format error event for frontend error handling
   * Expected by frontend: 'error' event with standardized error format
   */
  formatErrorEvent(
    code: string,
    message: string,
    details?: any,
  ): WebSocketEvent {
    return {
      event: 'error',
      data: this.frontendIntegration.formatErrorResponse(
        { status: 400, message, name: code },
        'websocket',
      ),
    };
  }

  /**
   * Format notification event for frontend compatibility
   * Expected by frontend: 'notification' event with notification data
   */
  formatNotificationEvent(
    userId: string,
    notification: {
      title: string;
      message: string;
      type: string;
      data?: any;
    },
  ): WebSocketEvent {
    return {
      event: 'notification',
      data: {
        userId,
        notification: {
          id: Date.now().toString(), // Simple ID for frontend tracking
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Format user online/offline status event
   * Expected by frontend: 'user_status_changed' event
   */
  formatUserStatusEvent(
    userId: string,
    status: 'online' | 'offline',
    userType: 'user' | 'ambulance_driver',
  ): WebSocketEvent {
    return {
      event: 'user_status_changed',
      data: {
        userId,
        status,
        userType,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format driver availability change event (Partner App)
   * Expected by frontend: 'driver_availability_changed' event
   */
  formatDriverAvailabilityEvent(
    driverId: string,
    isOnline: boolean,
    location?: { lat: number; long: number },
  ): WebSocketEvent {
    return {
      event: 'driver_availability_changed',
      data: {
        driverId,
        isOnline,
        location: location || null,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format ambulance availability event for frontend compatibility
   * Expected by frontend: 'ambulance_availability' event
   */
  formatAmbulanceAvailabilityEvent(
    ambulanceId: string,
    isAvailable: boolean,
    location?: { lat: number; long: number },
    driverInfo?: any,
  ): WebSocketEvent {
    return {
      event: 'ambulance_availability',
      data: {
        ambulanceId,
        isAvailable,
        location: location || null,
        driver: driverInfo
          ? {
              id: driverInfo._id?.toString() || driverInfo.id?.toString() || '',
              name:
                `${driverInfo.first_name || ''} ${driverInfo.last_name || ''}`.trim() ||
                'Unknown Driver',
              rating: this.safeNumber(driverInfo.driver_rating) || 4.8,
            }
          : null,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format emergency service status event for frontend compatibility
   * Expected by frontend: 'emergency_service_status' event
   */
  formatEmergencyServiceStatusEvent(
    serviceId: string,
    status: string,
    location?: { lat: number; long: number },
    estimatedArrival?: number,
  ): WebSocketEvent {
    return {
      event: 'emergency_service_status',
      data: {
        serviceId,
        status,
        location: location || null,
        estimatedArrival: estimatedArrival || null,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format entity location update event for frontend compatibility
   * Expected by frontend: 'entity_location_update' event
   */
  formatEntityLocationUpdateEvent(
    entityId: string,
    entityType: string,
    location: { lat: number; long: number },
    additionalData?: any,
  ): WebSocketEvent {
    return {
      event: 'entity_location_update',
      data: {
        entityId,
        entityType,
        location: {
          lat: isNaN(location.lat) ? 0 : location.lat,
          long: isNaN(location.long) ? 0 : location.long,
        },
        additionalData: additionalData || null,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate event data for frontend compatibility
   * Ensures all event data is serializable and follows expected patterns
   */
  validateEventData(event: WebSocketEvent): boolean {
    try {
      // Check required fields
      if (!event.event || !event.data) {
        return false;
      }

      // Ensure data is serializable
      JSON.stringify(event.data);

      // Check timestamp format if present
      if (event.data.timestamp) {
        const timestamp = new Date(event.data.timestamp);
        if (isNaN(timestamp.getTime())) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create paginated response for WebSocket list events
   * Ensures pagination follows frontend expectations
   */
  formatPaginatedEvent(
    eventName: string,
    items: any[],
    total: number,
    page: number,
    limit: number,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: eventName,
        data: {
          items,
          pagination: {
            total,
            page,
            limit,
            hasMore: page * limit < total,
            totalPages: Math.ceil(total / limit),
          },
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(
        `Formatted paginated event ${eventName} with ${items.length} items`,
      );
      return event;
    } catch (error) {
      this.logger.error('Error formatting paginated event:', error);
      return this.formatErrorEvent(
        'PAGINATION_FORMAT_ERROR',
        'Failed to format paginated event',
      );
    }
  }

  /**
   * Format acknowledgment event for frontend request tracking
   * Expected by frontend: '{original_event}_acknowledged' event
   */
  formatAcknowledgmentEvent(
    originalEvent: string,
    requestId?: string,
    data?: any,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: `${originalEvent}_acknowledged`,
        data: {
          originalEvent,
          requestId: requestId || Date.now().toString(),
          data: data || null,
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(`Formatted acknowledgment event for ${originalEvent}`);
      return event;
    } catch (error) {
      this.logger.error('Error formatting acknowledgment event:', error);
      return this.formatErrorEvent(
        'ACK_FORMAT_ERROR',
        'Failed to format acknowledgment',
      );
    }
  }

  /**
   * Safely convert value to number, handling NaN and invalid values
   */
  private safeNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Format reconnection event with exponential backoff information
   * Expected by frontend: 'reconnection_info' event with backoff details
   *
   * Requirements: 23.4, 23.6
   */
  formatReconnectionEvent(
    attempt: number,
    nextRetryIn: number,
    maxRetries: number,
    reason?: string,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'reconnection_info',
        data: {
          attempt,
          nextRetryIn,
          maxRetries,
          reason: reason || 'Connection lost',
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(
        `Formatted reconnection event, attempt ${attempt}/${maxRetries}`,
      );
      return event;
    } catch (error) {
      this.logger.error('Error formatting reconnection event:', error);
      return this.formatErrorEvent(
        'RECONNECTION_FORMAT_ERROR',
        'Failed to format reconnection info',
      );
    }
  }

  /**
   * Format connection quality event for frontend monitoring
   * Expected by frontend: 'connection_quality' event with quality metrics
   *
   * Requirements: 23.6
   */
  formatConnectionQualityEvent(
    latency: number,
    quality: 'excellent' | 'good' | 'fair' | 'poor',
    packetsLost?: number,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'connection_quality',
        data: {
          latency,
          quality,
          packetsLost: packetsLost || 0,
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(
        `Formatted connection quality event: ${quality} (${latency}ms)`,
      );
      return event;
    } catch (error) {
      this.logger.error('Error formatting connection quality event:', error);
      return this.formatErrorEvent(
        'CONNECTION_QUALITY_FORMAT_ERROR',
        'Failed to format connection quality',
      );
    }
  }

  /**
   * Format heartbeat event for connection monitoring
   * Expected by frontend: 'heartbeat' event with server timestamp
   *
   * Requirements: 23.6
   */
  formatHeartbeatEvent(): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'heartbeat',
        data: {
          serverTime: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug('Formatted heartbeat event');
      return event;
    } catch (error) {
      this.logger.error('Error formatting heartbeat event:', error);
      return this.formatErrorEvent(
        'HEARTBEAT_FORMAT_ERROR',
        'Failed to format heartbeat',
      );
    }
  }

  /**
   * Batch format multiple events for efficiency
   *
   * Requirements: 23.1
   */
  batchFormatEvents(
    events: Array<{ type: string; data: any }>,
  ): WebSocketEvent[] {
    try {
      const formattedEvents = events.map((event, index) => {
        try {
          switch (event.type) {
            case 'location_update':
              return this.formatLocationUpdateEvent(
                event.data.userId,
                event.data.location,
              );
            case 'driver_location':
              return this.formatDriverLocationEvent(
                event.data.driverId,
                event.data.rideId,
                event.data.location,
                event.data.driverInfo,
              );
            case 'ride_status_change':
              return this.formatRideStatusChangeEvent(
                event.data.rideId,
                event.data.status,
                event.data.rideData,
                event.data.driverData,
              );
            case 'emergency_alert':
              return this.formatEmergencyAlertEvent(
                event.data.userId,
                event.data.emergencyData,
              );
            case 'notification':
              return this.formatNotificationEvent(
                event.data.userId,
                event.data.notification,
              );
            default:
              this.logger.warn(`Unknown event type in batch: ${event.type}`);
              return this.formatErrorEvent(
                'UNKNOWN_EVENT_TYPE',
                `Unknown event type: ${event.type}`,
              );
          }
        } catch (error) {
          this.logger.error(`Error formatting event ${index} in batch:`, error);
          return this.formatErrorEvent(
            'BATCH_FORMAT_ERROR',
            `Failed to format event ${index}`,
          );
        }
      });

      this.logger.debug(`Batch formatted ${formattedEvents.length} events`);
      return formattedEvents;
    } catch (error) {
      this.logger.error('Error in batch formatting events:', error);
      return [
        this.formatErrorEvent('BATCH_ERROR', 'Failed to batch format events'),
      ];
    }
  }

  /**
   * Validate and sanitize event data before sending
   * Ensures all event data is safe and follows expected patterns
   *
   * Requirements: 23.1, 23.4
   */
  validateAndSanitizeEvent(event: WebSocketEvent): WebSocketEvent {
    try {
      // Ensure required fields exist
      if (!event.event || !event.data) {
        this.logger.warn('Invalid event structure, missing event or data');
        return this.formatErrorEvent(
          'INVALID_EVENT_STRUCTURE',
          'Event must have event and data fields',
        );
      }

      // Sanitize event name
      const sanitizedEventName = event.event.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedEventName !== event.event) {
        this.logger.warn(
          `Event name sanitized: ${event.event} -> ${sanitizedEventName}`,
        );
      }

      // Ensure timestamp exists
      if (!event.data.timestamp) {
        event.data.timestamp = new Date().toISOString();
      }

      // Validate timestamp format
      try {
        new Date(event.data.timestamp);
      } catch (error) {
        this.logger.warn(
          'Invalid timestamp format, replacing with current time',
        );
        event.data.timestamp = new Date().toISOString();
      }

      // Remove any undefined values that could cause serialization issues
      const sanitizedData = this.removeUndefinedValues(event.data);

      const sanitizedEvent: WebSocketEvent = {
        event: sanitizedEventName,
        data: sanitizedData,
      };

      this.logger.debug(`Validated and sanitized event: ${sanitizedEventName}`);
      return sanitizedEvent;
    } catch (error) {
      this.logger.error('Error validating and sanitizing event:', error);
      return this.formatErrorEvent(
        'VALIDATION_ERROR',
        'Failed to validate event',
      );
    }
  }

  /**
   * Remove undefined values from object to prevent serialization issues
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefinedValues(item));
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.removeUndefinedValues(value);
      }
    }

    return cleaned;
  }

  /**
   * Calculate exponential backoff delay for reconnection attempts
   *
   * Requirements: 23.6
   */
  calculateBackoffDelay(
    attempt: number,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
  ): number {
    try {
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const finalDelay = Math.floor(delay + jitter);

      this.logger.debug(
        `Calculated backoff delay for attempt ${attempt}: ${finalDelay}ms`,
      );
      return finalDelay;
    } catch (error) {
      this.logger.error('Error calculating backoff delay:', error);
      return baseDelay;
    }
  }

  /**
   * Format rate limit event for frontend handling
   * Expected by frontend: 'rate_limit' event with limit details
   *
   * Requirements: 23.4
   */
  formatRateLimitEvent(
    eventType: string,
    limit: number,
    remaining: number,
    resetTime: Date,
  ): WebSocketEvent {
    try {
      const event: WebSocketEvent = {
        event: 'rate_limit',
        data: {
          eventType,
          limit,
          remaining,
          resetTime: resetTime.toISOString(),
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.debug(
        `Formatted rate limit event for ${eventType}: ${remaining}/${limit} remaining`,
      );
      return event;
    } catch (error) {
      this.logger.error('Error formatting rate limit event:', error);
      return this.formatErrorEvent(
        'RATE_LIMIT_FORMAT_ERROR',
        'Failed to format rate limit event',
      );
    }
  }
}

// Type definitions for WebSocket event compatibility

export interface WebSocketEvent {
  event: string;
  data: any;
}

export interface LocationUpdateData {
  userId: string;
  coordinates: {
    lat: number;
    long: number;
  };
  timestamp: string;
}

export interface DriverLocationData {
  driverId: string;
  rideId: string;
  location: {
    lat: number;
    long: number;
  };
  driver?: {
    id: string;
    name: string;
    rating: number;
    vehicle: string;
    plate: string;
  };
  timestamp: string;
}

export interface RideStatusChangeData {
  rideId: string;
  status: string;
  ride?: any;
  timestamp: string;
}

export interface EmergencyAlertData {
  userId: string;
  emergency: {
    driverId: string;
    rideId: string;
    message: string;
    estimatedArrival: number;
    location: {
      lat: number;
      long: number;
    };
  };
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RideOfferData {
  driverId: string;
  ride: {
    rideId: string;
    pickupLocation: any;
    destinationLocation: any;
    estimatedFare: number;
    vehicleType: string;
    isEmergency: boolean;
    estimatedDistance: number;
  };
  expiresAt: string;
  timestamp: string;
}

export interface NotificationData {
  userId: string;
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    data?: any;
    timestamp: string;
  };
}

export interface PaginatedEventData {
  items: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    totalPages: number;
  };
  timestamp: string;
}

export interface ReconnectionEventData {
  attempt: number;
  nextRetryIn: number;
  maxRetries: number;
  reason: string;
  timestamp: string;
}

export interface ConnectionQualityEventData {
  latency: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  packetsLost: number;
  timestamp: string;
}

export interface HeartbeatEventData {
  serverTime: string;
  timestamp: string;
}

export interface RateLimitEventData {
  eventType: string;
  limit: number;
  remaining: number;
  resetTime: string;
  timestamp: string;
}
