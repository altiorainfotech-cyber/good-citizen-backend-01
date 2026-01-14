/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable, Logger } from '@nestjs/common';

export interface EnumMappingConfig {
  legacyValue: string;
  newValue: string;
  deprecated?: boolean;
  migrationDate?: string;
}

/**
 * Service to handle enum mapping for status transitions and backward compatibility
 * Requirements: 19.6, 19.7 - Create enum mapping for status transitions
 */
@Injectable()
export class EnumMappingService {
  private readonly logger = new Logger(EnumMappingService.name);

  // Ride status mappings
  private readonly rideStatusMappings: EnumMappingConfig[] = [
    { legacyValue: 'PENDING', newValue: 'REQUESTED' },
    { legacyValue: 'ACCEPTED', newValue: 'DRIVER_ASSIGNED' },
    { legacyValue: 'STARTED', newValue: 'IN_PROGRESS' },
    { legacyValue: 'COMPLETED', newValue: 'COMPLETED' },
    { legacyValue: 'CANCELLED', newValue: 'CANCELLED' },
    { legacyValue: 'DRIVER_ARRIVING', newValue: 'DRIVER_ARRIVING' },
    { legacyValue: 'DRIVER_ARRIVED', newValue: 'DRIVER_ARRIVED' },
    // Reverse mappings for backward compatibility
    { legacyValue: 'REQUESTED', newValue: 'PENDING' },
    { legacyValue: 'DRIVER_ASSIGNED', newValue: 'ACCEPTED' },
    { legacyValue: 'IN_PROGRESS', newValue: 'STARTED' },
  ];

  // Vehicle type mappings
  private readonly vehicleTypeMappings: EnumMappingConfig[] = [
    { legacyValue: 'AMBULANCE', newValue: 'EMERGENCY' },
    { legacyValue: 'CAR', newValue: 'REGULAR' },
    { legacyValue: 'BIKE', newValue: 'REGULAR' },
    { legacyValue: 'AUTO', newValue: 'REGULAR' },
    // Reverse mappings
    { legacyValue: 'EMERGENCY', newValue: 'AMBULANCE' },
    { legacyValue: 'REGULAR', newValue: 'CAR' },
  ];

  // User role mappings
  private readonly userRoleMappings: EnumMappingConfig[] = [
    { legacyValue: 'CUSTOMER', newValue: 'USER' },
    { legacyValue: 'AMBULANCE_DRIVER', newValue: 'DRIVER' },
    { legacyValue: 'ADMIN', newValue: 'ADMIN' },
    // Reverse mappings
    { legacyValue: 'USER', newValue: 'CUSTOMER' },
    { legacyValue: 'DRIVER', newValue: 'AMBULANCE_DRIVER' },
  ];

  // Device type mappings
  private readonly deviceTypeMappings: EnumMappingConfig[] = [
    { legacyValue: 'MOBILE', newValue: 'ANDROID' },
    { legacyValue: 'IPHONE', newValue: 'IOS' },
    { legacyValue: 'WEB', newValue: 'WEB' },
    // Reverse mappings
    { legacyValue: 'ANDROID', newValue: 'MOBILE' },
    { legacyValue: 'IOS', newValue: 'IPHONE' },
  ];

  // Driver approval status mappings
  private readonly approvalStatusMappings: EnumMappingConfig[] = [
    { legacyValue: 'WAITING', newValue: 'PENDING' },
    { legacyValue: 'VERIFIED', newValue: 'APPROVED' },
    { legacyValue: 'DECLINED', newValue: 'REJECTED' },
    // Reverse mappings
    { legacyValue: 'PENDING', newValue: 'WAITING' },
    { legacyValue: 'APPROVED', newValue: 'VERIFIED' },
    { legacyValue: 'REJECTED', newValue: 'DECLINED' },
  ];

  /**
   * Map ride status from legacy to new format
   * Requirements: 19.6 - Map existing statuses to new values correctly
   */
  mapRideStatus(status: string, toLegacy: boolean = false): string {
    return this.mapEnum(
      status,
      this.rideStatusMappings,
      toLegacy,
      'ride status',
    );
  }

  /**
   * Map vehicle type from legacy to new format
   * Requirements: 19.7 - Ensure existing ride functionality remains unaffected
   */
  mapVehicleType(vehicleType: string, toLegacy: boolean = false): string {
    return this.mapEnum(
      vehicleType,
      this.vehicleTypeMappings,
      toLegacy,
      'vehicle type',
    );
  }

  /**
   * Map user role from legacy to new format
   */
  mapUserRole(role: string, toLegacy: boolean = false): string {
    return this.mapEnum(role, this.userRoleMappings, toLegacy, 'user role');
  }

  /**
   * Map device type from legacy to new format
   */
  mapDeviceType(deviceType: string, toLegacy: boolean = false): string {
    return this.mapEnum(
      deviceType,
      this.deviceTypeMappings,
      toLegacy,
      'device type',
    );
  }

