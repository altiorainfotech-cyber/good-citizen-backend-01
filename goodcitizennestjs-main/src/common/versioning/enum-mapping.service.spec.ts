/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { EnumMappingService } from './enum-mapping.service';

describe('EnumMappingService', () => {
  let service: EnumMappingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnumMappingService],
    }).compile();

    service = module.get<EnumMappingService>(EnumMappingService);
  });

  describe('mapRideStatus', () => {
    it('should map legacy ride status to new format', () => {
      expect(service.mapRideStatus('PENDING')).toBe('REQUESTED');
      expect(service.mapRideStatus('ACCEPTED')).toBe('DRIVER_ASSIGNED');
      expect(service.mapRideStatus('STARTED')).toBe('IN_PROGRESS');
      expect(service.mapRideStatus('COMPLETED')).toBe('COMPLETED');
      expect(service.mapRideStatus('CANCELLED')).toBe('CANCELLED');
    });

    it('should map new ride status to legacy format', () => {
      expect(service.mapRideStatus('REQUESTED', true)).toBe('PENDING');
      expect(service.mapRideStatus('DRIVER_ASSIGNED', true)).toBe('ACCEPTED');
      expect(service.mapRideStatus('IN_PROGRESS', true)).toBe('STARTED');
      expect(service.mapRideStatus('COMPLETED', true)).toBe('COMPLETED');
      expect(service.mapRideStatus('CANCELLED', true)).toBe('CANCELLED');
    });

    it('should return original value if no mapping found', () => {
      expect(service.mapRideStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
      expect(service.mapRideStatus('UNKNOWN_STATUS', true)).toBe(
        'UNKNOWN_STATUS',
      );
    });

    it('should handle empty or null values', () => {
      expect(service.mapRideStatus('')).toBe('');
      expect(service.mapRideStatus(null as any)).toBe(null);
      expect(service.mapRideStatus(undefined as any)).toBe(undefined);
    });
  });

  describe('mapVehicleType', () => {
    it('should map legacy vehicle type to new format', () => {
      expect(service.mapVehicleType('AMBULANCE')).toBe('EMERGENCY');
      expect(service.mapVehicleType('CAR')).toBe('REGULAR');
      expect(service.mapVehicleType('BIKE')).toBe('REGULAR');
      expect(service.mapVehicleType('AUTO')).toBe('REGULAR');
    });

    it('should map new vehicle type to legacy format', () => {
      expect(service.mapVehicleType('EMERGENCY', true)).toBe('AMBULANCE');
      expect(service.mapVehicleType('REGULAR', true)).toBe('CAR');
    });
  });

  describe('mapUserRole', () => {
    it('should map legacy user role to new format', () => {
      expect(service.mapUserRole('CUSTOMER')).toBe('USER');
      expect(service.mapUserRole('AMBULANCE_DRIVER')).toBe('DRIVER');
      expect(service.mapUserRole('ADMIN')).toBe('ADMIN');
    });

    it('should map new user role to legacy format', () => {
      expect(service.mapUserRole('USER', true)).toBe('CUSTOMER');
      expect(service.mapUserRole('DRIVER', true)).toBe('AMBULANCE_DRIVER');
      expect(service.mapUserRole('ADMIN', true)).toBe('ADMIN');
    });
  });

  describe('mapDeviceType', () => {
    it('should map legacy device type to new format', () => {
      expect(service.mapDeviceType('MOBILE')).toBe('ANDROID');
      expect(service.mapDeviceType('IPHONE')).toBe('IOS');
      expect(service.mapDeviceType('WEB')).toBe('WEB');
    });

    it('should map new device type to legacy format', () => {
      expect(service.mapDeviceType('ANDROID', true)).toBe('MOBILE');
      expect(service.mapDeviceType('IOS', true)).toBe('IPHONE');
      expect(service.mapDeviceType('WEB', true)).toBe('WEB');
    });
  });

  describe('mapApprovalStatus', () => {
    it('should map legacy approval status to new format', () => {
      expect(service.mapApprovalStatus('WAITING')).toBe('PENDING');
      expect(service.mapApprovalStatus('VERIFIED')).toBe('APPROVED');
      expect(service.mapApprovalStatus('DECLINED')).toBe('REJECTED');
    });

    it('should map new approval status to legacy format', () => {
      expect(service.mapApprovalStatus('PENDING', true)).toBe('WAITING');
      expect(service.mapApprovalStatus('APPROVED', true)).toBe('VERIFIED');
      expect(service.mapApprovalStatus('REJECTED', true)).toBe('DECLINED');
    });
  });

  describe('mapRideStatuses', () => {
    it('should map array of ride statuses', () => {
      const legacyStatuses = ['PENDING', 'ACCEPTED', 'STARTED'];
      const expectedNewStatuses = [
        'REQUESTED',
        'DRIVER_ASSIGNED',
        'IN_PROGRESS',
      ];

      expect(service.mapRideStatuses(legacyStatuses)).toEqual(
        expectedNewStatuses,
      );
    });

    it('should map array of ride statuses to legacy format', () => {
      const newStatuses = ['REQUESTED', 'DRIVER_ASSIGNED', 'IN_PROGRESS'];
      const expectedLegacyStatuses = ['PENDING', 'ACCEPTED', 'STARTED'];

      expect(service.mapRideStatuses(newStatuses, true)).toEqual(
        expectedLegacyStatuses,
      );
    });
  });

  describe('mapObjectEnums', () => {
    it('should map enum values in object properties', () => {
      const inputObject = {
        status: 'PENDING',
        vehicle_type: 'AMBULANCE',
        role: 'CUSTOMER',
        device_type: 'MOBILE',
        approval: 'WAITING',
        other_field: 'unchanged',
      };

      const expectedOutput = {
        status: 'REQUESTED',
        vehicle_type: 'EMERGENCY',
        role: 'USER',
        device_type: 'ANDROID',
        approval: 'PENDING',
        other_field: 'unchanged',
      };

      expect(service.mapObjectEnums(inputObject)).toEqual(expectedOutput);
    });

    it('should map enum values in nested objects', () => {
      const inputObject = {
        ride: {
          status: 'PENDING',
          vehicle_type: 'AMBULANCE',
        },
        user: {
          role: 'CUSTOMER',
        },
      };

      const expectedOutput = {
        ride: {
          status: 'REQUESTED',
          vehicle_type: 'EMERGENCY',
        },
        user: {
          role: 'USER',
        },
      };

      expect(service.mapObjectEnums(inputObject)).toEqual(expectedOutput);
    });

    it('should map enum values in arrays', () => {
      const inputObject = {
        rides: [
          { status: 'PENDING', vehicle_type: 'AMBULANCE' },
          { status: 'ACCEPTED', vehicle_type: 'CAR' },
        ],
      };

      const expectedOutput = {
        rides: [
          { status: 'REQUESTED', vehicle_type: 'EMERGENCY' },
          { status: 'DRIVER_ASSIGNED', vehicle_type: 'REGULAR' },
        ],
      };

      expect(service.mapObjectEnums(inputObject)).toEqual(expectedOutput);
    });

    it('should handle null and undefined objects', () => {
      expect(service.mapObjectEnums(null)).toBe(null);
      expect(service.mapObjectEnums(undefined)).toBe(undefined);
      expect(service.mapObjectEnums('string')).toBe('string');
      expect(service.mapObjectEnums(123)).toBe(123);
    });

    it('should map to legacy format when toLegacy is true', () => {
      const inputObject = {
        status: 'REQUESTED',
        vehicle_type: 'EMERGENCY',
        role: 'USER',
      };

      const expectedOutput = {
        status: 'PENDING',
        vehicle_type: 'AMBULANCE',
        role: 'CUSTOMER',
      };

      expect(service.mapObjectEnums(inputObject, true)).toEqual(expectedOutput);
    });
  });

  describe('getAvailableMappings', () => {
    it('should return ride status mappings', () => {
      const mappings = service.getAvailableMappings('ride_status');
      expect(mappings).toBeInstanceOf(Array);
      expect(mappings.length).toBeGreaterThan(0);
      expect(mappings[0]).toHaveProperty('legacyValue');
      expect(mappings[0]).toHaveProperty('newValue');
    });

    it('should return empty array for unknown enum type', () => {
      const mappings = service.getAvailableMappings('unknown_type' as any);
      expect(mappings).toEqual([]);
    });
  });

  describe('isValidEnumValue', () => {
    it('should validate ride status values', () => {
      expect(service.isValidEnumValue('PENDING', 'ride_status')).toBe(true);
      expect(service.isValidEnumValue('REQUESTED', 'ride_status')).toBe(true);
      expect(service.isValidEnumValue('INVALID_STATUS', 'ride_status')).toBe(
        false,
      );
    });

    it('should validate vehicle type values', () => {
      expect(service.isValidEnumValue('AMBULANCE', 'vehicle_type')).toBe(true);
      expect(service.isValidEnumValue('EMERGENCY', 'vehicle_type')).toBe(true);
      expect(service.isValidEnumValue('INVALID_TYPE', 'vehicle_type')).toBe(
        false,
      );
    });
  });

  describe('getMigrationRecommendations', () => {
    it('should return migration recommendations', () => {
      const recommendations = service.getMigrationRecommendations();
      expect(recommendations).toBeInstanceOf(Array);
      // Since we don't have deprecated values in our test setup, this might be empty
      // but the structure should be correct
      recommendations.forEach((rec) => {
        expect(rec).toHaveProperty('enumType');
        expect(rec).toHaveProperty('recommendations');
        expect(rec.recommendations).toBeInstanceOf(Array);
      });
    });
  });
});
