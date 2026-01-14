/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { Injectable, Logger } from '@nestjs/common';
import { RideStatus } from './utils';

/**
 * Frontend Integration Service
 *
 * This service formats backend API responses to match the exact data structures
 * expected by the Redux slices in both the user app and partner app.
 *
 * It ensures seamless integration between backend and frontend without requiring
 * data transformation on the frontend side.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.5
 */
@Injectable()
export class FrontendIntegrationService {
  private readonly logger = new Logger(FrontendIntegrationService.name);

  /**
   * Format authentication response for Redux authSlice compatibility
   *
   * Expected authSlice structure:
   * - user: User object with specific fields
   * - token: JWT access token
   * - userType: 'user' | 'ambulance_driver'
   * - isAuthenticated: boolean
   * - isVerified: boolean
   *
   * Requirements: 21.1, 21.2
   */
  formatAuthResponse(user: any, tokens: any): AuthSliceResponse {
    try {
      const response: AuthSliceResponse = {
        user: {
          _id: user._id?.toString() || user.id?.toString() || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          phone_number: user.phone_number || '',
          role: user.role || 'USER',
          loyalty_points: this.safeNumber(user.loyalty_points) || 0,
        },
        token: tokens.access_token || '',
        userType: user.role === 'DRIVER' ? 'ambulance_driver' : 'user',
        isAuthenticated: true,
        isVerified: Boolean(user.is_email_verified),
      };

      this.logger.debug(
        `Formatted auth response for user ${response.user._id}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error formatting auth response:', error);
      throw new Error('Failed to format authentication response');
    }
  }

  /**
   * Format ride response for Redux rideSlice compatibility
   *
   * Expected rideSlice structure:
   * - currentRide: Ride object with specific fields
   * - rideStatus: Status string
   * - driver: Driver object (optional)
   * - pickupLocation: Location object
   * - destinationLocation: Location object
   * - estimatedFare: number
   *
   * Requirements: 21.2, 21.3
   */
  formatRideResponse(ride: any, driver?: any): RideSliceResponse {
    try {
      const response: RideSliceResponse = {
        currentRide: {
          ride_id: ride._id?.toString() || ride.ride_id?.toString() || '',
          status: ride.status || 'requested',
          pickup_location: this.formatLocation(ride.pickup_location),
          destination_location: this.formatLocation(ride.destination_location),
          estimated_fare: this.safeNumber(ride.estimated_fare) || 0,
        },
        rideStatus: ride.status || 'requested',
        driver: driver ? this.formatDriverInfo(driver) : null,
        pickupLocation: this.formatLocation(ride.pickup_location),
        destinationLocation: this.formatLocation(ride.destination_location),
        estimatedFare: this.safeNumber(ride.estimated_fare) || 0,
      };

      this.logger.debug(
        `Formatted ride response for ride ${response.currentRide.ride_id}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error formatting ride response:', error);
      throw new Error('Failed to format ride response');
    }
  }

  /**
   * Format driver response for Redux driverSlice compatibility (Partner App)
   *
   * Expected driverSlice structure:
   * - isOnline: boolean
   * - currentRide: Ride object (optional)
   * - rideStatus: Status string
   * - earnings: Earnings object
   * - stats: Statistics object
   *
   * Requirements: 21.6
   */
  formatDriverResponse(
    driver: any,
    currentRide?: any,
    earnings?: any,
    stats?: any,
  ): DriverSliceResponse {
    try {
      const response: DriverSliceResponse = {
        isOnline: Boolean(driver.is_online),
        currentRide: currentRide
          ? {
              ride_id:
                currentRide._id?.toString() ||
                currentRide.ride_id?.toString() ||
                '',
              pickup_location: this.formatLocation(currentRide.pickup_location),
              destination_location: this.formatLocation(
                currentRide.destination_location,
              ),
              status: currentRide.status || 'requested',
            }
          : null,
        rideStatus: this.mapRideStatusToDriverStatus(
          currentRide?.status || 'idle',
        ),
        earnings: {
          today: this.safeNumber(earnings?.today) || 0,
          total: this.safeNumber(earnings?.total) || 0,
        },
        stats: {
          totalRides:
            this.safeNumber(stats?.totalRides) ||
            this.safeNumber(driver.total_rides) ||
            0,
          rating:
            this.safeNumber(stats?.rating) ||
            this.safeNumber(driver.driver_rating) ||
            4.8,
          acceptanceRate: this.safeNumber(stats?.acceptanceRate) ?? 95,
        },
      };

      this.logger.debug(`Formatted driver response for driver ${driver._id}`);
      return response;
    } catch (error) {
      this.logger.error('Error formatting driver response:', error);
      throw new Error('Failed to format driver response');
    }
  }

  /**
   * Format ride history response for pagination compatibility
   *
   * Requirements: 21.2
   */
  formatRideHistoryResponse(
    rides: any[],
    total: number,
    page: number,
    limit: number,
  ): RideHistoryResponse {
    try {
      const response: RideHistoryResponse = {
        rides: rides.map((ride) => ({
          ride_id: ride._id?.toString() || ride.ride_id?.toString() || '',
          status: ride.status || 'completed',
          pickup_location: this.formatLocation(ride.pickup_location),
          destination_location: this.formatLocation(ride.destination_location),
          estimated_fare: this.safeNumber(ride.estimated_fare) || 0,
          final_fare: this.safeNumber(ride.final_fare),
          created_at: ride.created_at || new Date(),
          completed_at: ride.ride_completed_at || ride.completed_at,
        })),
        total: this.safeNumber(total) || 0,
        page: this.safeNumber(page) || 1,
        limit: this.safeNumber(limit) || 20,
        hasMore: page * limit < total,
      };

      this.logger.debug(
        `Formatted ride history response with ${response.rides.length} rides`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error formatting ride history response:', error);
      throw new Error('Failed to format ride history response');
    }
  }

  /**
   * Format error response for frontend error handling compatibility
   *
   * Requirements: 21.5, 24.5
   */
  formatErrorResponse(error: any, path: string): StandardErrorResponse {
    try {
      const response: StandardErrorResponse = {
        statusCode:
          this.safeNumber(error.status) ||
          this.safeNumber(error.statusCode) ||
          500,
        message: error.message || 'Internal server error',
        error: error.name || error.error || 'Error',
        timestamp: new Date().toISOString(),
        path: path || 'unknown',
      };

      this.logger.debug(
        `Formatted error response: ${response.statusCode} - ${response.message}`,
      );
      return response;
    } catch (formatError) {
      this.logger.error('Error formatting error response:', formatError);
      // Return a safe fallback error response
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Error',
        timestamp: new Date().toISOString(),
        path: path || 'unknown',
      };
    }
  }

  /**
   * Validate navigation data for custom navigation system compatibility
   */
  validateNavigationData(screenName: string, params: any): NavigationParams {
    // Ensure params are serializable for React Navigation
    const serializedParams = this.serializeNavigationParams(params);

    return {
      screenName,
      params: serializedParams,
    };
  }

  /**
   * Map backend ride status to frontend driver status expectations
   */
  private mapRideStatusToDriverStatus(
    status: string,
  ):
    | 'idle'
    | 'request_received'
    | 'accepted'
    | 'picked_up'
    | 'in_progress'
    | 'completed' {
    const statusMap: Record<
      string,
      | 'idle'
      | 'request_received'
      | 'accepted'
      | 'picked_up'
      | 'in_progress'
      | 'completed'
    > = {
      idle: 'idle',
      requested: 'request_received',
      driver_assigned: 'accepted',
      driver_arriving: 'accepted',
      driver_arrived: 'picked_up',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'idle',
    };

    return statusMap[status] || 'idle';
  }

  /**
   * Serialize navigation parameters to ensure React Navigation compatibility
   */
  private serializeNavigationParams(params: any): Record<string, any> {
    if (!params) return {};

    // Remove non-serializable values and ensure compatibility
    const serialized: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (this.isSerializable(value)) {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Check if a value is serializable for navigation
   */
  private isSerializable(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return true;
    if (Array.isArray(value))
      return value.every((item) => this.isSerializable(item));
    if (typeof value === 'object') {
      return Object.values(value).every((val) => this.isSerializable(val));
    }
    return false;
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
   * Format location object with validation
   */
  private formatLocation(location: any): LocationDto {
    if (!location) {
      return { latitude: 0, longitude: 0, address: '' };
    }

    return {
      latitude:
        this.safeNumber(location.latitude) ||
        this.safeNumber(location.lat) ||
        0,
      longitude:
        this.safeNumber(location.longitude) ||
        this.safeNumber(location.long) ||
        this.safeNumber(location.lng) ||
        0,
      address: location.address || location.formatted_address || '',
    };
  }

  /**
   * Format driver information for ride responses
   */
  private formatDriverInfo(driver: any): DriverInfo {
    return {
      driver_id: driver._id?.toString() || driver.driver_id?.toString() || '',
      name:
        `${driver.first_name || ''} ${driver.last_name || ''}`.trim() ||
        'Unknown Driver',
      rating: this.safeNumber(driver.driver_rating) || 4.8,
      vehicle: driver.vehicle_type || 'Unknown',
      plate: driver.vehicle_plate || 'N/A',
      phone: driver.phone_number || '',
      current_location: this.formatDriverLocation(driver),
    };
  }

  /**
   * Format driver location from various possible formats
   */
  private formatDriverLocation(driver: any): LocationDto {
    // Handle MongoDB geospatial format
    if (driver.location && driver.location.coordinates) {
      return {
        latitude: this.safeNumber(driver.location.coordinates[1]) || 0,
        longitude: this.safeNumber(driver.location.coordinates[0]) || 0,
      };
    }

    // Handle direct latitude/longitude fields
    if (driver.latitude !== undefined && driver.longitude !== undefined) {
      return {
        latitude: this.safeNumber(driver.latitude) || 0,
        longitude: this.safeNumber(driver.longitude) || 0,
      };
    }

    // Handle current_location object
    if (driver.current_location) {
      return this.formatLocation(driver.current_location);
    }

    // Default fallback
    return { latitude: 0, longitude: 0 };
  }

  /**
   * Transform data for specific frontend components
   */
  transformForComponent(componentType: string, data: any): any {
    try {
      switch (componentType) {
        case 'ride-card':
          return this.transformRideCardData(data);
        case 'driver-card':
          return this.transformDriverCardData(data);
        case 'location-picker':
          return this.transformLocationPickerData(data);
        case 'fare-breakdown':
          return this.transformFareBreakdownData(data);
        default:
          this.logger.warn(`Unknown component type: ${componentType}`);
          return data;
      }
    } catch (error) {
      this.logger.error(
        `Error transforming data for component ${componentType}:`,
        error,
      );
      return data;
    }
  }

  /**
   * Transform ride data for ride card component
   */
  private transformRideCardData(ride: any): any {
    return {
      id: ride._id?.toString() || ride.ride_id?.toString() || '',
      status: ride.status || 'unknown',
      pickup: this.formatLocation(ride.pickup_location),
      destination: this.formatLocation(ride.destination_location),
      fare:
        this.safeNumber(ride.final_fare) ||
        this.safeNumber(ride.estimated_fare) ||
        0,
      date: ride.created_at || new Date(),
      duration: this.calculateDuration(
        ride.ride_started_at,
        ride.ride_completed_at,
      ),
    };
  }

  /**
   * Transform driver data for driver card component
   */
  private transformDriverCardData(driver: any): any {
    return {
      id: driver._id?.toString() || driver.driver_id?.toString() || '',
      name:
        `${driver.first_name || ''} ${driver.last_name || ''}`.trim() ||
        'Unknown Driver',
      rating: this.safeNumber(driver.driver_rating) || 4.8,
      vehicle: {
        type: driver.vehicle_type || 'Unknown',
        plate: driver.vehicle_plate || 'N/A',
      },
      location: this.formatDriverLocation(driver),
      isOnline: Boolean(driver.is_online),
    };
  }

  /**
   * Transform location data for location picker component
   */
  private transformLocationPickerData(location: any): any {
    const formatted = this.formatLocation(location);
    return {
      ...formatted,
      displayName:
        location.address ||
        location.formatted_address ||
        `${formatted.latitude}, ${formatted.longitude}`,
      placeId: location.place_id || null,
    };
  }

  /**
   * Transform fare data for fare breakdown component
   */
  private transformFareBreakdownData(fare: any): any {
    const baseFare = this.safeNumber(fare.base_fare) || 0;
    const distanceFare = this.safeNumber(fare.distance_fare) || 0;
    const timeFare = this.safeNumber(fare.time_fare) || 0;
    const surgeFare = this.safeNumber(fare.surge_fare) || 0;
    const total =
      this.safeNumber(fare.total) ||
      baseFare + distanceFare + timeFare + surgeFare;

    return {
      baseFare,
      distanceFare,
      timeFare,
      surgeFare,
      total,
      currency: fare.currency || 'USD',
      breakdown: [
        { label: 'Base Fare', amount: baseFare },
        { label: 'Distance', amount: distanceFare },
        { label: 'Time', amount: timeFare },
        ...(surgeFare > 0 ? [{ label: 'Surge', amount: surgeFare }] : []),
      ],
    };
  }

  /**
   * Calculate ride duration in minutes
   */
  private calculateDuration(startTime: any, endTime: any): number | null {
    if (!startTime || !endTime) return null;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  /**
   * Batch format multiple responses for efficiency
   */
  batchFormatResponses(
    items: any[],
    formatType: 'auth' | 'ride' | 'driver',
    additionalData?: any,
  ): any[] {
    try {
      return items.map((item, index) => {
        switch (formatType) {
          case 'auth':
            return this.formatAuthResponse(item, additionalData?.[index] || {});
          case 'ride':
            return this.formatRideResponse(item, additionalData?.[index]);
          case 'driver':
            return this.formatDriverResponse(
              item,
              additionalData?.[index]?.currentRide,
              additionalData?.[index]?.earnings,
              additionalData?.[index]?.stats,
            );
          default:
            return item;
        }
      });
    } catch (error) {
      this.logger.error(
        `Error batch formatting ${formatType} responses:`,
        error,
      );
      throw new Error(`Failed to batch format ${formatType} responses`);
    }
  }
}

// Type definitions for frontend compatibility

export interface AuthSliceResponse {
  user: {
    _id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    role: string;
    loyalty_points: number;
  };
  token: string;
  userType: 'user' | 'ambulance_driver';
  isAuthenticated: boolean;
  isVerified: boolean;
}

export interface RideSliceResponse {
  currentRide: {
    ride_id: string;
    status: RideStatus;
    pickup_location: LocationDto;
    destination_location: LocationDto;
    estimated_fare: number;
  };
  rideStatus: RideStatus;
  driver?: {
    driver_id: string;
    name: string;
    rating: number;
    vehicle: string;
    plate: string;
    phone: string;
    current_location: LocationDto;
  } | null;
  pickupLocation: LocationDto;
  destinationLocation: LocationDto;
  estimatedFare: number;
}

export interface DriverSliceResponse {
  isOnline: boolean;
  currentRide?: {
    ride_id: string;
    pickup_location: LocationDto;
    destination_location: LocationDto;
    status: RideStatus;
  } | null;
  rideStatus:
    | 'idle'
    | 'request_received'
    | 'accepted'
    | 'picked_up'
    | 'in_progress'
    | 'completed';
  earnings: {
    today: number;
    total: number;
  };
  stats: {
    totalRides: number;
    rating: number;
    acceptanceRate: number;
  };
}

export interface RideHistoryResponse {
  rides: Array<{
    ride_id: string;
    status: RideStatus;
    pickup_location: LocationDto;
    destination_location: LocationDto;
    estimated_fare: number;
    final_fare?: number | null;
    created_at: Date;
    completed_at?: Date | null;
  }>;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NavigationParams {
  screenName: string;
  params?: {
    [key: string]: any;
  };
}

export interface StandardErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface LocationDto {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface DriverInfo {
  driver_id: string;
  name: string;
  rating: number;
  vehicle: string;
  plate: string;
  phone: string;
  current_location: LocationDto;
}
