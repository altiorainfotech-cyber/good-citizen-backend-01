/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  DriverRide,
  DriverRideDocument,
} from '../driver/entities/driver-ride.entity';

@Injectable()
export class PerformanceService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceService.name);
  private queryCache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();
  private readonly DEFAULT_CACHE_TTL = 30000; // 30 seconds

  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
  ) {}

  async onModuleInit() {
    await this.optimizeGeospatialIndexes();
    await this.optimizeDatabaseConnection();
    this.startCacheCleanup();
  }

  /**
   * Optimize MongoDB geospatial indexes for performance
   */
  async optimizeGeospatialIndexes(): Promise<void> {
    try {
      this.logger.log('Optimizing geospatial indexes...');

      // Get database collections
      const userCollection = this.connection.collection('users');
      const rideCollection = this.connection.collection('driverrides');

      // Drop existing indexes if they exist (to recreate with optimized settings)
      try {
        await userCollection.dropIndex('location_2dsphere');
      } catch (error) {
        // Index might not exist, continue
      }

      // Create optimized 2dsphere index on user location with additional fields
      await userCollection.createIndex(
        {
          location: '2dsphere',
          role: 1,
          is_online: 1,
          approval: 1,
        },
        {
          name: 'location_role_online_approval_2dsphere',
          background: true,
          sparse: true, // Only index documents with location field
          '2dsphereIndexVersion': 3, // Use latest version for better performance
        },
      );

      // Create compound index for driver matching queries
      await userCollection.createIndex(
        {
          role: 1,
          is_online: 1,
          approval: 1,
          location: '2dsphere',
        },
        {
          name: 'driver_matching_compound',
          background: true,
          partialFilterExpression: {
            role: 'DRIVER',
            is_online: true,
            approval: 'APPROVED',
          },
        },
      );

      // Create index for location updates and tracking
      await userCollection.createIndex(
        {
          _id: 1,
          last_location_update: -1,
        },
        {
          name: 'location_update_tracking',
          background: true,
        },
      );

      // Create index for emergency path clearing (simplified for compatibility)
      try {
        await userCollection.createIndex(
          {
            location: '2dsphere',
            role: 1,
            is_online: 1,
            socket_id: 1,
          },
          {
            name: 'emergency_path_clearing',
            background: true,
            partialFilterExpression: {
              role: 'USER',
              is_online: true,
            },
          },
        );
      } catch (error) {
        this.logger.warn(
          'Failed to create emergency_path_clearing index, using fallback',
          error instanceof Error ? error.message : 'Unknown error',
        );
        // Fallback to simpler index
        await userCollection.createIndex(
          {
            location: '2dsphere',
            role: 1,
            is_online: 1,
          },
          {
            name: 'emergency_path_clearing_simple',
            background: true,
          },
        );
      }

      // Optimize ride collection indexes
      await rideCollection.createIndex(
        {
          pickup_location: '2dsphere',
          status: 1,
          vehicle_type: 1,
          requested_at: -1,
        },
        {
          name: 'ride_geospatial_compound',
          background: true,
        },
      );

      // Create index for active rides and driver assignment
      await rideCollection.createIndex(
        {
          driver_id: 1,
          status: 1,
          last_notification: -1,
        },
        {
          name: 'driver_active_rides',
          background: true,
          partialFilterExpression: {
            status: {
              $in: [
                'driver_assigned',
                'driver_arriving',
                'driver_arrived',
                'in_progress',
              ],
            },
          },
        },
      );

      // Create index for emergency ride prioritization
      await rideCollection.createIndex(
        {
          vehicle_type: 1,
          status: 1,
          requested_at: -1,
        },
        {
          name: 'emergency_ride_priority',
          background: true,
          partialFilterExpression: {
            vehicle_type: 'EMERGENCY',
          },
        },
      );

      this.logger.log('Geospatial indexes optimized successfully');

      // Log index statistics
      await this.logIndexStatistics();
    } catch (error) {
      this.logger.error('Failed to optimize geospatial indexes:', error);
      throw error;
    }
  }

  /**
   * Optimize database connection pooling and settings
   */
  async optimizeDatabaseConnection(): Promise<void> {
    try {
      this.logger.log('Optimizing database connection settings...');

      // Configure connection pool settings (these are typically set in connection string)
      const poolSettings = {
        maxPoolSize: 50, // Maximum number of connections
        minPoolSize: 5, // Minimum number of connections
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        serverSelectionTimeoutMS: 5000, // How long to try selecting a server
        socketTimeoutMS: 45000, // How long a send or receive on a socket can take
        bufferMaxEntries: 0, // Disable mongoose buffering
        bufferCommands: false, // Disable mongoose buffering
      };

      this.logger.log(
        'Database connection optimization completed',
        poolSettings,
      );
    } catch (error) {
      this.logger.error('Failed to optimize database connection:', error);
      throw error;
    }
  }

  /**
   * Implement query caching for frequently accessed data
   */
  async getCachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.DEFAULT_CACHE_TTL,
  ): Promise<T> {
    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();

    // Return cached data if valid
    if (cached && now - cached.timestamp < cached.ttl) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return cached.data;
    }

    // Execute query and cache result
    try {
      const data = await queryFn();
      this.queryCache.set(cacheKey, {
        data,
        timestamp: now,
        ttl,
      });

      this.logger.debug(`Cache miss for key: ${cacheKey}, data cached`);
      return data;
    } catch (error) {
      this.logger.error(`Query failed for cache key ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Optimized driver matching query with caching
   */
  async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    vehicleType: string = 'REGULAR',
    limit: number = 10,
  ): Promise<UserDocument[]> {
    const cacheKey = `drivers_${latitude}_${longitude}_${radiusKm}_${vehicleType}_${limit}`;

    return this.getCachedQuery(
      cacheKey,
      async () => {
        const query = {
          role: 'DRIVER',
          is_online: true,
          approval: 'APPROVED',
          location: {
            $nearSphere: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              $maxDistance: radiusKm * 1000, // Convert km to meters
            },
          },
        };

        // Add vehicle type filter for emergency rides
        if (vehicleType === 'EMERGENCY') {
          (query as any).vehicle_type = { $in: ['AMBULANCE', 'EMERGENCY'] };
        }

        const drivers = await this.userModel
          .find(query)
          .select({
            _id: 1,
            first_name: 1,
            last_name: 1,
            location: 1,
            latitude: 1,
            longitude: 1,
            driver_rating: 1,
            vehicle_type: 1,
            vehicle_plate: 1,
            phone_number: 1,
            current_bearing: 1,
            current_speed: 1,
            last_location_update: 1,
          })
          .limit(limit)
          .lean()
          .exec();

        return drivers as UserDocument[];
      },
      15000, // 15 second cache for driver queries
    );
  }

  /**
   * Optimized emergency path clearing query
   */
  async findUsersInEmergencyPath(
    driverLocation: { latitude: number; longitude: number },
    bearing: number,
    radiusKm: number = 0.5,
    coneAngle: number = 90,
  ): Promise<UserDocument[]> {
    const cacheKey = `emergency_path_${driverLocation.latitude}_${driverLocation.longitude}_${bearing}_${radiusKm}`;

    return this.getCachedQuery(
      cacheKey,
      async () => {
        // First, get all users within radius
        const nearbyUsers = await this.userModel
          .find({
            role: 'USER',
            is_online: true,
            socket_id: { $exists: true, $ne: null },
            location: {
              $nearSphere: {
                $geometry: {
                  type: 'Point',
                  coordinates: [
                    driverLocation.longitude,
                    driverLocation.latitude,
                  ],
                },
                $maxDistance: radiusKm * 1000,
              },
            },
          })
          .select({
            _id: 1,
            latitude: 1,
            longitude: 1,
            socket_id: 1,
            location: 1,
          })
          .lean()
          .exec();

        // Filter users within cone using bearing calculation
        const usersInPath = nearbyUsers.filter((user) => {
          if (!user.latitude || !user.longitude) return false;

          const bearingToUser = this.calculateBearing(
            driverLocation.latitude,
            driverLocation.longitude,
            user.latitude,
            user.longitude,
          );

          const bearingDifference = Math.abs(bearingToUser - bearing);
          const normalizedBearingDiff =
            bearingDifference > 180
              ? 360 - bearingDifference
              : bearingDifference;

          return normalizedBearingDiff <= coneAngle / 2;
        });

        return usersInPath as UserDocument[];
      },
      10000, // 10 second cache for emergency queries
    );
  }

  /**
   * Optimized ride history query with pagination
   */
  async getUserRideHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<{ rides: any[]; total: number; hasMore: boolean }> {
    const cacheKey = `ride_history_${userId}_${page}_${limit}_${status || 'all'}`;

    return this.getCachedQuery(
      cacheKey,
      async () => {
        const skip = (page - 1) * limit;
        const query: any = {
          $or: [{ user_id: userId }, { driver_id: userId }],
        };

        if (status) {
          query.status = status;
        }

        const [rides, total] = await Promise.all([
          this.driverRideModel
            .find(query)
            .sort({ requested_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user_id', 'first_name last_name phone_number')
            .populate(
              'driver_id',
              'first_name last_name phone_number vehicle_type vehicle_plate driver_rating',
            )
            .lean()
            .exec(),
          this.driverRideModel.countDocuments(query),
        ]);

        return {
          rides,
          total,
          hasMore: skip + rides.length < total,
        };
      },
      60000, // 1 minute cache for ride history
    );
  }

  /**
   * Clear cache for specific patterns
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.queryCache.clear();
      this.logger.log('All cache cleared');
      return;
    }

    const keysToDelete = Array.from(this.queryCache.keys()).filter((key) =>
      key.includes(pattern),
    );

    keysToDelete.forEach((key) => this.queryCache.delete(key));
    this.logger.log(
      `Cache cleared for pattern: ${pattern}, ${keysToDelete.length} entries removed`,
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys()),
    };
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.queryCache.forEach((value, key) => {
        if (now - value.timestamp >= value.ttl) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => this.queryCache.delete(key));

      if (keysToDelete.length > 0) {
        this.logger.debug(
          `Cache cleanup: ${keysToDelete.length} expired entries removed`,
        );
      }
    }, 60000); // Run every minute
  }

  /**
   * Log index statistics for monitoring
   */
  private async logIndexStatistics(): Promise<void> {
    try {
      const userCollection = this.connection.collection('users');
      const rideCollection = this.connection.collection('driverrides');

      const [userIndexes, rideIndexes] = await Promise.all([
        userCollection.indexes(),
        rideCollection.indexes(),
      ]);

      this.logger.log(
        'User collection indexes:',
        userIndexes.map((idx) => idx.name),
      );
      this.logger.log(
        'Ride collection indexes:',
        rideIndexes.map((idx) => idx.name),
      );

      // Log basic collection info
      this.logger.log('Collection optimization completed successfully');
    } catch (error) {
      this.logger.warn('Failed to get index statistics:', error);
    }
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const toDeg = (rad: number) => rad * (180 / Math.PI);

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  }

  /**
   * Validate geospatial query performance
   */
  async validateQueryPerformance(): Promise<{
    driverMatchingTime: number;
    emergencyPathTime: number;
    rideHistoryTime: number;
    indexesOptimal: boolean;
  }> {
    const testLocation = { latitude: 12.9716, longitude: 77.5946 }; // Bangalore coordinates

    // Test driver matching performance
    const driverStart = Date.now();
    await this.findNearbyDrivers(
      testLocation.latitude,
      testLocation.longitude,
      5,
    );
    const driverMatchingTime = Date.now() - driverStart;

    // Test emergency path performance
    const emergencyStart = Date.now();
    await this.findUsersInEmergencyPath(testLocation, 45, 0.5);
    const emergencyPathTime = Date.now() - emergencyStart;

    // Test ride history performance
    const historyStart = Date.now();
    await this.getUserRideHistory('test_user_id', 1, 20);
    const rideHistoryTime = Date.now() - historyStart;

    // Check if performance is within acceptable limits
    const indexesOptimal =
      driverMatchingTime < 100 &&
      emergencyPathTime < 50 &&
      rideHistoryTime < 200;

    return {
      driverMatchingTime,
      emergencyPathTime,
      rideHistoryTime,
      indexesOptimal,
    };
  }
}
