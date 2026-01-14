/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { User, UserDocument } from '../user/entities/user.entity';
import { Ride, RideDocument } from '../ride/entities/ride.entity';
import { Session, SessionDocument } from '../user/entities/session.entity';
import {
  Notification,
  NotificationDocument,
} from '../entities/notification.entity';

export interface DataAccessRequest {
  userId: string;
  requestedUserId: string;
  dataType: 'profile' | 'rides' | 'location' | 'notifications';
  purpose: string;
}

export interface DataDeletionRequest {
  userId: string;
  dataTypes: string[];
  keepAnonymized: boolean;
}

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
}

@Injectable()
export class PrivacyService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private configService: ConfigService,
  ) {
    // Get encryption key from environment or generate a default one
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      crypto.scryptSync('default-key', 'salt', 32).toString('hex');
  }

  /**
   * Validate data access permissions
   */
  async validateDataAccess(request: DataAccessRequest): Promise<boolean> {
    const { userId, requestedUserId, dataType } = request;

    // Users can always access their own data
    if (userId === requestedUserId) {
      return true;
    }

    // Check if user is admin
    const user = await this.userModel.findById(userId);
    if (user?.role === 'ADMIN') {
      return true;
    }

    // For ride data, check if user is involved in the ride (as passenger or driver)
    if (dataType === 'rides') {
      const hasRideAccess = await this.checkRideAccess(userId, requestedUserId);
      if (hasRideAccess) {
        return true;
      }
    }

    // For location data, only allow access during active rides
    if (dataType === 'location') {
      const hasLocationAccess = await this.checkLocationAccess(
        userId,
        requestedUserId,
      );
      if (hasLocationAccess) {
        return true;
      }
    }

    // Default deny
    return false;
  }

  /**
   * Encrypt sensitive data
   */
  encryptSensitiveData(data: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex');
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
      };
    } catch (error) {
      throw new BadRequestException('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData: string, iv: string): string {
    try {
      const key = Buffer.from(this.encryptionKey, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new BadRequestException('Failed to decrypt data');
    }
  }

  /**
   * Anonymize user data while preserving analytics
   */
  async anonymizeUserData(userId: string): Promise<void> {
    const anonymizedId = `anon_${crypto.randomBytes(8).toString('hex')}`;
    const anonymizedEmail = `${anonymizedId}@anonymized.local`;

    // Anonymize user profile
    await this.userModel.findByIdAndUpdate(userId, {
      first_name: 'Anonymous',
      last_name: 'User',
      email: anonymizedEmail,
      phone_number: null,
      country_code: null,
      password: '', // Clear password
      auth0_sub: null, // Clear Auth0 identifier
      profile_image: null,
      aadhar_front: null,
      aadhar_back: null,
      dl_front: null,
      dl_back: null,
      is_deleted: true,
      updated_at: Date.now(),
    });

    // Anonymize ride data - keep ride records for analytics but remove personal info
    await this.rideModel.updateMany(
      { user_id: new Types.ObjectId(userId) },
      {
        $unset: {
          'pickup_location.address': 1,
          'destination_location.address': 1,
          user_feedback: 1,
        },
        updated_at: new Date(),
      },
    );

    // Delete sessions
    await this.sessionModel.deleteMany({ user_id: new Types.ObjectId(userId) });

    // Delete notifications
    await this.notificationModel.deleteMany({
      user_id: new Types.ObjectId(userId),
    });
  }

  /**
   * Complete data deletion (GDPR right to be forgotten)
   */
  async deleteUserData(request: DataDeletionRequest): Promise<void> {
    const { userId, dataTypes, keepAnonymized } = request;

    if (keepAnonymized) {
      await this.anonymizeUserData(userId);
      return;
    }

    // Complete deletion
    if (dataTypes.includes('profile') || dataTypes.includes('all')) {
      await this.userModel.findByIdAndDelete(userId);
    }

    if (dataTypes.includes('rides') || dataTypes.includes('all')) {
      await this.rideModel.deleteMany({ user_id: new Types.ObjectId(userId) });
    }

    if (dataTypes.includes('sessions') || dataTypes.includes('all')) {
      await this.sessionModel.deleteMany({
        user_id: new Types.ObjectId(userId),
      });
    }

    if (dataTypes.includes('notifications') || dataTypes.includes('all')) {
      await this.notificationModel.deleteMany({
        user_id: new Types.ObjectId(userId),
      });
    }
  }

  /**
   * Get user's data export (GDPR data portability)
   */
  async exportUserData(userId: string): Promise<any> {
    // Validate user exists and is requesting their own data
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get user profile (excluding sensitive fields)
    const userProfile = await this.userModel
      .findById(userId, {
        password: 0,
        otp: 0,
        auth0_sub: 0,
      })
      .lean();

    // Get ride history
    const rides = await this.rideModel
      .find(
        { user_id: new Types.ObjectId(userId) },
        {
          user_id: 0, // Exclude internal IDs
          driver_id: 0,
        },
      )
      .lean();

    // Get notifications
    const notifications = await this.notificationModel
      .find(
        { user_id: new Types.ObjectId(userId) },
        {
          user_id: 0,
          driver_id: 0,
        },
      )
      .lean();

    return {
      profile: userProfile,
      rides: rides,
      notifications: notifications,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Filter user data based on access permissions
   */
  async filterUserDataByPermissions(
    data: any,
    requestingUserId: string,
    targetUserId: string,
  ): Promise<any> {
    const hasAccess = await this.validateDataAccess({
      userId: requestingUserId,
      requestedUserId: targetUserId,
      dataType: 'profile',
      purpose: 'data_access',
    });

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to user data');
    }

    // If requesting own data, return full data
    if (requestingUserId === targetUserId) {
      return data;
    }

    // For other users, return limited data
    return {
      _id: data._id,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      // Exclude sensitive fields
    };
  }

  /**
   * Check if user has access to ride data
   */
  private async checkRideAccess(
    userId: string,
    targetUserId: string,
  ): Promise<boolean> {
    // Check if users have shared rides (as passenger and driver)
    const sharedRides = await this.rideModel.findOne({
      $or: [
        {
          user_id: new Types.ObjectId(userId),
          driver_id: new Types.ObjectId(targetUserId),
        },
        {
          user_id: new Types.ObjectId(targetUserId),
          driver_id: new Types.ObjectId(userId),
        },
      ],
    });

    return !!sharedRides;
  }

  /**
   * Check if user has access to location data
   */
  private async checkLocationAccess(
    userId: string,
    targetUserId: string,
  ): Promise<boolean> {
    // Check if users have an active ride together
    const activeRide = await this.rideModel.findOne({
      $or: [
        {
          user_id: new Types.ObjectId(userId),
          driver_id: new Types.ObjectId(targetUserId),
        },
        {
          user_id: new Types.ObjectId(targetUserId),
          driver_id: new Types.ObjectId(userId),
        },
      ],
      status: {
        $in: [
          'driver_assigned',
          'driver_arriving',
          'driver_arrived',
          'in_progress',
        ],
      },
    });

    return !!activeRide;
  }

  /**
   * Encrypt user's sensitive fields in database
   */
  async encryptUserSensitiveFields(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updates: any = {};

    // Encrypt phone number if exists
    if (user.phone_number) {
      const encrypted = this.encryptSensitiveData(user.phone_number);
      updates.phone_number = encrypted.encryptedData;
      updates.phone_number_iv = encrypted.iv;
    }

    // Encrypt email if exists
    if (user.email) {
      const encrypted = this.encryptSensitiveData(user.email);
      updates.email = encrypted.encryptedData;
      updates.email_iv = encrypted.iv;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = Date.now();
      await this.userModel.findByIdAndUpdate(userId, updates);
    }
  }

  /**
   * Audit data access for security monitoring
   */
  async auditDataAccess(
    request: DataAccessRequest,
    granted: boolean,
  ): Promise<void> {
    // Log data access attempts for security monitoring
    console.log(
      `Data Access Audit: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        requestingUser: request.userId,
        targetUser: request.requestedUserId,
        dataType: request.dataType,
        purpose: request.purpose,
        granted: granted,
      })}`,
    );

    // In production, this would be sent to a proper audit logging system
    // such as AWS CloudTrail, ELK stack, or similar
  }
}
