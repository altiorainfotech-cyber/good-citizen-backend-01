/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from '../../user/entities/session.entity';
import { User, UserDocument } from '../../user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';

export interface LegacySessionData {
  user_id: string;
  token: string;
  device_type?: string;
  fcm_token?: string;
  created_at?: number;
}

export interface SessionMigrationResult {
  success: boolean;
  message: string;
  migratedSessions: number;
  invalidSessions: number;
  errors: string[];
}

/**
 * Service to handle backward compatibility for existing sessions
 * Requirements: 19.5 - Implement graceful handling of existing sessions
 */
@Injectable()
export class SessionCompatibilityService {
  private readonly logger = new Logger(SessionCompatibilityService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  /**
   * Migrate legacy sessions to new format
   * Requirements: 19.5 - Implement graceful handling of existing sessions
   */
  async migrateLegacySessions(
    legacySessions: LegacySessionData[],
  ): Promise<SessionMigrationResult> {
    this.logger.log(
      `Starting migration of ${legacySessions.length} legacy sessions`,
    );

    let migratedSessions = 0;
    let invalidSessions = 0;
    const errors: string[] = [];

    for (const legacySession of legacySessions) {
      try {
        // Validate legacy session data
        if (!legacySession.user_id || !legacySession.token) {
          invalidSessions++;
          errors.push(`Invalid session data: missing user_id or token`);
          continue;
        }

        // Check if user exists
        const user = await this.userModel.findById(legacySession.user_id);
        if (!user) {
          invalidSessions++;
          errors.push(`User not found for session: ${legacySession.user_id}`);
          continue;
        }

        // Validate JWT token
        let tokenPayload;
        try {
          tokenPayload = this.jwtService.decode(legacySession.token);
        } catch (error) {
          invalidSessions++;
          errors.push(
            `Invalid JWT token for user ${legacySession.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          continue;
        }

        // Check if session already exists
        const existingSession = await this.sessionModel.findOne({
          user_id: new Types.ObjectId(legacySession.user_id),
          device_type: legacySession.device_type || 'WEB',
        });

        if (existingSession) {
          // Update existing session
          await this.sessionModel.updateOne(
            { _id: existingSession._id },
            {
              $set: {
                refresh_token: legacySession.token,
                fcm_token: legacySession.fcm_token,
                last_activity: new Date(),
                updated_at: Date.now(),
              },
            },
          );
        } else {
          // Create new session
          const newSession = new this.sessionModel({
            user_id: new Types.ObjectId(legacySession.user_id),
            role: user.role,
            refresh_token: legacySession.token,
            device_type: legacySession.device_type || 'WEB',
            fcm_token: legacySession.fcm_token,
            last_activity: new Date(),
            created_at: legacySession.created_at || Date.now(),
            updated_at: Date.now(),
          });

          await newSession.save();
        }

        migratedSessions++;
        this.logger.debug(
          `Migrated session for user: ${legacySession.user_id}`,
        );
      } catch (error) {
        invalidSessions++;
        const errorMsg = `Failed to migrate session for user ${legacySession.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    const result: SessionMigrationResult = {
      success: invalidSessions === 0,
      message: `Session migration completed: ${migratedSessions} migrated, ${invalidSessions} invalid`,
      migratedSessions,
      invalidSessions,
      errors,
    };

    this.logger.log(result.message);
    return result;
  }

  /**
   * Validate and refresh legacy tokens
   * Requirements: 19.5 - Implement graceful handling of existing sessions
   */
  async validateLegacyToken(
    token: string,
  ): Promise<{ valid: boolean; user?: any; needsRefresh?: boolean }> {
    try {
      // Try to decode the token
      const payload = this.jwtService.decode(token);

      if (!payload || !payload.sub) {
        return { valid: false };
      }

      // Check if user exists
      const user = await this.userModel.findById(payload.sub);
      if (!user) {
        return { valid: false };
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp && payload.exp < now;

      if (isExpired) {
        return {
          valid: false,
          user: user.toObject(),
          needsRefresh: true,
        };
      }

      // Token is valid
      return {
        valid: true,
        user: user.toObject(),
      };
    } catch (error) {
      this.logger.error(
        `Error validating legacy token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { valid: false };
    }
  }

  /**
   * Clean up expired legacy sessions
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    try {
      // Delete sessions older than 30 days with no recent activity
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await this.sessionModel.deleteMany({
        $or: [
          { last_activity: { $lt: thirtyDaysAgo } },
          {
            last_activity: { $exists: false },
            created_at: { $lt: thirtyDaysAgo.getTime() },
          },
        ],
      });

      this.logger.log(`Cleaned up ${result.deletedCount} expired sessions`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error(
        `Error cleaning up expired sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { deletedCount: 0 };
    }
  }

  /**
   * Update session activity for legacy compatibility
   */
  async updateSessionActivity(
    userId: string,
    deviceType: string = 'WEB',
  ): Promise<void> {
    try {
      await this.sessionModel.updateOne(
        {
          user_id: new Types.ObjectId(userId),
          device_type: deviceType,
        },
        {
          $set: {
            last_activity: new Date(),
            updated_at: Date.now(),
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error updating session activity for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get active sessions for a user (for legacy compatibility)
   */
  async getUserSessions(userId: string): Promise<SessionDocument[]> {
    try {
      return await this.sessionModel
        .find({
          user_id: new Types.ObjectId(userId),
        })
        .sort({ last_activity: -1 });
    } catch (error) {
      this.logger.error(
        `Error getting user sessions for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Convert session to legacy format for backward compatibility
   */
  convertToLegacyFormat(session: SessionDocument): any {
    return {
      session_id: session._id.toString(),
      user_id: session.user_id.toString(),
      device_type: session.device_type,
      fcm_token: session.fcm_token,
      last_activity: session.last_activity,
      created_at: session.created_at,
    };
  }

  /**
   * Handle session upgrade from legacy to new format
   */
  async upgradeSession(
    sessionId: string,
    newData: Partial<SessionDocument>,
  ): Promise<boolean> {
    try {
      const result = await this.sessionModel.updateOne(
        { _id: new Types.ObjectId(sessionId) },
        {
          $set: {
            ...newData,
            updated_at: Date.now(),
          },
        },
      );

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(
        `Error upgrading session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
