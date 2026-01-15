/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { UserType } from '../utils';
import { SecurityAuditService } from '../../authentication/security-audit.service';

interface AuthenticatedRequest {
  user?: {
    _id: string;
    role: UserType;
    email?: string;
  };
  params: any;
  query: any;
  body: any;
  ip: string;
  connection: any;
  get: (name: string) => string | undefined;
  url: string;
  method: string;
}

@Injectable()
export class UserDataAccessMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UserDataAccessMiddleware.name);

  constructor(private securityAuditService: SecurityAuditService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const user = req.user;

    // Skip if no user (will be handled by auth guards)
    if (!user) {
      return next();
    }

    // Extract user ID from various possible locations in the request
    const requestedUserId = this.extractUserIdFromRequest(req);

    // If no user ID is being requested, allow access
    if (!requestedUserId) {
      return next();
    }

    // Admin users can access any user data
    if (user.role === UserType.ADMIN) {
      this.logger.debug(
        `Admin ${user._id} accessing user data for ${requestedUserId}`,
      );
      return next();
    }

    // Users can only access their own data
    if (user._id.toString() !== requestedUserId) {
      this.logUnauthorizedDataAccess(req, user._id, requestedUserId);

      throw new ForbiddenException({
        message: 'Access denied: You can only access your own data',
        errorCode: 'DATA_ACCESS_DENIED',
        requestedUserId,
        authenticatedUserId: user._id,
        timestamp: new Date().toISOString(),
      });
    }

    // Log successful data access for monitoring
    this.logger.debug(`User ${user._id} accessing own data`);
    next();
  }

  private extractUserIdFromRequest(req: AuthenticatedRequest): string | null {
    // Check URL parameters
    if (req.params.id && this.isValidObjectId(req.params.id)) {
      return req.params.id;
    }

    if (req.params.userId && this.isValidObjectId(req.params.userId)) {
      return req.params.userId;
    }

    // Check query parameters
    if (req.query.userId && this.isValidObjectId(req.query.userId as string)) {
      return req.query.userId as string;
    }

    if (
      req.query.user_id &&
      this.isValidObjectId(req.query.user_id as string)
    ) {
      return req.query.user_id as string;
    }

    // Check request body
    if (req.body?.userId && this.isValidObjectId(req.body.userId)) {
      return req.body.userId;
    }

    if (req.body?.user_id && this.isValidObjectId(req.body.user_id)) {
      return req.body.user_id;
    }

    return null;
  }

  private isValidObjectId(id: string): boolean {
    // Basic MongoDB ObjectId validation
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  private logUnauthorizedDataAccess(
    req: AuthenticatedRequest,
    authenticatedUserId: string,
    requestedUserId: string,
  ): void {
    const ipAddress = req.ip || req.connection?.remoteAddress || undefined;
    const userAgent = req.get('User-Agent') || undefined;

    this.securityAuditService.logSecurityEvent({
      userId: authenticatedUserId,
      eventType: 'unauthorized_data_access',
      ...(ipAddress && { ipAddress }),
      ...(userAgent && { userAgent }),
      details: {
        authenticatedUserId,
        requestedUserId,
        endpoint: req.url,
        method: req.method,
        reason: 'cross_user_data_access_attempt',
      },
      timestamp: new Date(),
    });
  }
}
