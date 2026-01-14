/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from 'class-validator';
import { MongoError } from 'mongodb';

export interface StandardErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: any;
  retryAfter?: number;
  retryable?: boolean;
  errorCode?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log error details
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): StandardErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestId = this.generateRequestId();

    // Handle HTTP exceptions (thrown by NestJS)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      return {
        statusCode: status,
        message: this.extractMessage(exceptionResponse),
        error: this.getErrorName(status),
        timestamp,
        path,
        requestId,
        retryable: this.isRetryableError(status),
        errorCode: this.getErrorCode(status, exceptionResponse),
        ...(this.isRetryableError(status) && { retryAfter: this.getRetryAfter(status) }),
        details:
          typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
      };
    }

    // Handle MongoDB errors
    if (this.isMongoError(exception)) {
      return this.handleMongoError(
        exception as MongoError,
        timestamp,
        path,
        requestId,
      );
    }

    // Handle validation errors
    if (this.isValidationError(exception)) {
      return this.handleValidationError(
        exception as ValidationError[],
        timestamp,
        path,
        requestId,
      );
    }

    // Handle JWT errors
    if (this.isJWTError(exception)) {
      return this.handleJWTError(
        exception as Error,
        timestamp,
        path,
        requestId,
      );
    }

    // Handle file upload errors
    if (this.isMulterError(exception)) {
      return this.handleMulterError(
        exception as any,
        timestamp,
        path,
        requestId,
      );
    }

    // Handle rate limiting errors (already handled above as HttpException, but adding specific handling)
    if (this.isRateLimitError(exception)) {
      return this.handleRateLimitError(
        exception as any,
        timestamp,
        path,
        requestId,
      );
    }

    // Handle network/timeout errors
    if (this.isNetworkError(exception)) {
      return this.handleNetworkError(
        exception as Error,
        timestamp,
        path,
        requestId,
      );
    }

    // Handle unknown errors
    return this.handleUnknownError(exception, timestamp, path, requestId);
  }

  private extractMessage(exceptionResponse: any): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object') {
      if (exceptionResponse.message) {
        return exceptionResponse.message;
      }
      if (exceptionResponse.error) {
        return exceptionResponse.error;
      }
    }

    return 'An error occurred';
  }

  private getErrorName(statusCode: number): string {
    const errorNames = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return errorNames[statusCode] || 'Error';
  }

  private handleMongoError(
    error: MongoError,
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = this.extractDuplicateField(error.message);
      return {
        statusCode: HttpStatus.CONFLICT,
        message: `${field} already exists`,
        error: 'Duplicate Entry',
        timestamp,
        path,
        requestId,
        retryable: false,
        errorCode: 'DUPLICATE_ENTRY',
        details: { field, code: error.code },
      };
    }

    // Handle validation errors
    if (error.code === 121) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Document validation failed',
        error: 'Validation Error',
        timestamp,
        path,
        requestId,
        retryable: false,
        errorCode: 'DOCUMENT_VALIDATION_FAILED',
        details: { code: error.code },
      };
    }

    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database connection failed',
        error: 'Service Unavailable',
        timestamp,
        path,
        requestId,
        retryable: true,
        retryAfter: 30,
        errorCode: 'DATABASE_CONNECTION_FAILED',
        details: { code: error.code },
      };
    }

    // Generic MongoDB error
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database operation failed',
      error: 'Database Error',
      timestamp,
      path,
      requestId,
      retryable: true,
      retryAfter: 5,
      errorCode: 'DATABASE_OPERATION_FAILED',
      details: { code: error.code },
    };
  }

  private handleValidationError(
    errors: ValidationError[],
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    const messages = errors
      .map((error) => {
        const constraints = error.constraints;
        return constraints
          ? Object.values(constraints)
          : [`${error.property} is invalid`];
      })
      .flat();

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: messages,
      error: 'Validation Failed',
      timestamp,
      path,
      requestId,
      retryable: false,
      errorCode: 'VALIDATION_FAILED',
      details: { validationErrors: errors },
    };
  }

  private handleJWTError(
    error: Error,
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    let message = 'Authentication failed';
    let errorCode = 'AUTHENTICATION_FAILED';
    const statusCode = HttpStatus.UNAUTHORIZED;

    if (error.message.includes('expired')) {
      message = 'Token has expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message.includes('invalid')) {
      message = 'Invalid token';
      errorCode = 'INVALID_TOKEN';
    } else if (error.message.includes('malformed')) {
      message = 'Malformed token';
      errorCode = 'MALFORMED_TOKEN';
    }

    return {
      statusCode,
      message,
      error: 'Authentication Error',
      timestamp,
      path,
      requestId,
      retryable: false,
      errorCode,
    };
  }

  private handleMulterError(
    error: any,
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    let message = 'File upload failed';
    let errorCode = 'FILE_UPLOAD_FAILED';
    const statusCode = HttpStatus.BAD_REQUEST;

    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds the allowed limit';
      errorCode = 'FILE_SIZE_EXCEEDED';
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
      errorCode = 'FILE_COUNT_EXCEEDED';
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
      errorCode = 'UNEXPECTED_FILE_FIELD';
    }

    return {
      statusCode,
      message,
      error: 'File Upload Error',
      timestamp,
      path,
      requestId,
      retryable: false,
      errorCode,
      details: { code: error.code },
    };
  }

  private handleRateLimitError(
    error: any,
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    return {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Rate limit exceeded. Please try again later.',
      error: 'Too Many Requests',
      timestamp,
      path,
      requestId,
      retryable: true,
      retryAfter: error.retryAfter || 60,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      details: {
        retryAfter: error.retryAfter,
        limit: error.limit,
        windowMs: error.windowMs,
      },
    };
  }

  private handleUnknownError(
    exception: unknown,
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    const error = exception as Error;

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      timestamp,
      path,
      requestId,
      retryable: true,
      retryAfter: 10,
      errorCode: 'INTERNAL_SERVER_ERROR',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    };
  }

  private isMongoError(exception: unknown): boolean {
    return (
      exception instanceof Error &&
      (exception.name === 'MongoError' ||
        exception.name === 'MongoServerError' ||
        'code' in exception)
    );
  }

  private isValidationError(exception: unknown): boolean {
    return (
      Array.isArray(exception) &&
      exception.length > 0 &&
      exception[0] instanceof ValidationError
    );
  }

  private isJWTError(exception: unknown): boolean {
    return (
      exception instanceof Error &&
      (exception.name === 'JsonWebTokenError' ||
        exception.name === 'TokenExpiredError' ||
        exception.name === 'NotBeforeError')
    );
  }

  private isMulterError(exception: unknown): boolean {
    return exception instanceof Error && exception.name === 'MulterError';
  }

  private isRateLimitError(exception: unknown): boolean {
    return (
      exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private isNetworkError(exception: unknown): boolean {
    return (
      exception instanceof Error &&
      (exception.message.includes('ECONNREFUSED') ||
        exception.message.includes('ETIMEDOUT') ||
        exception.message.includes('ENOTFOUND') ||
        exception.message.includes('ECONNRESET'))
    );
  }

  private handleNetworkError(
    error: Error,
    timestamp: string,
    path: string,
    requestId: string,
  ): StandardErrorResponse {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'External service unavailable',
      error: 'Service Unavailable',
      timestamp,
      path,
      requestId,
      retryable: true,
      retryAfter: 30,
      errorCode: 'EXTERNAL_SERVICE_UNAVAILABLE',
      details: { originalError: error.message },
    };
  }

  private isRetryableError(statusCode: number): boolean {
    // 5xx errors are generally retryable, some 4xx are not
    return (
      statusCode >= 500 ||
      statusCode === HttpStatus.TOO_MANY_REQUESTS ||
      statusCode === HttpStatus.REQUEST_TIMEOUT
    );
  }

  private getRetryAfter(statusCode: number): number {
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

  private getErrorCode(statusCode: number, exceptionResponse: any): string {
    // Extract error code from response if available
    if (typeof exceptionResponse === 'object' && exceptionResponse.errorCode) {
      return exceptionResponse.errorCode;
    }

    // Generate error code based on status
    const errorCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return errorCodes[statusCode] || 'UNKNOWN_ERROR';
  }

  private extractDuplicateField(message: string): string {
    // Extract field name from MongoDB duplicate key error message
    const match = message.match(/index: (\w+)_/);
    return match?.[1] || 'field';
  }

  private generateRequestId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: StandardErrorResponse,
  ) {
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';

    const logContext = {
      requestId: errorResponse.requestId,
      method,
      url,
      ip,
      userAgent,
      statusCode: errorResponse.statusCode,
      timestamp: errorResponse.timestamp,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${method} ${url} - ${errorResponse.statusCode} - ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : exception,
        JSON.stringify(logContext),
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `${method} ${url} - ${errorResponse.statusCode} - ${errorResponse.message}`,
        JSON.stringify(logContext),
      );
    }
  }
}
