/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { plainToClass, Transform } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Custom sanitization and transformation pipe
 */
@Injectable()
export class SanitizationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return this.sanitizeValue(value);
    }

    // Sanitize the input before validation
    const sanitizedValue = this.sanitizeValue(value);

    // Transform to class instance
    const object = plainToClass(metatype, sanitizedValue);

    // Validate the transformed object
    const errors = await validate(object);
    if (errors.length > 0) {
      throw new BadRequestException('Validation failed');
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (typeof value === 'object') {
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    return (
      str
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
}

/**
 * Transform decorator for trimming strings
 */
export function TrimString() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  });
}

/**
 * Transform decorator for normalizing phone numbers
 */
export function NormalizePhoneNumber() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove spaces, hyphens, and parentheses
      let normalized = value.replace(/[\s\-()]/g, '');

      // Add +91 prefix if it's a 10-digit Indian number
      if (/^[6-9]\d{9}$/.test(normalized)) {
        normalized = '+91' + normalized;
      }

      return normalized;
    }
    return value;
  });
}

/**
 * Transform decorator for normalizing email addresses
 */
export function NormalizeEmail() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    return value;
  });
}

/**
 * Transform decorator for parsing coordinates
 */
export function ParseCoordinates() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length === 2) {
          return [parseFloat(parsed[0]), parseFloat(parsed[1])];
        }
      } catch (e) {
        // If parsing fails, return original value for validation to catch
        return value;
      }
    }
    if (Array.isArray(value) && value.length === 2) {
      return [parseFloat(value[0]), parseFloat(value[1])];
    }
    return value;
  });
}

/**
 * Transform decorator for normalizing currency codes
 */
export function NormalizeCurrency() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase().trim();
    }
    return value;
  });
}

/**
 * Transform decorator for parsing boolean values from strings
 */
export function ParseBoolean() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  });
}

/**
 * Transform decorator for parsing numeric values
 */
export function ParseNumber() {
  return Transform(({ value }) => {
    if (typeof value === 'string' && !isNaN(Number(value))) {
      return Number(value);
    }
    return value;
  });
}

/**
 * Transform decorator for normalizing enum values
 */
export function NormalizeEnum() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    return value;
  });
}
