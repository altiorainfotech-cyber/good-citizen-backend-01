/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator for GPS coordinates
 */
@ValidatorConstraint({ name: 'isValidGpsCoordinate', async: false })
export class IsValidGpsCoordinateConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'number') return false;

    const coordinateType = args.constraints?.[0];

    if (coordinateType === 'latitude') {
      return value >= -90 && value <= 90 && isFinite(value);
    }

    if (coordinateType === 'longitude') {
      return value >= -180 && value <= 180 && isFinite(value);
    }

    return false;
  }

  defaultMessage(args: ValidationArguments) {
    const coordinateType = args.constraints?.[0];
    if (coordinateType === 'latitude') {
      return 'Latitude must be a number between -90 and 90 degrees';
    }
    if (coordinateType === 'longitude') {
      return 'Longitude must be a number between -180 and 180 degrees';
    }
    return 'Invalid GPS coordinate';
  }
}

/**
 * Decorator for validating latitude
 */
export function IsValidLatitude(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: ['latitude'],
      validator: IsValidGpsCoordinateConstraint,
    });
  };
}

/**
 * Decorator for validating longitude
 */
export function IsValidLongitude(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: ['longitude'],
      validator: IsValidGpsCoordinateConstraint,
    });
  };
}

/**
 * Custom validator for phone numbers
 */
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint
  implements ValidatorConstraintInterface
{
  validate(phoneNumber: any, args: ValidationArguments) {
    if (typeof phoneNumber !== 'string') return false;

    // Basic phone number validation (10-15 digits, may include + and spaces)
    const phoneRegex = /^\+?[\d\s-()]{10,15}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  defaultMessage(args: ValidationArguments) {
    return 'Phone number must be 10-15 digits and may include +, spaces, hyphens, or parentheses';
  }
}

/**
 * Decorator for validating phone numbers
 */
export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}

/**
 * Custom validator for file size
 */
@ValidatorConstraint({ name: 'isValidFileSize', async: false })
export class IsValidFileSizeConstraint implements ValidatorConstraintInterface {
  validate(file: any, args: ValidationArguments) {
    if (!file || !file.size) return false;

    const maxSizeInMB = args.constraints?.[0];
    if (typeof maxSizeInMB !== 'number') return false;

    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

    return file.size <= maxSizeInBytes;
  }

  defaultMessage(args: ValidationArguments) {
    const maxSizeInMB = args.constraints?.[0];
    return `File size must not exceed ${maxSizeInMB}MB`;
  }
}

/**
 * Decorator for validating file size
 */
export function IsValidFileSize(
  maxSizeInMB: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [maxSizeInMB],
      validator: IsValidFileSizeConstraint,
    });
  };
}

/**
 * Custom validator for distance between coordinates
 */
@ValidatorConstraint({ name: 'isValidDistance', async: false })
export class IsValidDistanceConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const pickupField = args.constraints?.[0];
    const destinationField = args.constraints?.[1];
    const minDistanceKm = args.constraints?.[2];
    const maxDistanceKm = args.constraints?.[3];

    if (
      !pickupField ||
      !destinationField ||
      typeof minDistanceKm !== 'number' ||
      typeof maxDistanceKm !== 'number'
    ) {
      return true; // Skip validation if constraints are invalid
    }

    const pickup = object[pickupField];
    const destination = object[destinationField];

    if (!pickup || !destination) return true; // Let other validators handle missing fields

    const distance = this.calculateDistance(pickup, destination);

    return distance >= minDistanceKm && distance <= maxDistanceKm;
  }

  defaultMessage(args: ValidationArguments) {
    const minDistanceKm = args.constraints?.[2];
    const maxDistanceKm = args.constraints?.[3];
    return `Distance between pickup and destination must be between ${minDistanceKm}km and ${maxDistanceKm}km`;
  }

  private calculateDistance(point1: any, point2: any): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

/**
 * Decorator for validating distance between two location fields
 */
export function IsValidDistance(
  pickupField: string,
  destinationField: string,
  minDistanceKm: number = 0.05, // 50 meters
  maxDistanceKm: number = 500, // 500 km
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [
        pickupField,
        destinationField,
        minDistanceKm,
        maxDistanceKm,
      ],
      validator: IsValidDistanceConstraint,
    });
  };
}

/**
 * Custom validator for vehicle plate numbers
 */
@ValidatorConstraint({ name: 'isValidVehiclePlate', async: false })
export class IsValidVehiclePlateConstraint
  implements ValidatorConstraintInterface
{
  validate(plateNumber: any, args: ValidationArguments) {
    if (typeof plateNumber !== 'string') return false;

    // Basic vehicle plate validation (alphanumeric, 4-10 characters, may include spaces and hyphens)
    const plateRegex = /^[A-Z0-9\s-]{4,10}$/i;
    return plateRegex.test(plateNumber.trim());
  }

  defaultMessage(args: ValidationArguments) {
    return 'Vehicle plate number must be 4-10 alphanumeric characters and may include spaces or hyphens';
  }
}

/**
 * Decorator for validating vehicle plate numbers
 */
export function IsValidVehiclePlate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidVehiclePlateConstraint,
    });
  };
}
