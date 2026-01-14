/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { SecurityAuditService } from '../security-audit.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private securityAuditService: SecurityAuditService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      // Extract IP and User Agent for security logging
      const ipAddress = request.ip || request.connection.remoteAddress;
      const userAgent = request.get('User-Agent');

      // Check if endpoint allows public access
      const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);

      if (isPublic) {
        return true;
      }

      // Perform JWT validation
      const result = await super.canActivate(context);

      if (!result) {
        this.securityAuditService.logSecurityEvent({
          userId: 'unknown',
          eventType: 'unauthorized_access',
          ipAddress,
          userAgent,
          details: {
            endpoint: request.url,
            method: request.method,
            reason: 'jwt_validation_failed',
          },
          timestamp: new Date(),
        });
        return false;
      }

      // Additional security checks
      const user = request.user;
      if (user) {
        // Check if user account is active
        if (user.is_deleted || user.is_suspended) {
          this.securityAuditService.logSecurityEvent({
            userId: user._id?.toString() || 'unknown',
            eventType: 'unauthorized_access',
            ipAddress,
            userAgent,
            details: {
              endpoint: request.url,
              method: request.method,
              reason: user.is_deleted ? 'account_deleted' : 'account_suspended',
            },
            timestamp: new Date(),
          });
          throw new ForbiddenException('Account access restricted');
        }

        // Log successful authentication for monitoring
        this.logger.debug(
          `Authenticated user ${user._id} accessing ${request.method} ${request.url}`,
        );
      }

      return true;
    } catch (error) {
      const ipAddress = request.ip || request.connection.remoteAddress;
      const userAgent = request.get('User-Agent');

      this.securityAuditService.logSecurityEvent({
        userId: 'unknown',
        eventType: 'authentication_error',
        ipAddress,
        userAgent,
        details: {
          endpoint: request.url,
          method: request.method,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      });

      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent');

    if (info?.name === 'TokenExpiredError') {
      this.securityAuditService.logSecurityEvent({
        userId: user?._id?.toString() || 'unknown',
        eventType: 'token_expired',
        ipAddress,
        userAgent,
        details: {
          endpoint: request.url,
          method: request.method,
          tokenType: 'access_token',
        },
        timestamp: new Date(),
      });
      throw new UnauthorizedException({
        message: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString(),
      });
    }

    if (info?.name === 'JsonWebTokenError') {
      this.securityAuditService.logSecurityEvent({
        userId: 'unknown',
        eventType: 'invalid_token',
        ipAddress,
        userAgent,
        details: {
          endpoint: request.url,
          method: request.method,
          reason: 'malformed_token',
        },
        timestamp: new Date(),
      });
      throw new UnauthorizedException({
        message: 'Invalid token',
        errorCode: 'INVALID_TOKEN',
        timestamp: new Date().toISOString(),
      });
    }

    if (err || !user) {
      this.securityAuditService.logSecurityEvent({
        userId: 'unknown',
        eventType: 'authentication_failed',
        ipAddress,
        userAgent,
        details: {
          endpoint: request.url,
          method: request.method,
          error: err?.message || 'User not found',
        },
        timestamp: new Date(),
      });
      throw new UnauthorizedException({
        message: 'Authentication failed',
        errorCode: 'AUTH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }

    return user;
  }
}
