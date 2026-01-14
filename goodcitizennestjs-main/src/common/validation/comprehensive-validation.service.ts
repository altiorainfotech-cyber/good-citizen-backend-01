/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ComprehensiveValidationService {
  /**
   * Validate a DTO with comprehensive error reporting
   */
  async validateDto<T extends object>(
    dtoClass: new () => T,
    data: any,
    options?: {
      skipMissingProperties?: boolean;
      whitelist?: boolean;
      forbidNonWhitelisted?: boolean;
      groups?: string[];
    },
  ): Promise<T> {
    const dto = plainToClass(dtoClass, data);

    const validationOptions = {
      skipMissingProperties: options?.skipMissingProperties ?? false,
      whitelist: options?.whitelist ?? true,
      forbidNonWhitelisted: options?.forbidNonWhitelisted ?? true,
      ...(options?.groups && { groups: options.groups }),
    };

    const errors = await validate(dto, validationOptions);

    if (errors.length > 0) {
      const formattedErrors = this.formatValidationErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
        statusCode: 400,
      });
    }

    return dto;
  }

  /**
   * Validate multiple DTOs in batch
   */
  async validateBatch<T extends object>(
    dtoClass: new () => T,
    dataArray: any[],
    options?: {
      skipMissingProperties?: boolean;
      whitelist?: boolean;
      forbidNonWhitelisted?: boolean;
      groups?: string[];
      continueOnError?: boolean;
    },
  ): Promise<{ valid: T[]; errors: Array<{ index: number; errors: any }> }> {
    const results: T[] = [];
    const batchErrors: Array<{ index: number; errors: any }> = [];

    for (let i = 0; i < dataArray.length; i++) {
      try {
        const validatedDto = await this.validateDto(
          dtoClass,
          dataArray[i],
          options,
        );
        results.push(validatedDto);
      } catch (error: any) {
        batchErrors.push({
          index: i,
          errors: error?.response?.errors || error?.message || 'Unknown error',
        });

        if (!options?.continueOnError) {
          throw new BadRequestException({
            message: `Validation failed at index ${i}`,
            batchErrors,
            statusCode: 400,
          });
        }
      }
    }

    return { valid: results, errors: batchErrors };
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(longitude: number, latitude: number): boolean {
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      return false;
    }

    if (!isFinite(longitude) || !isFinite(latitude)) {
      return false;
    }

    return (
      longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90
    );
  }

  /**
   * Validate coordinate array [longitude, latitude]
   */
  validateCoordinateArray(coordinates: any): boolean {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return false;
    }

    const [longitude, latitude] = coordinates;
    return this.validateCoordinates(longitude, latitude);
  }

  /**
   * Validate Indian mobile number
   */
  validateIndianMobile(phoneNumber: string): boolean {
    if (typeof phoneNumber !== 'string') {
      return false;
    }

    // Remove spaces, hyphens, and parentheses
    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');

    // Check for +91 prefix followed by 10 digits starting with 6-9
    const mobileRegex = /^\+91[6-9]\d{9}$/;
    return mobileRegex.test(cleaned);
  }

  /**
   * Validate Indian postal code
   */
  validateIndianPostalCode(postalCode: string): boolean {
    if (typeof postalCode !== 'string') {
      return false;
    }

    // Indian postal codes are 6 digits starting with 1-9
    const postalRegex = /^[1-9][0-9]{5}$/;
    return postalRegex.test(postalCode);
  }

  /**
   * Validate MongoDB ObjectId
   */
  validateObjectId(id: string): boolean {
    if (typeof id !== 'string') {
      return false;
    }

    // MongoDB ObjectId is 24 characters long and contains only hexadecimal characters
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
  }

  /**
   * Validate time range (e.g., "09:00-17:00" or "24/7")
   */
  validateTimeRange(timeRange: string): boolean {
    if (typeof timeRange !== 'string') {
      return false;
    }

    if (timeRange === '24/7') {
      return true;
    }

    const timeRangeRegex =
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRangeRegex.test(timeRange)) {
      return false;
    }

    // Validate that start time is before end time
    const parts = timeRange.split('-');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }

    const [startTime, endTime] = parts;
    const startParts = startTime.split(':');
    const endParts = endTime.split(':');

    if (
      startParts.length !== 2 ||
      endParts.length !== 2 ||
      !startParts[0] ||
      !startParts[1] ||
      !endParts[0] ||
      !endParts[1]
    ) {
      return false;
    }

    const startHourNum = Number(startParts[0]);
    const startMinNum = Number(startParts[1]);
    const endHourNum = Number(endParts[0]);
    const endMinNum = Number(endParts[1]);

    const startMinutes = startHourNum * 60 + startMinNum;
    const endMinutes = endHourNum * 60 + endMinNum;

    return startMinutes < endMinutes;
  }

  /**
   * Validate blood type
   */
  validateBloodType(bloodType: string): boolean {
    if (typeof bloodType !== 'string') {
      return false;
    }

    const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    return validBloodTypes.includes(bloodType);
  }

  /**
   * Validate currency code
   */
  validateCurrencyCode(currency: string): boolean {
    if (typeof currency !== 'string') {
      return false;
    }

    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
    return validCurrencies.includes(currency.toUpperCase());
  }

  /**
   * Validate emergency priority
   */
  validateEmergencyPriority(priority: string): boolean {
    if (typeof priority !== 'string') {
      return false;
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    return validPriorities.includes(priority.toLowerCase());
  }

  /**
   * Validate response time (in minutes)
   */
  validateResponseTime(responseTime: number): boolean {
    if (typeof responseTime !== 'number') {
      return false;
    }

    // Response time should be between 1 minute and 24 hours (1440 minutes)
    return (
      responseTime >= 1 &&
      responseTime <= 1440 &&
      Number.isInteger(responseTime)
    );
  }

  /**
   * Validate facility capacity
   */
  validateCapacity(capacity: number): boolean {
    if (typeof capacity !== 'number') {
      return false;
    }

    // Capacity should be between 0 and 10000
    return capacity >= 0 && capacity <= 10000 && Number.isInteger(capacity);
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return input;
    }

    return (
      input
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script tags and content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove potential XSS patterns
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        // Trim whitespace
        .trim()
        // Limit length to prevent DoS
        .substring(0, 10000)
    );
  }

  /**
   * Validate pagination parameters
   */
  validatePagination(
    page?: number,
    limit?: number,
  ): { page: number; limit: number } {
    const validatedPage = Math.max(1, Math.floor(page || 1));
    const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

    return { page: validatedPage, limit: validatedLimit };
  }

  /**
   * Validate date range
   */
  validateDateRange(startDate?: string, endDate?: string): boolean {
    if (!startDate && !endDate) {
      return true; // No date range specified is valid
    }

    if (startDate && !this.isValidISODate(startDate)) {
      return false;
    }

    if (endDate && !this.isValidISODate(endDate)) {
      return false;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return start <= end;
    }

    return true;
  }

  /**
   * Check if string is valid ISO date
   */
  private isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    return (
      date instanceof Date &&
      !isNaN(date.getTime()) &&
      date.toISOString() === dateString
    );
  }

  /**
   * Format validation errors for consistent response
   */
  private formatValidationErrors(errors: ValidationError[]): any {
    const formattedErrors = {};

    errors.forEach((error) => {
      const constraints = error.constraints;
      if (constraints) {
        formattedErrors[error.property] = Object.values(constraints);
      }

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        formattedErrors[error.property] = this.formatValidationErrors(
          error.children,
        );
      }
    });

    return formattedErrors;
  }

  /**
   * Validate array of ObjectIds
   */
  validateObjectIdArray(ids: string[]): boolean {
    if (!Array.isArray(ids)) {
      return false;
    }

    return ids.every((id) => this.validateObjectId(id));
  }

  /**
   * Validate enum value
   */
  validateEnum(value: string, validValues: string[]): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    return validValues.includes(value.toLowerCase());
  }

  /**
   * Validate numeric range
   */
  validateNumericRange(value: number, min: number, max: number): boolean {
    if (typeof value !== 'number' || !isFinite(value)) {
      return false;
    }

    return value >= min && value <= max;
  }

  /**
   * Validate array length
   */
  validateArrayLength(
    array: any[],
    minLength: number,
    maxLength: number,
  ): boolean {
    if (!Array.isArray(array)) {
      return false;
    }

    return array.length >= minLength && array.length <= maxLength;
  }
}
