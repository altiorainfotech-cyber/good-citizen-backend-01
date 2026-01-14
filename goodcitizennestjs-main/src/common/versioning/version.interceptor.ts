/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  API_VERSION_KEY,
  DEFAULT_API_VERSION,
  ApiVersions,
} from './api-version.decorator';

export interface VersionedResponse<T = any> {
  data: T;
  version: string;
  deprecated?: boolean;
  migration_info?: {
    current_version: string;
    recommended_version: string;
    deprecation_date?: string;
    migration_guide?: string;
  };
}

/**
 * Interceptor to handle API versioning and backward compatibility
 * Requirements: 19.3 - API versioning for mobile app compatibility
 */
@Injectable()
export class VersionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(VersionInterceptor.name);

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get API version from various sources
    const requestedVersion = this.extractVersion(request);
    const controllerVersion = this.reflector.get<string>(
      API_VERSION_KEY,
      context.getClass(),
    );
    const handlerVersion = this.reflector.get<string>(
      API_VERSION_KEY,
      context.getHandler(),
    );

    // Determine effective version
    const effectiveVersion =
      handlerVersion || controllerVersion || DEFAULT_API_VERSION;

    // Set version headers
    response.setHeader('X-API-Version', effectiveVersion);
    response.setHeader('X-Requested-Version', requestedVersion);

    // Log version usage for monitoring
    this.logger.debug(
      `API call: ${request.method} ${request.url} - Requested: ${requestedVersion}, Effective: ${effectiveVersion}`,
    );

    return next.handle().pipe(
      map((data) => {
        // Transform response based on version compatibility
        return this.transformResponse(data, requestedVersion, effectiveVersion);
      }),
    );
  }

  /**
   * Extract API version from request
   */
  private extractVersion(request: any): string {
    // Check various sources for version information
    const headerVersion =
      request.headers['x-api-version'] || request.headers['api-version'];
    const queryVersion = request.query.version || request.query.api_version;
    const pathVersion = this.extractVersionFromPath(request.url);

    return headerVersion || queryVersion || pathVersion || DEFAULT_API_VERSION;
  }

  /**
   * Extract version from URL path (e.g., /api/v1/users)
   */
  private extractVersionFromPath(url: string): string | null {
    const versionMatch = url.match(/\/v(\d+(?:\.\d+)?)\//);
    return versionMatch?.[1] ?? null;
  }

  /**
   * Transform response based on version compatibility
   * Requirements: 19.5 - Handle existing sessions gracefully
   */
  private transformResponse(
    data: any,
    requestedVersion: string,
    effectiveVersion: string,
  ): any {
    // If versions match, return data as-is
    if (requestedVersion === effectiveVersion) {
      return data;
    }

    // Handle legacy version compatibility
    if (requestedVersion === ApiVersions.LEGACY || requestedVersion === '0.9') {
      return this.transformToLegacyFormat(data, effectiveVersion);
    }

    // Handle version-specific transformations
    const transformedData = this.applyVersionTransformations(
      data,
      requestedVersion,
      effectiveVersion,
    );

    // Wrap in versioned response format for newer versions
    if (this.shouldWrapResponse(requestedVersion)) {
      return this.wrapVersionedResponse(
        transformedData,
        requestedVersion,
        effectiveVersion,
      );
    }

    return transformedData;
  }

  /**
   * Transform response to legacy format for backward compatibility
   * Requirements: 19.5 - Handle existing sessions gracefully
   */
  private transformToLegacyFormat(data: any, effectiveVersion: string): any {
    if (!data) return data;

    // Handle authentication responses
    if (data.user && data.access_token) {
      return {
        success: true,
        user: {
          id: data.user._id || data.user.id,
          name: `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim(),
          email: data.user.email,
          phone: data.user.phone_number,
          role: data.user.role,
          verified: data.user.is_email_verified,
        },
        token: data.access_token,
        session: data.session_id,
      };
    }

    // Handle ride responses
    if (data.ride_id || data.currentRide) {
      const ride = data.currentRide || data;
      return {
        success: true,
        ride: {
          id: ride.ride_id || ride._id,
          status: this.mapRideStatusToLegacy(ride.status),
          pickup: ride.pickup_location,
          destination: ride.destination_location,
          fare: ride.estimated_fare || ride.final_fare,
          driver: ride.driver
            ? {
                id: ride.driver.driver_id || ride.driver._id,
                name: ride.driver.name,
                phone: ride.driver.phone,
                vehicle: ride.driver.vehicle,
                location: ride.driver.current_location,
              }
            : null,
        },
      };
    }

    // Handle driver responses
    if (data.isOnline !== undefined || data.currentRide !== undefined) {
      return {
        success: true,
        driver: {
          online: data.isOnline,
          ride: data.currentRide
            ? {
                id: data.currentRide.ride_id,
                status: this.mapRideStatusToLegacy(data.currentRide.status),
                pickup: data.currentRide.pickup_location,
                destination: data.currentRide.destination_location,
              }
            : null,
          earnings: data.earnings,
          stats: data.stats,
        },
      };
    }

    // Handle list responses
    if (Array.isArray(data)) {
      return {
        success: true,
        data: data,
        count: data.length,
      };
    }

    // Default legacy wrapper
    return {
      success: true,
      data: data,
    };
  }

  /**
   * Apply version-specific data transformations
   */
  private applyVersionTransformations(
    data: any,
    requestedVersion: string,
    effectiveVersion: string,
  ): any {
    if (!data) return data;

    // Version 1.0 to 2.0 transformations
    if (requestedVersion === '1.0' && effectiveVersion === '2.0') {
      return this.transformV2ToV1(data);
    }

    // Version 2.0 to 1.0 transformations
    if (requestedVersion === '2.0' && effectiveVersion === '1.0') {
      return this.transformV1ToV2(data);
    }

    return data;
  }

  /**
   * Transform V2 response to V1 format
   */
  private transformV2ToV1(data: any): any {
    if (!data) return data;

    // Handle new fields that don't exist in V1
    if (data.auth_provider) {
      delete data.auth_provider; // Remove Auth0 provider info for V1 clients
    }

    if (data.vehicle_type === 'EMERGENCY') {
      data.vehicle_type = 'AMBULANCE'; // Map new enum to old value
    }

    return data;
  }

  /**
   * Transform V1 response to V2 format
   */
  private transformV1ToV2(data: any): any {
    if (!data) return data;

    // Add new fields with default values for V2 clients
    if (data.user && !data.auth_provider) {
      data.auth_provider = 'local'; // Default for migrated users
    }

    if (data.vehicle_type === 'AMBULANCE') {
      data.vehicle_type = 'EMERGENCY'; // Map old enum to new value
    }

    return data;
  }

  /**
   * Map ride status to legacy format
   * Requirements: 19.6 - Map existing statuses to new values correctly
   */
  private mapRideStatusToLegacy(status: string): string {
    const statusMap: Record<string, string> = {
      REQUESTED: 'PENDING',
      DRIVER_ASSIGNED: 'ACCEPTED',
      DRIVER_ARRIVING: 'ACCEPTED',
      DRIVER_ARRIVED: 'ACCEPTED',
      IN_PROGRESS: 'STARTED',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    };

    return statusMap[status] || status;
  }

  /**
   * Check if response should be wrapped in versioned format
   */
  private shouldWrapResponse(requestedVersion: string): boolean {
    // Only wrap for newer API versions
    return (
      requestedVersion !== ApiVersions.LEGACY &&
      requestedVersion !== '0.9' &&
      requestedVersion !== '1.0'
    );
  }

  /**
   * Wrap response in versioned format with metadata
   */
  private wrapVersionedResponse(
    data: any,
    requestedVersion: string,
    effectiveVersion: string,
  ): VersionedResponse {
    const isDeprecated = this.isVersionDeprecated(requestedVersion);

    const response: VersionedResponse = {
      data,
      version: effectiveVersion,
    };

    if (isDeprecated) {
      response.deprecated = true;
      response.migration_info = {
        current_version: requestedVersion,
        recommended_version: ApiVersions.V2,
        deprecation_date: '2024-12-31',
        migration_guide: '/docs/api/migration-guide',
      };
    }

    return response;
  }

  /**
   * Check if a version is deprecated
   */
  private isVersionDeprecated(version: string): boolean {
    const deprecatedVersions = [ApiVersions.LEGACY, '0.9', '1.0'];
    return deprecatedVersions.includes(version);
  }
}
