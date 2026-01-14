/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import moment from 'moment';

import { Session, SessionDocument } from '../user/entities/session.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { SecurityAuditService } from './security-audit.service';

export interface TokenValidationResult {
  isValid: boolean;
  user?: UserDocument;
  session?: SessionDocument;
  reason?: string;
  shouldRefresh?: boolean;
}

export interface TokenRefreshResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

@Injectable()
export class TokenLifecycleService {
  private readonly logger = new Logger(TokenLifecycleService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private securityAuditService: SecurityAuditService,
  ) {}

  /**
   * Validate token and check if it needs refresh
   */
  async validateTokenLifecycle(token: string): Promise<TokenValidationResult> {
    try {
      // Decode token without verification to check expiry
      const decoded = this.jwtService.decode(token);

      if (!decoded) {
        return { isValid: false, reason: 'invalid_token' };
      }

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;

      // Check if token is expired
      if (timeUntilExpiry <= 0) {
        return {
          isValid: false,
          reason: 'token_expired',
          shouldRefresh: true,
        };
      }

      // Check if token is close to expiry (within 5 minutes)
      const shouldRefresh = timeUntilExpiry < 300; // 5 minutes

      // Verify token signature
      let payload;
      try {
        payload = this.jwtService.verify(token, {
          secret:
            this.configService.get<string>('JWT_ACCESS_SECRET') ||
            'default-secret',
        });
      } catch (error) {
        return { isValid: false, reason: 'invalid_signature' };
      }

      // Check if token is blacklisted
      if (this.securityAuditService.isTokenBlacklisted(token)) {
        return { isValid: false, reason: 'token_blacklisted' };
      }

      // Validate user and session
      const user = await this.userModel.findById(payload._id);
      if (!user || user.is_deleted) {
        return { isValid: false, reason: 'user_not_found' };
      }

      const session = await this.sessionModel.findById(payload.session_id);
      if (!session) {
        return { isValid: false, reason: 'session_not_found' };
      }

      return {
        isValid: true,
        user,
        session,
        shouldRefresh,
      };
    } catch (error) {
      this.logger.error(
        `Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { isValid: false, reason: 'validation_error' };
    }
  }

  /**
   * Refresh access token with enhanced security
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      // Validate refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'default-refresh-secret',
      });

      // Find session
      const session = await this.sessionModel.findById(payload.session_id);
      if (!session || session.refresh_token !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Find user
      const user = await this.userModel.findById(session.user_id);
      if (!user || user.is_deleted) {
        throw new UnauthorizedException('User not found');
      }

      // Check if refresh token is close to expiry
      const decoded = this.jwtService.decode(refreshToken);
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;

      // Generate new tokens
      const newTokens = await this.generateTokenPair(user, session._id);

      // Update session with new refresh token (token rotation)
      await this.sessionModel.findByIdAndUpdate(session._id, {
        refresh_token: newTokens.refresh_token,
        updated_at: moment().utc().valueOf(),
      });

      // Blacklist old refresh token
      this.securityAuditService.blacklistToken(
        refreshToken,
        user._id.toString(),
        session._id.toString(),
        'token_refresh',
      );

      // Log token refresh
      this.securityAuditService.logSecurityEvent({
        userId: user._id.toString(),
        sessionId: session._id.toString(),
        eventType: 'token_refresh',
        details: {
          oldTokenExpiry: decoded.exp,
          newTokenGenerated: true,
          rotationApplied: true,
        },
        timestamp: new Date(),
      });

      const expiresIn = this.getTokenExpirySeconds();

      return {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: expiresIn,
        token_type: 'Bearer',
      };
    } catch (error) {
      this.logger.error(
        `Token refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(
    userId: string,
    reason: string = 'user_request',
  ): Promise<void> {
    try {
      // Get all user sessions
      const sessions = await this.sessionModel.find({ user_id: userId });

      // Blacklist all refresh tokens
      for (const session of sessions) {
        if (session.refresh_token) {
          this.securityAuditService.blacklistToken(
            session.refresh_token,
            userId,
            session._id.toString(),
            reason,
          );
        }
      }

      // Delete all sessions
      await this.sessionModel.deleteMany({ user_id: userId });

      // Update user status
      await this.userModel.findByIdAndUpdate(userId, {
        is_online: false,
        socket_id: null,
        updated_at: moment().utc().valueOf(),
      });

      // Log mass token revocation
      this.securityAuditService.logSecurityEvent({
        userId,
        eventType: 'mass_token_revocation',
        details: {
          reason,
          sessionsRevoked: sessions.length,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      });

      this.logger.log(
        `Revoked ${sessions.length} tokens for user ${userId} (reason: ${reason})`,
      );
    } catch (error) {
      this.logger.error(
        `Error revoking tokens for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Clean up expired tokens and sessions (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const expiredThreshold = moment().subtract(7, 'days').utc().valueOf();

      // Find expired sessions
      const expiredSessions = await this.sessionModel.find({
        updated_at: { $lt: expiredThreshold },
      });

      if (expiredSessions.length > 0) {
        // Blacklist refresh tokens from expired sessions
        for (const session of expiredSessions) {
          if (session.refresh_token) {
            this.securityAuditService.blacklistToken(
              session.refresh_token,
              session.user_id.toString(),
              session._id.toString(),
              'session_expired',
            );
          }
        }

        // Delete expired sessions
        await this.sessionModel.deleteMany({
          updated_at: { $lt: expiredThreshold },
        });

        this.logger.log(
          `Cleaned up ${expiredSessions.length} expired sessions`,
        );
      }

      // Clean up old blacklisted tokens (older than 30 days)
      await this.securityAuditService.cleanupExpiredBlacklistedTokens();
    } catch (error) {
      this.logger.error(
        `Token cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get token expiry time in seconds
   */
  private getTokenExpirySeconds(): number {
    const expiryString =
      this.configService.get<string>('JWT_ACCESS_EXPIRY') || '1h';

    // Parse expiry string (e.g., '1h', '30m', '1d')
    const match = expiryString.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1] || '1');
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }

  /**
   * Generate new token pair
   */
  private async generateTokenPair(
    user: UserDocument,
    sessionId: any,
  ): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const payload = {
      _id: user._id,
      email: user.email,
      role: user.role,
      session_id: sessionId,
    };

    const access_token = this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') || 'default-secret',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY') || '1h',
    });

    const refresh_token = this.jwtService.sign(
      { session_id: sessionId },
      {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'default-refresh-secret',
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d',
      },
    );

    return { access_token, refresh_token };
  }
}
