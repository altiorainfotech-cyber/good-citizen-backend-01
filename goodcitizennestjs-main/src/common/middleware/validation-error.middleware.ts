/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/unbound-method */

import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ValidationErrorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ValidationErrorMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Log incoming request for debugging
    this.logger.debug(`${req.method} ${req.url} - Validation middleware`);

    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = this.sanitizeObject(req.params);
    }

    // Validate content type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];

      if (!contentType) {
        throw new BadRequestException('Content-Type header is required');
      }

      if (
        !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')
      ) {
        throw new BadRequestException(
          'Unsupported Content-Type. Use application/json, multipart/form-data, or application/x-www-form-urlencoded',
        );
      }
    }

    // Validate request size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      // 10MB limit
      throw new BadRequestException(
        'Request payload too large. Maximum size is 10MB',
      );
    }

    // Add request ID for tracking
    req['requestId'] = this.generateRequestId();

    next();
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    return (
      str
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script tags and content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove potential XSS patterns
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        // Remove SQL injection patterns
        .replace(
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
          '',
        )
        // Trim whitespace
        .trim()
        // Limit length to prevent DoS
        .substring(0, 10000)
    );
  }

  private generateRequestId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.headers['user-agent'] || '';
    const requestId = req['requestId'] || 'unknown';

    // Log request start
    this.logger.log(`[${requestId}] ${method} ${url} - ${ip} - ${userAgent}`);

    // Override res.end to log response
    const originalEnd = res.end;
    const self = this;
    res.end = function (chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      const logLevel = statusCode >= 400 ? 'warn' : 'log';
      self.logger[logLevel](
        `[${requestId}] ${method} ${url} - ${statusCode} - ${duration}ms`,
      );

      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  }
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );

    // Remove server information
    res.removeHeader('X-Powered-By');

    // Set CORS headers for API
    if (req.path.startsWith('/v1/') || req.path.startsWith('/api/')) {
      res.setHeader(
        'Access-Control-Allow-Origin',
        process.env.ALLOWED_ORIGINS || '*',
      );
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With',
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    next();
  }
}

@Injectable()
export class RateLimitingValidationMiddleware implements NestMiddleware {
  private readonly requestCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly logger = new Logger(RateLimitingValidationMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const clientId = this.getClientId(req);
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 1000; // requests per window

    // Clean up old entries
    this.cleanupOldEntries(now, windowMs);

    // Get or create client record
    let clientRecord = this.requestCounts.get(clientId);
    if (!clientRecord || now > clientRecord.resetTime) {
      clientRecord = { count: 0, resetTime: now + windowMs };
      this.requestCounts.set(clientId, clientRecord);
    }

    // Increment request count
    clientRecord.count++;

    // Check if limit exceeded
    if (clientRecord.count > maxRequests) {
      const retryAfter = Math.ceil((clientRecord.resetTime - now) / 1000);

      this.logger.warn(
        `Rate limit exceeded for client ${clientId}. Count: ${clientRecord.count}`,
      );

      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        error: 'Too Many Requests',
        retryAfter,
        limit: maxRequests,
        windowMs,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader(
      'X-RateLimit-Remaining',
      (maxRequests - clientRecord.count).toString(),
    );
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(clientRecord.resetTime / 1000).toString(),
    );

    next();
  }

  private getClientId(req: Request): string {
    // Use IP address as client identifier
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private cleanupOldEntries(now: number, windowMs: number) {
    for (const [clientId, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(clientId);
      }
    }
  }
}
