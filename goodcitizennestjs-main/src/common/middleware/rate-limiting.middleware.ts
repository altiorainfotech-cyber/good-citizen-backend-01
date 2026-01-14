/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

@Injectable()
export class RateLimitingMiddleware implements NestMiddleware {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly configs = new Map<string, RateLimitConfig>();

  constructor(private configService: ConfigService) {
    // Default rate limiting configurations
    this.setupDefaultConfigs();

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const config = this.getConfigForRoute(req.path, req.method);

    if (!config) {
      return next();
    }

    const key = config.keyGenerator
      ? config.keyGenerator(req)
      : this.defaultKeyGenerator(req);
    const now = Date.now();

    let entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        firstRequest: now,
      };
    }

    entry.count++;
    this.store.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetTime = Math.ceil(entry.resetTime / 1000);

    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Window': config.windowMs.toString(),
    });

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      res.set('Retry-After', retryAfter.toString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Rate limit exceeded',
          retryAfter,
          limit: config.maxRequests,
          windowMs: config.windowMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private setupDefaultConfigs() {
    // General API rate limiting
    this.configs.set('default', {
      windowMs: this.configService.get<number>(
        'RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ), // 15 minutes
      maxRequests: this.configService.get<number>(
        'RATE_LIMIT_MAX_REQUESTS',
        100,
      ),
    });

    // Authentication endpoints - stricter limits
    this.configs.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 login attempts per 15 minutes
      keyGenerator: (req) => `auth:${this.getClientIp(req)}`,
    });

    // File upload endpoints - very strict limits
    this.configs.set('upload', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 uploads per minute
      keyGenerator: (req) =>
        `upload:${this.getUserId(req) || this.getClientIp(req)}`,
    });

    // Location updates - moderate limits
    this.configs.set('location', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 1 per second average
      keyGenerator: (req) =>
        `location:${this.getUserId(req) || this.getClientIp(req)}`,
    });

    // Emergency endpoints - higher limits but still controlled
    this.configs.set('emergency', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
      keyGenerator: (req) =>
        `emergency:${this.getUserId(req) || this.getClientIp(req)}`,
    });

    // Ride requests - prevent spam
    this.configs.set('ride', {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10, // 10 ride requests per 5 minutes
      keyGenerator: (req) =>
        `ride:${this.getUserId(req) || this.getClientIp(req)}`,
    });
  }

  private getConfigForRoute(
    path: string,
    method: string,
  ): RateLimitConfig | null {
    // Authentication routes
    if (
      path.includes('/auth/') ||
      path.includes('/login') ||
      path.includes('/register')
    ) {
      return this.configs.get('auth') || null;
    }

    // File upload routes
    if (path.includes('/upload') || path.includes('/s3-manager')) {
      return this.configs.get('upload') || null;
    }

    // Location update routes
    if (path.includes('/location') && method === 'POST') {
      return this.configs.get('location') || null;
    }

    // Emergency routes
    if (path.includes('/emergency')) {
      return this.configs.get('emergency') || null;
    }

    // Ride request routes
    if (path.includes('/rides') && method === 'POST') {
      return this.configs.get('ride') || null;
    }

    // Default rate limiting for all other routes
    return this.configs.get('default') || null;
  }

  private defaultKeyGenerator(req: Request): string {
    const userId = this.getUserId(req);
    const ip = this.getClientIp(req);
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  private getUserId(req: Request): string | null {
    // Extract user ID from JWT token or session
    const user = (req as any).user;
    return user?._id || user?.id || user?.sub || null;
  }

  private getClientIp(req: Request): string {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown';
    // Ensure ip is a string before calling split
    const ipString = ip || 'unknown';
    const parts = ipString.split(',');
    return (parts[0] || 'unknown').trim();
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.store.delete(key));
// console.log removed
  }

  /**
   * Get current rate limit status for a key
   */
  getRateLimitStatus(key: string): RateLimitEntry | null {
    return this.store.get(key) || null;
  }

  /**
   * Reset rate limit for a specific key
   */
  resetRateLimit(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get all active rate limit entries (for monitoring)
   */
  getAllRateLimits(): Map<string, RateLimitEntry> {
    return new Map(this.store);
  }
}
