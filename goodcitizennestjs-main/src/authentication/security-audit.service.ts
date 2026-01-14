/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from '../user/entities/session.entity';

export interface SecurityEvent {
  userId: string;
  sessionId?: string;
  eventType:
    | 'login'
    | 'logout'
    | 'token_refresh'
    | 'invalid_token'
    | 'session_expired'
    | 'suspicious_activity'
    | 'unauthorized_admin_access'
    | 'unauthorized_access'
    | 'authentication_error'
    | 'token_expired'
    | 'authentication_failed'
    | 'mass_token_revocation'
    | 'unauthorized_data_access';
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  timestamp: Date;
}

export interface BlacklistedToken {
  token: string;
  userId: string;
  sessionId: string;
  blacklistedAt: Date;
  expiresAt: Date;
  reason: string;
}

@Injectable()
export class SecurityAuditService {
  private blacklistedTokens = new Map<string, BlacklistedToken>();

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {
    // Clean up expired blacklisted tokens every hour
    setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000);
  }

  /**
   * Add token to blacklist
   */
  blacklistToken(
    token: string,
    userId: string,
    sessionId: string,
    reason: string = 'logout',
  ): void {
    const blacklistedToken: BlacklistedToken = {
      token: token,
      userId: userId,
      sessionId: sessionId,
      blacklistedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      reason: reason,
    };

    this.blacklistedTokens.set(token, blacklistedToken);

    // Log the blacklisting event
    this.logSecurityEvent({
      userId: userId,
      sessionId: sessionId,
      eventType: 'logout',
      details: { reason: reason, tokenBlacklisted: true },
      timestamp: new Date(),
    });
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(token: string): boolean {
    const blacklistedToken = this.blacklistedTokens.get(token);

    if (!blacklistedToken) {
      return false;
    }

    // Check if token has expired
    if (blacklistedToken.expiresAt < new Date()) {
      this.blacklistedTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Blacklist all tokens for a user (logout all sessions)
   */
  async blacklistAllUserTokens(
    userId: string,
    reason: string = 'logout_all',
  ): Promise<void> {
    const sessions = await this.sessionModel.find({
      user_id: new Types.ObjectId(userId),
    });

    for (const session of sessions) {
      if (session.refresh_token) {
        this.blacklistToken(
          session.refresh_token,
          userId,
          session._id.toString(),
          reason,
        );
      }
    }

    // Log the mass blacklisting event
    this.logSecurityEvent({
      userId: userId,
      eventType: 'logout',
      details: {
        reason: reason,
        tokensBlacklisted: sessions.length,
        massLogout: true,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Log security events for audit trail
   */
  logSecurityEvent(event: SecurityEvent): void {
    const logEntry = {
      timestamp: event.timestamp.toISOString(),
      userId: event.userId,
      sessionId: event.sessionId,
      eventType: event.eventType,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: event.details,
    };

    // In production, this would be sent to a proper logging system
    // such as AWS CloudWatch, ELK stack, or similar
    console.log(`Security Audit: ${JSON.stringify(logEntry)}`);

    // Store critical events in database for investigation
    if (this.isCriticalEvent(event.eventType)) {
      this.storeCriticalEvent(logEntry);
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(
    userId: string,
    ipAddress?: string,
  ): Promise<boolean> {
    // This is a simplified implementation
    // In production, this would analyze patterns like:
    // - Multiple failed login attempts
    // - Login from unusual locations
    // - Rapid token refresh requests
    // - Access patterns that don't match user behavior

    const recentEvents = this.getRecentSecurityEvents(userId, 15); // Last 15 minutes

    // Check for multiple failed attempts
    const failedAttempts = recentEvents.filter(
      (event) =>
        event.eventType === 'invalid_token' ||
        (event.details && event.details.failed === true),
    );

    if (failedAttempts.length >= 5) {
      this.logSecurityEvent({
        userId: userId,
        eventType: 'suspicious_activity',
        ipAddress: ipAddress || 'unknown',
        details: {
          reason: 'multiple_failed_attempts',
          count: failedAttempts.length,
          timeWindow: '15_minutes',
        },
        timestamp: new Date(),
      });
      return true;
    }

    return false;
  }

  /**
   * Clean up expired blacklisted tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [token, blacklistedToken] of this.blacklistedTokens.entries()) {
      if (blacklistedToken.expiresAt < now) {
        expiredTokens.push(token);
      }
    }

    expiredTokens.forEach((token) => this.blacklistedTokens.delete(token));

    if (expiredTokens.length > 0) {
// console.log removed
    }
  }

  /**
   * Public method to clean up expired blacklisted tokens
   */
  async cleanupExpiredBlacklistedTokens(): Promise<void> {
    this.cleanupExpiredTokens();
  }

  /**
   * Check if event type is critical and needs database storage
   */
  private isCriticalEvent(eventType: string): boolean {
    const criticalEvents = [
      'suspicious_activity',
      'invalid_token',
      'session_expired',
    ];
    return criticalEvents.includes(eventType);
  }

  /**
   * Store critical security events in database
   */
  private async storeCriticalEvent(logEntry: any): Promise<void> {
    // In a real implementation, this would store in a security_events collection
    // For now, we'll just log it with a special marker
    console.log(`CRITICAL_SECURITY_EVENT: ${JSON.stringify(logEntry)}`);
  }

  /**
   * Get recent security events for a user (in-memory cache)
   */
  private getRecentSecurityEvents(
    _userId: string,
    _minutes: number,
  ): SecurityEvent[] {
    // This is a simplified implementation using in-memory storage
    // In production, this would query a proper security events database
    // const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    // For now, return empty array as we don't have persistent storage
    // In real implementation, this would query the security events collection
    return [];
  }

  /**
   * Get blacklisted tokens count for monitoring
   */
  getBlacklistedTokensCount(): number {
    return this.blacklistedTokens.size;
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): any {
    return {
      blacklistedTokensCount: this.blacklistedTokens.size,
      lastCleanup: new Date().toISOString(),
      // In production, this would include more comprehensive stats
    };
  }
}
