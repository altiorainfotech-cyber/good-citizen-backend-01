/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/require-await */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { SecurityAuditService } from './security-audit.service';

export class LogoutAllSessionsDto {
  confirmationText: string;
}

export class SecurityStatsDto {
  includeDetails?: boolean = false;
}

@ApiTags('Security & Session Management')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  @Post('logout-all-sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout from all sessions and invalidate all tokens',
  })
  @ApiResponse({
    status: 204,
    description: 'All sessions logged out successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid confirmation text' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAllSessions(
    @Request() req: any,
    @Body() dto: LogoutAllSessionsDto,
  ) {
    const userId = req.user._id;

    // Validate confirmation text for security
    if (dto.confirmationText !== 'LOGOUT ALL SESSIONS') {
      throw new Error(
        'Invalid confirmation text. Please type "LOGOUT ALL SESSIONS" to confirm.',
      );
    }

    await this.authService.logoutAllSessions(userId);

    return {
      message: 'All sessions logged out successfully',
      loggedOutAt: new Date().toISOString(),
    };
  }

  @Get('active-sessions')
  @ApiOperation({ summary: 'Get information about active sessions' })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveSessions(@Request() req: any) {
    const userId = req.user._id;

    // This would typically query the session model for active sessions
    // For now, we'll return basic information
    return {
      message: 'Active sessions information',
      userId: userId,
      currentSession: req.user.session_id,
      retrievedAt: new Date().toISOString(),
      // In a real implementation, this would include:
      // - List of active sessions with device info
      // - Last activity timestamps
      // - IP addresses and locations
    };
  }

  @Get('security-stats')
  @ApiOperation({ summary: 'Get security statistics and audit information' })
  @ApiResponse({
    status: 200,
    description: 'Security statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSecurityStats(@Request() req: any, @Body() dto: SecurityStatsDto) {
    const userId = req.user._id;

    const stats = this.securityAuditService.getSecurityStats();

    return {
      userId: userId,
      securityStats: stats,
      includeDetails: dto.includeDetails || false,
      retrievedAt: new Date().toISOString(),
    };
  }

  @Post('check-suspicious-activity')
  @ApiOperation({ summary: 'Check for suspicious activity patterns' })
  @ApiResponse({
    status: 200,
    description: 'Suspicious activity check completed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkSuspiciousActivity(@Request() req: any) {
    const userId = req.user._id;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const isSuspicious =
      await this.securityAuditService.detectSuspiciousActivity(
        userId,
        ipAddress,
      );

    return {
      userId: userId,
      isSuspicious: isSuspicious,
      checkedAt: new Date().toISOString(),
      ipAddress: ipAddress,
    };
  }

  @Delete('invalidate-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate current access token' })
  @ApiResponse({ status: 204, description: 'Token invalidated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async invalidateCurrentToken(@Request() req: any) {
    const userId = req.user._id;
    const sessionId = req.user.session_id;

    // Blacklist the current token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      this.securityAuditService.blacklistToken(
        token,
        userId,
        sessionId,
        'user_requested_invalidation',
      );
    }

    return {
      message: 'Token invalidated successfully',
      invalidatedAt: new Date().toISOString(),
    };
  }

  @Get('blacklisted-tokens-count')
  @ApiOperation({ summary: 'Get count of blacklisted tokens (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Blacklisted tokens count retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getBlacklistedTokensCount(@Request() req: any) {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    const count = this.securityAuditService.getBlacklistedTokensCount();

    return {
      blacklistedTokensCount: count,
      retrievedAt: new Date().toISOString(),
    };
  }

  @Post('audit-log')
  @ApiOperation({ summary: 'Log a security event for audit trail' })
  @ApiResponse({
    status: 200,
    description: 'Security event logged successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logSecurityEvent(@Request() req: any, @Body() eventData: any) {
    const userId = req.user._id;
    const sessionId = req.user.session_id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    this.securityAuditService.logSecurityEvent({
      userId: userId,
      sessionId: sessionId,
      eventType: eventData.eventType || 'custom_event',
      ipAddress: ipAddress,
      userAgent: userAgent,
      details: eventData.details || {},
      timestamp: new Date(),
    });

    return {
      message: 'Security event logged successfully',
      loggedAt: new Date().toISOString(),
    };
  }
}
