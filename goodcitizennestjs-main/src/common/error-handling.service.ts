/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorTrackingService } from './error-tracking.service';

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
  };

  constructor(
    private configService: ConfigService,
    private errorTrackingService: ErrorTrackingService,
  ) {}

  /**
   * Handle and standardize errors across the application
   */
  handleError(
    error: unknown,
    context: ErrorContext = {},
    shouldThrow: boolean = true,
  ): HttpException {
    const errorId = this.errorTrackingService.trackException(
      error as Error,
      context.operation,
      context.userId,
      context.requestId,
      context.metadata,
    );

    let httpException: HttpException;

    if (error instanceof HttpException) {
      httpException = error;
    } else if (this.isValidationError(error)) {
      httpException = new HttpException(
        {
          message: 'Validation failed',
          errorCode: 'VALIDATION_FAILED',
          details: error,
        },
        HttpStatus.BAD_REQUEST,
      );
    } else if (this.isDatabaseError(error)) {
      httpException = this.handleDatabaseError(error as any);
    } else if (this.isNetworkError(error)) {
      httpException = new HttpException(
        {
          message: 'External service unavailable',
          errorCode: 'EXTERNAL_SERVICE_UNAVAILABLE',
          retryable: true,
          retryAfter: 30,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } else {
      // Unknown error
      httpException = new HttpException(
        {
          message: 'Internal server error',
          errorCode: 'INTERNAL_SERVER_ERROR',
          retryable: true,
          retryAfter: 10,
          ...(process.env.NODE_ENV === 'development' && {
            details: {
              name: (error as Error).name,
              message: (error as Error).message,
              stack: (error as Error).stack,
            },
          }),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Add error tracking ID to response
    const response = httpException.getResponse();
    if (typeof response === 'object') {
      (response as any).errorId = errorId;
    }

    if (shouldThrow) {
      throw httpException;
    }

    return httpException;
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    retryConfig: Partial<RetryConfig> = {},
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry non-retryable errors
        if (!this.isRetryableError(error)) {
          this.logger.warn(
            `Non-retryable error in ${context.operation}, attempt ${attempt}/${config.maxAttempts}`,
            error,
          );
          break;
        }

        if (attempt === config.maxAttempts) {
          this.logger.error(
            `Operation ${context.operation} failed after ${config.maxAttempts} attempts`,
            error,
          );
          break;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay,
        );

        this.logger.warn(
          `Retrying ${context.operation} in ${delay}ms (attempt ${attempt}/${config.maxAttempts})`,
          error,
        );

        await this.sleep(delay);
      }
    }

    // All retries failed, handle the error
    if (!lastError) {
      lastError = new Error('Unknown error occurred during retry operation');
    }
    
    return this.handleError(lastError, context, true) as never;
  }

  /**
   * Create a standardized error response for API endpoints
   */
  createErrorResponse(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode?: string,
    details?: any,
    retryable: boolean = false,
  ): HttpException {
    return new HttpException(
      {
        message,
        errorCode: errorCode || this.getDefaultErrorCode(statusCode),
        retryable,
        ...(retryable && { retryAfter: this.getRetryAfter(statusCode) }),
        ...(details && { details }),
      },
      statusCode,
    );
  }

  /**
   * Handle geospatial query errors
   */
  handleGeospatialError(error: unknown, operation: string): HttpException {
    if (this.isInvalidCoordinatesError(error)) {
      return this.createErrorResponse(
        'Invalid coordinates provided',
        HttpStatus.BAD_REQUEST,
        'INVALID_COORDINATES',
      );
    }

    if (this.isDatabaseError(error)) {
      return this.createErrorResponse(
        'Geospatial query failed',
        HttpStatus.SERVICE_UNAVAILABLE,
        'GEOSPATIAL_QUERY_FAILED',
        undefined,
        true,
      );
    }

    return this.handleError(error, { operation }, false);
  }

  /**
   * Handle impact calculation errors
   */
  handleImpactCalculationError(
    error: unknown,
    assistId: string,
  ): HttpException {
    if (this.isNotFoundError(error)) {
      return this.createErrorResponse(
        `Assist with ID ${assistId} not found`,
        HttpStatus.NOT_FOUND,
        'ASSIST_NOT_FOUND',
      );
    }

    if (this.isInvalidDataError(error)) {
      return this.createErrorResponse(
        'Invalid route data for impact calculation',
        HttpStatus.BAD_REQUEST,
        'INVALID_ROUTE_DATA',
      );
    }

    return this.handleError(
      error,
      { operation: 'impact_calculation', metadata: { assistId } },
      false,
    );
  }

  /**
   * Handle rewards system errors
   */
  handleRewardsError(error: unknown, userId: string): HttpException {
    if (this.isNotFoundError(error)) {
      return this.createErrorResponse(
        `User with ID ${userId} not found`,
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    if (this.isInsufficientPointsError(error)) {
      return this.createErrorResponse(
        'Insufficient points for this operation',
        HttpStatus.BAD_REQUEST,
        'INSUFFICIENT_POINTS',
      );
    }

    return this.handleError(
      error,
      { operation: 'rewards_operation', userId },
      false,
    );
  }

  /**
   * Handle location service errors
   */
  handleLocationError(error: unknown, userId: string): HttpException {
    if (this.isInvalidLocationError(error)) {
      return this.createErrorResponse(
        'Invalid location data provided',
        HttpStatus.BAD_REQUEST,
        'INVALID_LOCATION_DATA',
      );
    }

    if (this.isLocationPermissionError(error)) {
      return this.createErrorResponse(
        'Location permission denied',
        HttpStatus.FORBIDDEN,
        'LOCATION_PERMISSION_DENIED',
      );
    }

    return this.handleError(
      error,
      { operation: 'location_update', userId },
      false,
    );
  }

  /**
   * Private helper methods
   */
  private handleDatabaseError(error: any): HttpException {
    if (error.code === 11000) {
      // Duplicate key error
      const field = this.extractDuplicateField(error.message);
      return new HttpException(
        {
          message: `${field} already exists`,
          errorCode: 'DUPLICATE_ENTRY',
          retryable: false,
        },
        HttpStatus.CONFLICT,
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new HttpException(
        {
          message: 'Database connection failed',
          errorCode: 'DATABASE_CONNECTION_FAILED',
          retryable: true,
          retryAfter: 30,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return new HttpException(
      {
        message: 'Database operation failed',
        errorCode: 'DATABASE_OPERATION_FAILED',
        retryable: true,
        retryAfter: 5,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return (
        status >= 500 ||
        status === HttpStatus.TOO_MANY_REQUESTS ||
        status === HttpStatus.REQUEST_TIMEOUT
      );
    }

    return (
      this.isDatabaseError(error) ||
      this.isNetworkError(error) ||
      this.isTimeoutError(error)
    );
  }

  private isValidationError(error: unknown): boolean {
    return Array.isArray(error) && error.length > 0;
  }

  private isDatabaseError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'MongoError' ||
        error.name === 'MongoServerError' ||
        'code' in error)
    );
  }

  private isNetworkError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNRESET'))
    );
  }

  private isTimeoutError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))
    );
  }

  private isInvalidCoordinatesError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('Invalid coordinates') ||
        error.message.includes('latitude') ||
        error.message.includes('longitude'))
    );
  }

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('not found') ||
        error.message.includes('Not Found'))
    );
  }

  private isInvalidDataError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('Invalid data') ||
        error.message.includes('invalid route'))
    );
  }

  private isInsufficientPointsError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes('Insufficient points')
    );
  }

  private isInvalidLocationError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes('Invalid location')
    );
  }

  private isLocationPermissionError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes('Location permission')
    );
  }

  private getDefaultErrorCode(statusCode: HttpStatus): string {
    const errorCodes = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    };

    return errorCodes[statusCode] || 'UNKNOWN_ERROR';
  }

  private getRetryAfter(statusCode: HttpStatus): number {
    switch (statusCode) {
      case HttpStatus.TOO_MANY_REQUESTS:
        return 60; // 1 minute
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 30; // 30 seconds
      case HttpStatus.REQUEST_TIMEOUT:
        return 5; // 5 seconds
      default:
        return 10; // 10 seconds default
    }
  }

  private extractDuplicateField(message: string): string {
    const match = message.match(/index: (\w+)_/);
    return match?.[1] || 'field';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}