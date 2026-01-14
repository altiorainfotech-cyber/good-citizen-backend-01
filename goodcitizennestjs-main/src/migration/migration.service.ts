/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Session, SessionDocument } from '../user/entities/session.entity';
import { Ride, RideDocument } from '../ride/entities/ride.entity';

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: string[];
}

export interface LegacyUserData {
  _id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  country_code?: string;
  password?: string;
  role?: string;
  location?: {
    type: string;
    coordinates: [number, number];
  };
  latitude?: number;
  longitude?: number;
  is_online?: boolean;
  is_email_verified?: boolean;
  loyalty_point?: number;
  created_at?: number;
  updated_at?: number;
  // Driver-specific legacy fields
  vehicle_type?: string;
  vehicle_plate?: string;
  approval?: string;
  driver_rating?: number;
  total_rides?: number;
}

export interface LegacyRideData {
  _id?: string;
  user_id?: string;
  driver_id?: string;
  pickup_location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  destination_location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status?: string;
  vehicle_type?: string;
  estimated_fare?: number;
  final_fare?: number;
  requested_at?: Date;
  completed_at?: Date;
  created_at?: Date;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
  ) {}

  /**
   * Migrate user data from legacy prototype system
   * Requirements: 19.1 - Preserve user accounts, preferences, and ride history
   */
  async migrateUserData(
    legacyUsers: LegacyUserData[],
  ): Promise<MigrationResult> {
    this.logger.log(
      `Starting user data migration for ${legacyUsers.length} users`,
    );

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const legacyUser of legacyUsers) {
      try {
        // Check if user already exists
        const existingUser = await this.userModel.findOne({
          $or: [
            { email: legacyUser.email },
            {
              phone_number: legacyUser.phone_number,
              country_code: legacyUser.country_code,
            },
          ],
        });

        if (existingUser) {
          this.logger.warn(
            `User already exists: ${legacyUser.email || legacyUser.phone_number}`,
          );
          skippedCount++;
          continue;
        }

        // Create new user with migrated data
        const newUser = new this.userModel({
          _id: legacyUser._id
            ? new Types.ObjectId(legacyUser._id)
            : new Types.ObjectId(),
          first_name: legacyUser.first_name || '',
          last_name: legacyUser.last_name || '',
          email: legacyUser.email,
          phone_number: legacyUser.phone_number,
          country_code: legacyUser.country_code,
          password: legacyUser.password || '', // Should already be hashed
          role: legacyUser.role || 'USER',
          location: legacyUser.location || {
            type: 'Point',
            coordinates: [0, 0],
          },
          pre_location: legacyUser.location || {
            type: 'Point',
            coordinates: [0, 0],
          },
          latitude: legacyUser.latitude || 0,
          longitude: legacyUser.longitude || 0,
          is_online: legacyUser.is_online || false,
          is_email_verified: legacyUser.is_email_verified || false,
          loyalty_point: legacyUser.loyalty_point || 0,
          created_at: legacyUser.created_at || Date.now(),
          updated_at: legacyUser.updated_at || Date.now(),
          // Driver-specific fields
          vehicle_type: legacyUser.vehicle_type,
          vehicle_plate: legacyUser.vehicle_plate,
          approval: legacyUser.approval,
          driver_rating: legacyUser.driver_rating || 0,
          total_rides: legacyUser.total_rides || 0,
        });

        await newUser.save();
        migratedCount++;
        this.logger.log(
          `Migrated user: ${legacyUser.email || legacyUser.phone_number}`,
        );
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Failed to migrate user ${legacyUser.email || legacyUser.phone_number}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    const result: MigrationResult = {
      success: errorCount === 0,
      message: `User migration completed: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`,
      migratedCount,
      skippedCount,
      errorCount,
      errors: errors,
    };

    this.logger.log(result.message);
    return result;
  }

  /**
   * Migrate ride history from legacy system
   * Requirements: 19.1 - Preserve ride history
   */
  async migrateRideHistory(
    legacyRides: LegacyRideData[],
  ): Promise<MigrationResult> {
    this.logger.log(
      `Starting ride history migration for ${legacyRides.length} rides`,
    );

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const legacyRide of legacyRides) {
      try {
        // Check if ride already exists
        const existingRide = await this.rideModel.findById(legacyRide._id);
        if (existingRide) {
          this.logger.warn(`Ride already exists: ${legacyRide._id}`);
          skippedCount++;
          continue;
        }

        // Validate user and driver exist
        const user = await this.userModel.findById(legacyRide.user_id);
        if (!user) {
          throw new Error(`User not found: ${legacyRide.user_id}`);
        }

        let driver = null;
        if (legacyRide.driver_id) {
          driver = await this.userModel.findById(legacyRide.driver_id);
          if (!driver) {
            this.logger.warn(
              `Driver not found for ride ${legacyRide._id}: ${legacyRide.driver_id}`,
            );
          }
        }

        // Create new ride with migrated data
        const newRide = new this.rideModel({
          _id: legacyRide._id
            ? new Types.ObjectId(legacyRide._id)
            : new Types.ObjectId(),
          user_id: new Types.ObjectId(legacyRide.user_id),
          driver_id: legacyRide.driver_id
            ? new Types.ObjectId(legacyRide.driver_id)
            : undefined,
          pickup_location: legacyRide.pickup_location || {
            latitude: 0,
            longitude: 0,
          },
          destination_location: legacyRide.destination_location || {
            latitude: 0,
            longitude: 0,
          },
          status: this.mapLegacyRideStatus(legacyRide.status),
          vehicle_type:
            legacyRide.vehicle_type === 'AMBULANCE' ? 'EMERGENCY' : 'REGULAR',
          estimated_fare: legacyRide.estimated_fare || 0,
          final_fare: legacyRide.final_fare,
          requested_at:
            legacyRide.requested_at || legacyRide.created_at || new Date(),
          ride_completed_at: legacyRide.completed_at,
          created_at: legacyRide.created_at || new Date(),
          updated_at: new Date(),
        });

        await newRide.save();
        migratedCount++;
        this.logger.log(`Migrated ride: ${legacyRide._id}`);
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Failed to migrate ride ${legacyRide._id}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    const result: MigrationResult = {
      success: errorCount === 0,
      message: `Ride migration completed: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`,
      migratedCount,
      skippedCount,
      errorCount,
      errors: errors,
    };

    this.logger.log(result.message);
    return result;
  }

  /**
   * Create geospatial indexes for location-based queries
   * Requirements: 19.4 - Migrate existing location data to new format
   */
  async createGeospatialIndexes(): Promise<MigrationResult> {
    this.logger.log('Creating geospatial indexes for location data');

    try {
      // Create 2dsphere index on user location
      await this.userModel.collection.createIndex({ location: '2dsphere' });
      this.logger.log('Created 2dsphere index on User.location');

      // Create compound indexes for efficient driver matching
      await this.userModel.collection.createIndex({
        location: '2dsphere',
        role: 1,
        is_online: 1,
        approval: 1,
      });
      this.logger.log('Created compound index for driver matching');

      // Create indexes for ride queries
      await this.rideModel.collection.createIndex({
        user_id: 1,
        created_at: -1,
      });
      await this.rideModel.collection.createIndex({ driver_id: 1, status: 1 });
      await this.rideModel.collection.createIndex({
        status: 1,
        vehicle_type: 1,
      });
      this.logger.log('Created ride query indexes');

      // Create session indexes
      await this.sessionModel.collection.createIndex({
        user_id: 1,
        device_type: 1,
      });
      await this.sessionModel.collection.createIndex({ refresh_token: 1 });
      this.logger.log('Created session indexes');

      return {
        success: true,
        message: 'Geospatial indexes created successfully',
        migratedCount: 0,
        skippedCount: 0,
        errorCount: 0,
      };
    } catch (error: any) {
      const errorMsg = `Failed to create geospatial indexes: ${error.message}`;
      this.logger.error(errorMsg);

      return {
        success: false,
        message: errorMsg,
        migratedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Update existing location data to use GeoJSON format
   * Requirements: 19.4 - Migrate existing location data to new format
   */
  async migrateLocationData(): Promise<MigrationResult> {
    this.logger.log('Migrating location data to GeoJSON format');

    let migratedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      // Find users with old location format (latitude/longitude fields but no proper GeoJSON location)
      const usersToMigrate = await this.userModel.find({
        $or: [
          { location: { $exists: false } },
          { 'location.type': { $ne: 'Point' } },
          { 'location.coordinates': { $exists: false } },
        ],
        latitude: { $exists: true },
        longitude: { $exists: true },
      });

      this.logger.log(
        `Found ${usersToMigrate.length} users with location data to migrate`,
      );

      for (const user of usersToMigrate) {
        try {
          const longitude = user.longitude || 0;
          const latitude = user.latitude || 0;

          // Validate coordinates are within valid bounds
          if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            this.logger.warn(
              `Invalid coordinates for user ${user._id}: lat=${latitude}, lng=${longitude}`,
            );
            continue;
          }

          // Update location to GeoJSON format
          await this.userModel.updateOne(
            { _id: user._id },
            {
              $set: {
                location: {
                  type: 'Point',
                  coordinates: [longitude, latitude], // GeoJSON format: [longitude, latitude]
                },
                pre_location: {
                  type: 'Point',
                  coordinates: [longitude, latitude],
                },
              },
            },
          );

          migratedCount++;
          this.logger.log(`Migrated location data for user: ${user._id}`);
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Failed to migrate location for user ${user._id}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      const result: MigrationResult = {
        success: errorCount === 0,
        message: `Location migration completed: ${migratedCount} migrated, ${errorCount} errors`,
        migratedCount,
        skippedCount: 0,
        errorCount,
        errors: errors,
      };

      this.logger.log(result.message);
      return result;
    } catch (error: any) {
      const errorMsg = `Location migration failed: ${error.message}`;
      this.logger.error(errorMsg);

      return {
        success: false,
        message: errorMsg,
        migratedCount,
        skippedCount: 0,
        errorCount: errorCount + 1,
        errors: [...errors, errorMsg],
      };
    }
  }

  /**
   * Run all migration scripts in sequence
   */
  async runAllMigrations(legacyData?: {
    users?: LegacyUserData[];
    rides?: LegacyRideData[];
  }): Promise<MigrationResult[]> {
    this.logger.log('Starting complete data migration process');

    const results: MigrationResult[] = [];

    try {
      // 1. Create geospatial indexes first
      const indexResult = await this.createGeospatialIndexes();
      results.push(indexResult);

      // 2. Migrate location data format
      const locationResult = await this.migrateLocationData();
      results.push(locationResult);

      // 3. Migrate user data if provided
      if (legacyData?.users && legacyData.users.length > 0) {
        const userResult = await this.migrateUserData(legacyData.users);
        results.push(userResult);
      }

      // 4. Migrate ride history if provided
      if (legacyData?.rides && legacyData.rides.length > 0) {
        const rideResult = await this.migrateRideHistory(legacyData.rides);
        results.push(rideResult);
      }

      this.logger.log('Complete migration process finished');
      return results;
    } catch (error: any) {
      this.logger.error(`Migration process failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map legacy ride status to new enum values
   * Requirements: 19.6 - Map existing statuses to new values correctly
   */
  private mapLegacyRideStatus(legacyStatus?: string): string {
    const statusMap: Record<string, string> = {
      PENDING: 'REQUESTED',
      ACCEPTED: 'DRIVER_ASSIGNED',
      STARTED: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      DRIVER_ARRIVING: 'DRIVER_ARRIVING',
      DRIVER_ARRIVED: 'DRIVER_ARRIVED',
      // Default mappings
      requested: 'REQUESTED',
      driver_assigned: 'DRIVER_ASSIGNED',
      in_progress: 'IN_PROGRESS',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED',
    };

    return statusMap[legacyStatus || 'PENDING'] || 'REQUESTED';
  }

  /**
   * Validate migration data integrity
   */
  async validateMigration(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for users without proper location data
      const usersWithoutLocation = await this.userModel.countDocuments({
        $or: [
          { location: { $exists: false } },
          { 'location.type': { $ne: 'Point' } },
          { 'location.coordinates': { $exists: false } },
        ],
      });

      if (usersWithoutLocation > 0) {
        issues.push(`${usersWithoutLocation} users have invalid location data`);
      }

      // Check for rides with invalid user references
      const ridesWithInvalidUsers = await this.rideModel.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $match: { user: { $size: 0 } },
        },
        {
          $count: 'count',
        },
      ]);

      const invalidUserRides = ridesWithInvalidUsers[0]?.count || 0;
      if (invalidUserRides > 0) {
        issues.push(`${invalidUserRides} rides reference non-existent users`);
      }

      // Check for duplicate users
      const duplicateUsers = await this.userModel.aggregate([
        {
          $group: {
            _id: { email: '$email', phone_number: '$phone_number' },
            count: { $sum: 1 },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
        {
          $count: 'count',
        },
      ]);

      const duplicateCount = duplicateUsers[0]?.count || 0;
      if (duplicateCount > 0) {
        issues.push(`${duplicateCount} duplicate user records found`);
      }

      return {
        isValid: issues.length === 0,
        issues,
      };
    } catch (error: any) {
      issues.push(`Validation failed: ${error.message}`);
      return {
        isValid: false,
        issues,
      };
    }
  }
}
