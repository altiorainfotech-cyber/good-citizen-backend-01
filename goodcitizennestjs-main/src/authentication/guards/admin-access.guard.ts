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

export interface AdminPermission {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'manage';
}

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

    // Check if user exists and is admin
    if (!user || user.role !== UserType.ADMIN) {
      this.logUnauthorizedAdminAccess(
        request,
        user?._id?.toString() || 'unknown',
        'not_admin',
      );

      throw new ForbiddenException({
        message: 'Administrative access required',
        errorCode: 'ADMIN_ACCESS_REQUIRED',
        userRole: user?.role || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }

    // Get required admin permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<
      AdminPermission[]
    >('adminPermissions', [context.getHandler(), context.getClass()]);

    // If no specific permissions are required, allow any admin
    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.debug(`Admin ${user._id} accessing administrative endpoint`);
      return true;
    }

    // Check if admin has required permissions
    const hasPermissions = this.checkAdminPermissions(
      user,
      requiredPermissions,
    );

    if (!hasPermissions) {
      this.logUnauthorizedAdminAccess(
        request,
        user._id?.toString() || 'unknown',
        'insufficient_admin_permissions',
        {
          requiredPermissions,
          userPermissions: user.permissions || [],
          endpoint: request.url,
        },
      );

      throw new ForbiddenException({
        message: 'Insufficient administrative permissions',
        errorCode: 'INSUFFICIENT_ADMIN_PERMISSIONS',
        requiredPermissions,
        timestamp: new Date().toISOString(),
      });
    }

    // Log successful admin access
    this.logger.log(
      `Admin ${user._id} (${user.email}) accessed ${request.method} ${request.url}`,
    );

    return true;
  }

  private checkAdminPermissions(
    user: any,
    requiredPermissions: AdminPermission[],
  ): boolean {
    // For now, we'll implement a simple permission system
    // In a more complex system, you might have granular permissions stored in the user object

    // Super admin has all permissions
    if (user.isSuperAdmin || user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Check if user has specific permissions (if implemented in user schema)
    if (user.permissions && Array.isArray(user.permissions)) {
      return requiredPermissions.every((required) =>
        user.permissions.some(
          (permission: any) =>
            permission.resource === required.resource &&
            (permission.action === required.action ||
              permission.action === 'manage'),
        ),
      );
    }

    // Default: all admins have basic permissions
    // You can customize this based on your permission model
    const basicAdminResources = ['users', 'rides', 'reports', 'settings'];
    const restrictedResources = ['system', 'security', 'billing'];

    return requiredPermissions.every((permission) => {
      if (restrictedResources.includes(permission.resource)) {
        return user.isSuperAdmin || false;
      }
      return basicAdminResources.includes(permission.resource);
    });
  }

  private logUnauthorizedAdminAccess(
    request: any,
    userId: string,
    reason: string,
    additionalDetails?: any,
  ): void {
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent');

    this.securityAuditService.logSecurityEvent({
      userId,
      eventType: 'unauthorized_admin_access',
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
