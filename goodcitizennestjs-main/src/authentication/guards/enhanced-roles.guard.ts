/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '../../common/utils';
import { SecurityAuditService } from '../security-audit.service';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private securityAuditService: SecurityAuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Check if user exists
    if (!user) {
      this.logUnauthorizedAccess(request, 'no_user', 'unknown');
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has required role
    const hasRequiredRole = requiredRoles.includes(user.role);

    if (!hasRequiredRole) {
      this.logUnauthorizedAccess(
        request,
        'insufficient_permissions',
        user._id?.toString() || 'unknown',
        {
          userRole: user.role,
          requiredRoles,
          endpoint: request.url,
          method: request.method,
        },
      );

      throw new ForbiddenException({
        message: 'Insufficient permissions',
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      });
    }

    // Additional role-specific validations
    if (user.role === UserType.DRIVER) {
      // Check if driver is approved for certain endpoints
      if (
        this.requiresDriverApproval(context) &&
        user.approval !== 'APPROVED'
      ) {
        this.logUnauthorizedAccess(
          request,
          'driver_not_approved',
          user._id?.toString() || 'unknown',
          {
            driverApproval: user.approval,
            endpoint: request.url,
          },
        );

        throw new ForbiddenException({
          message: 'Driver account not approved',
          errorCode: 'DRIVER_NOT_APPROVED',
          approval: user.approval,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Log successful authorization for monitoring
    this.logger.debug(
      `User ${user._id} (${user.role}) authorized for ${request.method} ${request.url}`,
    );

    return true;
  }

  private requiresDriverApproval(context: ExecutionContext): boolean {
    // Check if endpoint requires driver approval
    const requiresApproval = this.reflector.getAllAndOverride<boolean>(
      'requiresDriverApproval',
      [context.getHandler(), context.getClass()],
    );

    return requiresApproval || false;
  }

  private logUnauthorizedAccess(
    request: any,
    reason: string,
    userId: string,
    additionalDetails?: any,
  ): void {
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent');

    this.securityAuditService.logSecurityEvent({
      userId,
      eventType: 'unauthorized_access',
      ipAddress,
      userAgent,
      details: {
        reason,
        endpoint: request.url,
        method: request.method,
        ...additionalDetails,
      },
      timestamp: new Date(),
    });
  }
}
