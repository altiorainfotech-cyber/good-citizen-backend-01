/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator for MongoDB ObjectId
 */
@ValidatorConstraint({ name: 'isValidObjectId', async: false })
export class IsValidObjectIdConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;

    // MongoDB ObjectId is 24 characters long and contains only hexadecimal characters
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid ObjectId format. Must be a 24-character hexadecimal string';
  }
}

/**
 * Decorator for validating MongoDB ObjectId
 */
export function IsValidObjectId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidObjectIdConstraint,
    });
  };
}

/**
 * Custom validator for emergency priority levels
 */
@ValidatorConstraint({ name: 'isValidEmergencyPriority', async: false })
export class IsValidEmergencyPriorityConstraint
  implements ValidatorConstraintInterface
{
  private readonly validPriorities = ['low', 'medium', 'high', 'critical'];

  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return this.validPriorities.includes(value.toLowerCase());
  }

  defaultMessage(args: ValidationArguments) {
    return 'Priority must be one of: low, medium, high, critical';
  }
}

/**
 * Decorator for validating emergency priority
 */
export function IsValidEmergencyPriority(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidEmergencyPriorityConstraint,
    });
  };
}

/**
 * Custom validator for Indian postal codes
 */
@ValidatorConstraint({ name: 'isValidIndianPostalCode', async: false })
export class IsValidIndianPostalCodeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;

    // Indian postal codes are 6 digits
    const postalCodeRegex = /^[1-9][0-9]{5}$/;
    return postalCodeRegex.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid Indian postal code. Must be 6 digits starting with 1-9';
  }
}

/**
 * Decorator for validating Indian postal codes
 */
export function IsValidIndianPostalCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidIndianPostalCodeConstraint,
    });
  };
}

/**
 * Custom validator for time ranges (e.g., operating hours)
 */
@ValidatorConstraint({ name: 'isValidTimeRange', async: false })
export class IsValidTimeRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;

    // Format: "09:00-17:00" or "24/7"
    if (value === '24/7') return true;

    const timeRangeRegex =
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRangeRegex.test(value)) return false;

    // Validate that start time is before end time
    const [startTime, endTime] = value.split('-');
    if (!startTime || !endTime) return false;

    const startTimeParts = startTime.split(':').map(Number);
    const endTimeParts = endTime.split(':').map(Number);

    if (startTimeParts.length !== 2 || endTimeParts.length !== 2) return false;

    const [startHour, startMin] = startTimeParts;
    const [endHour, endMin] = endTimeParts;

    if (
      startHour === undefined ||
      startMin === undefined ||
      endHour === undefined ||
      endMin === undefined
    ) {
      return false;
    }

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return startMinutes < endMinutes;

    return startMinutes < endMinutes;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid time range. Use format "HH:MM-HH:MM" or "24/7"';
  }
}

/**
 * Decorator for validating time ranges
 */
export function IsValidTimeRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidTimeRangeConstraint,
    });
  };
}

/**
 * Custom validator for currency codes
 */
@ValidatorConstraint({ name: 'isValidCurrencyCode', async: false })
export class IsValidCurrencyCodeConstraint
  implements ValidatorConstraintInterface
{
  private readonly validCurrencies = [
    'INR',
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'AUD',
    'CAD',
  ];

  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return this.validCurrencies.includes(value.toUpperCase());
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid currency code. Supported currencies: INR, USD, EUR, GBP, JPY, AUD, CAD';
  }
}

/**
 * Decorator for validating currency codes
 */
export function IsValidCurrencyCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidCurrencyCodeConstraint,
    });
  };
}

/**
 * Custom validator for blood types
 */
@ValidatorConstraint({ name: 'isValidBloodType', async: false })
export class IsValidBloodTypeConstraint
  implements ValidatorConstraintInterface
{
  private readonly validBloodTypes = [
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-',
  ];

  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return this.validBloodTypes.includes(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-';
  }
}

/**
 * Decorator for validating blood types
 */
export function IsValidBloodType(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidBloodTypeConstraint,
    });
  };
}

/**
 * Custom validator for response time (in minutes)
 */
@ValidatorConstraint({ name: 'isValidResponseTime', async: false })
export class IsValidResponseTimeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'number') return false;

    // Response time should be between 1 minute and 24 hours (1440 minutes)
    return value >= 1 && value <= 1440 && Number.isInteger(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Response time must be an integer between 1 and 1440 minutes';
  }
}

/**
 * Decorator for validating response time
 */
export function IsValidResponseTime(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidResponseTimeConstraint,
    });
  };
}

/**
 * Custom validator for facility capacity
 */
@ValidatorConstraint({ name: 'isValidCapacity', async: false })
export class IsValidCapacityConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'number') return false;

    // Capacity should be between 0 and 10000
    return value >= 0 && value <= 10000 && Number.isInteger(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Capacity must be an integer between 0 and 10000';
  }
}

/**
 * Decorator for validating facility capacity
 */
export function IsValidCapacity(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidCapacityConstraint,
    });
  };
}

/**
 * Custom validator for coordinate arrays [longitude, latitude]
 */
@ValidatorConstraint({ name: 'isValidCoordinateArray', async: false })
export class IsValidCoordinateArrayConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (!Array.isArray(value) || value.length !== 2) return false;

    const [longitude, latitude] = value;

    if (typeof longitude !== 'number' || typeof latitude !== 'number')
      return false;

    // Validate longitude (-180 to 180) and latitude (-90 to 90)
    return (
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90 &&
      isFinite(longitude) &&
      isFinite(latitude)
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Coordinates must be an array of [longitude, latitude] with valid numeric values';
  }
}

/**
 * Decorator for validating coordinate arrays
 */
export function IsValidCoordinateArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidCoordinateArrayConstraint,
    });
  };
}

/**
 * Custom validator for Indian mobile numbers
 */
@ValidatorConstraint({ name: 'isValidIndianMobile', async: false })
export class IsValidIndianMobileConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;

    // Indian mobile numbers: +91 followed by 10 digits starting with 6-9
    const mobileRegex = /^\+91[6-9]\d{9}$/;
    return mobileRegex.test(value.replace(/\s|-/g, ''));
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid Indian mobile number. Format: +91XXXXXXXXXX (10 digits starting with 6-9)';
  }
}

/**
 * Decorator for validating Indian mobile numbers
 */
export function IsValidIndianMobile(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions && { options: validationOptions }),
      constraints: [],
      validator: IsValidIndianMobileConstraint,
    });
  };
}
