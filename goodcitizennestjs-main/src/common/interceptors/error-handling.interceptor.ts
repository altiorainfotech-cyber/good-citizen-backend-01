/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { Request } from 'express';
import { ErrorHandlingService } from '../error-handling.service';

@Injectable()
export class ErrorHandlingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorHandlingInterceptor.name);
  private readonly requestTimeout = 30000; // 30 seconds

  constructor(private errorHandlingService: ErrorHandlingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      timeout(this.requestTimeout),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const errorContext = {
          operation: this.getOperationName(context),
          requestId: request['requestId'],
          userId: request.user?.['id'],
          metadata: {
            method: request.method,
            url: request.url,
            duration,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          },
        };

        // Handle different types of errors
        let processedError: HttpException;

        if (error.name === 'TimeoutError') {
          processedError = this.errorHandlingService.createErrorResponse(
            'Request timeout',
            HttpStatus.REQUEST_TIMEOUT,
            'REQUEST_TIMEOUT',
            { timeout: this.requestTimeout },
            true,
          );
        } else if (this.isGeospatialError(error, request)) {
          processedError = this.errorHandlingService.handleGeospatialError(
            error,
            errorContext.operation,
          );
        } else if (this.isImpactCalculationError(error, request)) {
          const assistId = this.extractAssistId(request);
          processedError = this.errorHandlingService.handleImpactCalculationError(
            error,
            assistId,
          );
        } else if (this.isRewardsError(error, request)) {
          const userId = request.user?.['id'] || 'unknown';
          processedError = this.errorHandlingService.handleRewardsError(
            error,
            userId,
          );
        } else if (this.isLocationError(error, request)) {
          const userId = request.user?.['id'] || 'unknown';
          processedError = this.errorHandlingService.handleLocationError(
            error,
            userId,
          );
        } else {
          // Generic error handling
          processedError = this.errorHandlingService.handleError(
            error,
            errorContext,
            false,
          );
        }

        // Log the error with context
        this.logError(error, errorContext, processedError);

        return throwError(() => processedError);
      }),
    );
  }

  private getOperationName(context: ExecutionContext): string {
    const handler = context.getHandler();
    const controller = context.getClass();
    return `${controller.name}.${handler.name}`;
  }

  private isGeospatialError(error: any, request: Request): boolean {
    return (
      request.url.includes('/explore/') ||
      request.url.includes('/hospitals') ||
      request.url.includes('/blood-banks') ||
      request.url.includes('/ambulances') ||
      error.message?.includes('coordinates') ||
      error.message?.includes('geospatial')
    );
  }

  private isImpactCalculationError(error: any, request: Request): boolean {
    return (
      request.url.includes('/assists/') &&
      (request.url.includes('/impact') || request.url.includes('/complete'))
    );
  }

  private isRewardsError(error: any, request: Request): boolean {
    return (
      request.url.includes('/rewards/') ||
      request.url.includes('/track-activity') ||
      request.url.includes('/achievements')
    );
  }

  private isLocationError(error: any, request: Request): boolean {
    return (
      request.url.includes('/location/') ||
      error.message?.includes('location') ||
      error.message?.includes('coordinates')
    );
  }

  private extractAssistId(request: Request): string {
    const match = request.url.match(/\/assists\/([^\/]+)/);
    return match?.[1] || 'unknown';
  }

  private logError(
    originalError: any,
    context: any,
    processedError: HttpException,
  ) {
    const logData = {
      operation: context.operation,
      requestId: context.requestId,
      userId: context.userId,
      statusCode: processedError.getStatus(),
      duration: context.metadata.duration,
      method: context.metadata.method,
      url: context.metadata.url,
      userAgent: context.metadata.userAgent,
      ip: context.metadata.ip,
    };

    if (processedError.getStatus() >= 500) {
      this.logger.error(
        `Server error in ${context.operation}`,
        originalError.stack || originalError,
        JSON.stringify(logData),
      );
    } else if (processedError.getStatus() >= 400) {
      this.logger.warn(
        `Client error in ${context.operation}: ${processedError.message}`,
        JSON.stringify(logData),
      );
    }
  }
}

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTimeInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Add response time header even for errors
        response.setHeader('X-Response-Time', `${duration}ms`);
        
        // Log slow requests
        if (duration > 5000) { // 5 seconds
          this.logger.warn(
            `Slow request: ${request.method} ${request.url} took ${duration}ms`,
          );
        }
        
        return throwError(() => error);
      }),
    );
  }
}

@Injectable()
export class RequestValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestValidationInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    // Validate critical endpoints
    if (this.isCriticalEndpoint(request.url)) {
      this.validateCriticalRequest(request);
    }

    return next.handle().pipe(
      catchError((error) => {
        // Add request validation context to errors
        if (error instanceof HttpException) {
          const response = error.getResponse();
          if (typeof response === 'object') {
            (response as any).requestValidation = {
              url: request.url,
              method: request.method,
              hasAuth: !!request.headers.authorization,
              contentType: request.headers['content-type'],
            };
          }
        }
        
        return throwError(() => error);
      }),
    );
  }

  private isCriticalEndpoint(url: string): boolean {
    const criticalPatterns = [
      '/v1/explore/',
      '/v1/assists/',
      '/v1/rewards/',
      '/v1/location/',
      '/auth/',
    ];
    
    return criticalPatterns.some(pattern => url.includes(pattern));
  }

  private validateCriticalRequest(request: Request): void {
    // Validate authentication for protected endpoints
    if (this.requiresAuth(request.url) && !request.headers.authorization) {
      throw new HttpException(
        {
          message: 'Authentication required',
          errorCode: 'AUTHENTICATION_REQUIRED',
          retryable: false,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Validate content type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        throw new HttpException(
          {
            message: 'Content-Type must be application/json',
            errorCode: 'INVALID_CONTENT_TYPE',
            retryable: false,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Validate geospatial parameters
    if (this.isGeospatialEndpoint(request.url)) {
      this.validateGeospatialParams(request);
    }
  }

  private requiresAuth(url: string): boolean {
    const publicEndpoints = [
      '/auth/login',
      '/auth/register',
      '/health',
      '/docs',
    ];
    
    return !publicEndpoints.some(endpoint => url.includes(endpoint));
  }

  private isGeospatialEndpoint(url: string): boolean {
    return url.includes('/explore/') || url.includes('/location/');
  }

  private validateGeospatialParams(request: Request): void {
    const { latitude, longitude } = request.query;
    
    if (latitude !== undefined || longitude !== undefined) {
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new HttpException(
          {
            message: 'Invalid latitude. Must be between -90 and 90',
            errorCode: 'INVALID_LATITUDE',
            retryable: false,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new HttpException(
          {
            message: 'Invalid longitude. Must be between -180 and 180',
            errorCode: 'INVALID_LONGITUDE',
            retryable: false,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }
}