  /**
   * Map approval status from legacy to new format
   */
  mapApprovalStatus(status: string, toLegacy: boolean = false): string {
    return this.mapEnum(
      status,
      this.approvalStatusMappings,
      toLegacy,
      'approval status',
    );
  }

  /**
   * Generic enum mapping function
   */
  private mapEnum(
    value: string,
    mappings: EnumMappingConfig[],
    toLegacy: boolean,
    enumType: string,
  ): string {
    if (!value) return value;

    const mapping = mappings.find((m) =>
      toLegacy ? m.newValue === value : m.legacyValue === value,
    );

    if (mapping) {
      const mappedValue = toLegacy ? mapping.legacyValue : mapping.newValue;

      if (mapping.deprecated) {
        this.logger.warn(
          `Using deprecated ${enumType} mapping: ${value} -> ${mappedValue}. ` +
            `Migration recommended by ${mapping.migrationDate || 'end of year'}`,
        );
      }

      this.logger.debug(
        `Mapped ${enumType}: ${value} -> ${mappedValue} (toLegacy: ${toLegacy})`,
      );
      return mappedValue;
    }

    // If no mapping found, return original value
    this.logger.debug(
      `No mapping found for ${enumType}: ${value} (toLegacy: ${toLegacy})`,
    );
    return value;
  }

  /**
   * Batch map ride statuses for arrays
   */
  mapRideStatuses(statuses: string[], toLegacy: boolean = false): string[] {
    return statuses.map((status) => this.mapRideStatus(status, toLegacy));
  }

  /**
   * Map object properties containing enum values
   * Requirements: 19.6 - Map existing statuses to new values correctly
   */
  mapObjectEnums(obj: any, toLegacy: boolean = false): any {
    if (!obj || typeof obj !== 'object') return obj;

    const mapped = { ...obj };

    // Map ride status
    if (mapped.status) {
      mapped.status = this.mapRideStatus(mapped.status, toLegacy);
    }

    // Map vehicle type
    if (mapped.vehicle_type) {
      mapped.vehicle_type = this.mapVehicleType(mapped.vehicle_type, toLegacy);
    }

    // Map user role
    if (mapped.role) {
      mapped.role = this.mapUserRole(mapped.role, toLegacy);
    }

    // Map device type
    if (mapped.device_type) {
      mapped.device_type = this.mapDeviceType(mapped.device_type, toLegacy);
    }

    // Map approval status
    if (mapped.approval) {
      mapped.approval = this.mapApprovalStatus(mapped.approval, toLegacy);
    }

    // Recursively map nested objects
    Object.keys(mapped).forEach((key) => {
      if (typeof mapped[key] === 'object' && mapped[key] !== null) {
        if (Array.isArray(mapped[key])) {
          mapped[key] = mapped[key].map((item: any) =>
            typeof item === 'object'
              ? this.mapObjectEnums(item, toLegacy)
              : item,
          );
        } else {
          mapped[key] = this.mapObjectEnums(mapped[key], toLegacy);
        }
      }
    });

    return mapped;
  }

  /**
   * Get all available mappings for a specific enum type
   */
  getAvailableMappings(
    enumType:
      | 'ride_status'
      | 'vehicle_type'
      | 'user_role'
      | 'device_type'
      | 'approval_status',
  ): EnumMappingConfig[] {
    switch (enumType) {
      case 'ride_status':
        return [...this.rideStatusMappings];
      case 'vehicle_type':
        return [...this.vehicleTypeMappings];
      case 'user_role':
        return [...this.userRoleMappings];
      case 'device_type':
        return [...this.deviceTypeMappings];
      case 'approval_status':
        return [...this.approvalStatusMappings];
      default:
        return [];
    }
  }

  /**
   * Validate if a value is a valid enum value (legacy or new)
   */
  isValidEnumValue(
    value: string,
    enumType:
      | 'ride_status'
      | 'vehicle_type'
      | 'user_role'
      | 'device_type'
      | 'approval_status',
  ): boolean {
    const mappings = this.getAvailableMappings(enumType);
    return mappings.some(
      (m) => m.legacyValue === value || m.newValue === value,
    );
  }

  /**
   * Get migration recommendations for deprecated enum values
   */
  getMigrationRecommendations(): {
    enumType: string;
    recommendations: any[];
  }[] {
    const recommendations: { enumType: string; recommendations: any[] }[] = [];

    const enumTypes = [
      'ride_status',
      'vehicle_type',
      'user_role',
      'device_type',
      'approval_status',
    ] as const;

    for (const enumType of enumTypes) {
      const mappings = this.getAvailableMappings(enumType);
      const deprecated = mappings.filter((m) => m.deprecated);

      if (deprecated.length > 0) {
        recommendations.push({
          enumType,
          recommendations: deprecated.map((d) => ({
            legacyValue: d.legacyValue,
            recommendedValue: d.newValue,
            migrationDate: d.migrationDate,
          })),
        });
      }
    }

    return recommendations;
  }
}
