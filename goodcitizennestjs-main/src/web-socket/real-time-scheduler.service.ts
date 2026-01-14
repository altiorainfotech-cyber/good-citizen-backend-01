/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RealTimeUpdatesService } from './real-time-updates.service';
import { SocketGateway } from './web-socket.gateway';
import { PerformanceService } from '../common/performance.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AmbulanceProvider,
  AmbulanceProviderDocument,
} from '../explore/entities/ambulance-provider.entity';
import {
  HealthcareFacility,
  HealthcareFacilityDocument,
} from '../explore/entities/healthcare-facility.entity';

@Injectable()
export class RealTimeSchedulerService {
  private readonly logger = new Logger(RealTimeSchedulerService.name);

  constructor(
    private readonly realTimeUpdatesService: RealTimeUpdatesService,
    private readonly socketGateway: SocketGateway,
    private readonly performanceService: PerformanceService,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
    @InjectModel(HealthcareFacility.name)
    private healthcareFacilityModel: Model<HealthcareFacilityDocument>,
  ) {}

  /**
   * Clean up inactive WebSocket connections and subscriptions every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupInactiveConnections(): Promise<void> {
    try {
      this.logger.debug(
        'Starting cleanup of inactive connections and subscriptions',
      );

      // Clean up inactive WebSocket connections
      await this.socketGateway.cleanupInactiveConnections();

      // Clean up inactive real-time subscriptions
      await this.realTimeUpdatesService.cleanupInactiveSubscriptions();

      // Clean up expired cache entries
      this.performanceService.clearCache('expired_');

      this.logger.debug(
        'Completed cleanup of inactive connections and subscriptions',
      );
    } catch (error) {
      this.logger.error('Error during cleanup of inactive connections:', error);
    }
  }

  /**
   * Update ambulance availability status every 2 minutes
   * This simulates real-world ambulance status updates
   */
  @Cron('0 */2 * * * *') // Every 2 minutes
  async updateAmbulanceAvailability(): Promise<void> {
    try {
      this.logger.debug('Starting ambulance availability updates');

      // Get all active ambulances
      const ambulances = await this.ambulanceProviderModel
        .find({ isActive: true })
        .limit(10) // Limit to prevent overwhelming the system
        .lean();

      for (const ambulance of ambulances) {
        try {
          // Simulate availability changes (80% chance to remain same, 20% to change)
          const shouldUpdate = Math.random() < 0.2;

          if (shouldUpdate) {
            const newAvailability = !ambulance.availability;

            // Simulate response time changes
            const responseTimeVariation = (Math.random() - 0.5) * 10; // ±5 minutes
            const newResponseTime = Math.max(
              5,
              Math.min(
                60,
                (ambulance.responseTime || 15) + responseTimeVariation,
              ),
            );

            await this.realTimeUpdatesService.updateAmbulanceAvailability(
              ambulance._id.toString(),
              newAvailability,
              ambulance.location
                ? {
                    latitude: ambulance.location.coordinates[1],
                    longitude: ambulance.location.coordinates[0],
                  }
                : undefined,
              Math.round(newResponseTime),
            );

            this.logger.debug(
              `Updated ambulance ${ambulance._id} availability: ${newAvailability}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error updating ambulance ${ambulance._id}:`,
            error,
          );
        }
      }

      this.logger.debug('Completed ambulance availability updates');
    } catch (error) {
      this.logger.error('Error during ambulance availability updates:', error);
    }
  }

  /**
   * Update healthcare facility status every 10 minutes
   * This simulates real-world facility capacity and status changes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateHealthcareFacilityStatus(): Promise<void> {
    try {
      this.logger.debug('Starting healthcare facility status updates');

      // Get all active healthcare facilities
      const facilities = await this.healthcareFacilityModel
        .find({
          isActive: true,
          type: { $in: ['hospital', 'clinic', 'emergency_center'] },
        })
        .limit(20) // Limit to prevent overwhelming the system
        .lean();

      for (const facility of facilities) {
        try {
          // Simulate status changes based on time of day and random factors
          const currentHour = new Date().getHours();
          let status: 'available' | 'busy' | 'offline' | 'emergency' =
            'available';
          let capacity = 80;

          // Simulate capacity variations based on time of day
          if (currentHour >= 8 && currentHour <= 12) {
            capacity = Math.floor(Math.random() * 30) + 50; // 50-80% during morning hours
            status = capacity > 70 ? 'available' : 'busy';
          } else if (currentHour >= 13 && currentHour <= 17) {
            capacity = Math.floor(Math.random() * 40) + 40; // 40-80% during afternoon
            status = capacity > 60 ? 'available' : 'busy';
          } else if (currentHour >= 18 && currentHour <= 22) {
            capacity = Math.floor(Math.random() * 20) + 30; // 30-50% during evening
            status = capacity > 40 ? 'busy' : 'emergency';
          } else {
            capacity = Math.floor(Math.random() * 50) + 50; // 50-100% during night/early morning
            status = capacity > 70 ? 'available' : 'busy';
          }

          // Small chance of emergency status
          if (Math.random() < 0.05) {
            status = 'emergency';
            capacity = Math.floor(Math.random() * 20) + 10; // 10-30% during emergency
          }

          // Simulate estimated wait time based on capacity
          const estimatedWaitTime = Math.round((100 - capacity) * 0.5); // 0-45 minutes

          // Only update if facility has valid location
          if (
            facility.location &&
            facility.location.coordinates &&
            facility.location.coordinates.length >= 2
          ) {
            await this.realTimeUpdatesService.updateEmergencyServiceStatus(
              facility._id.toString(),
              'hospital',
              status,
              {
                capacity,
                estimatedWaitTime,
                location: {
                  latitude: facility.location.coordinates[1],
                  longitude: facility.location.coordinates[0],
                },
              },
            );
          } else {
            // Update without location if not available
            await this.realTimeUpdatesService.updateEmergencyServiceStatus(
              facility._id.toString(),
              'hospital',
              status,
              {
                capacity,
                estimatedWaitTime,
              },
            );
          }

          this.logger.debug(
            `Updated facility ${facility._id} status: ${status} (${capacity}% capacity)`,
          );
        } catch (error) {
          this.logger.error(`Error updating facility ${facility._id}:`, error);
        }
      }

      this.logger.debug('Completed healthcare facility status updates');
    } catch (error) {
      this.logger.error(
        'Error during healthcare facility status updates:',
        error,
      );
    }
  }

  /**
   * Send heartbeat to all connected clients every minute
   * This helps maintain connection quality and detect disconnections
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendHeartbeat(): Promise<void> {
    try {
      const connectedUsers = this.socketGateway.getConnectedUsersCount();

      if (connectedUsers > 0) {
        // Send heartbeat to all connected clients
        await this.socketGateway.broadcastToAll('heartbeat', {
          serverTime: new Date().toISOString(),
          connectedUsers,
          timestamp: new Date().toISOString(),
        });

        this.logger.debug(
          `Sent heartbeat to ${connectedUsers} connected users`,
        );
      }
    } catch (error) {
      this.logger.error('Error sending heartbeat:', error);
    }
  }

  /**
   * Log real-time system statistics every 15 minutes
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async logSystemStatistics(): Promise<void> {
    try {
      const connectionStats = this.realTimeUpdatesService.getConnectionStats();
      const cacheStats = this.performanceService.getCacheStats();

      this.logger.log('Real-time system statistics:', {
        connectedUsers: connectionStats.connectedUsers,
        locationSubscriptions: connectionStats.locationSubscriptions,
        emergencySubscriptions: connectionStats.emergencySubscriptions,
        totalSubscriptions: connectionStats.totalSubscriptions,
        cacheSize: cacheStats.size,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error logging system statistics:', error);
    }
  }

  /**
   * Validate and optimize database indexes every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async validateDatabasePerformance(): Promise<void> {
    try {
      this.logger.debug('Starting database performance validation');

      const performanceMetrics =
        await this.performanceService.validateQueryPerformance();

      if (!performanceMetrics.indexesOptimal) {
        this.logger.warn(
          'Database performance is suboptimal:',
          performanceMetrics,
        );

        // Trigger index optimization if performance is poor
        if (
          performanceMetrics.driverMatchingTime > 200 ||
          performanceMetrics.emergencyPathTime > 100
        ) {
          this.logger.log(
            'Triggering database optimization due to poor performance',
          );
          // Note: In production, this should be done carefully during low-traffic periods
          // await this.performanceService.optimizeGeospatialIndexes();
        }
      } else {
        this.logger.debug(
          'Database performance is optimal:',
          performanceMetrics,
        );
      }
    } catch (error) {
      this.logger.error('Error during database performance validation:', error);
    }
  }

  /**
   * Clean up old notification cache entries every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupNotificationCache(): Promise<void> {
    try {
      this.logger.debug('Starting notification cache cleanup');

      // Clear location-based cache entries older than 5 minutes
      this.performanceService.clearCache('drivers_');
      this.performanceService.clearCache('emergency_path_');
      this.performanceService.clearCache('hospitals_');
      this.performanceService.clearCache('ambulances_');
      this.performanceService.clearCache('blood_banks_');

      this.logger.debug('Completed notification cache cleanup');
    } catch (error) {
      this.logger.error('Error during notification cache cleanup:', error);
    }
  }

  /**
   * Manual method to trigger immediate cleanup (for testing or emergency situations)
   */
  async triggerImmediateCleanup(): Promise<void> {
    try {
      this.logger.log(
        'Triggering immediate cleanup of all real-time resources',
      );

      await Promise.all([
        this.cleanupInactiveConnections(),
        this.cleanupNotificationCache(),
      ]);

      this.logger.log('Completed immediate cleanup');
    } catch (error) {
      this.logger.error('Error during immediate cleanup:', error);
      throw error;
    }
  }

  /**
   * Get current scheduler status and statistics
   */
  getSchedulerStatus(): {
    isActive: boolean;
    lastCleanup: Date;
    connectionStats: any;
    cacheStats: any;
  } {
    try {
      return {
        isActive: true,
        lastCleanup: new Date(),
        connectionStats: this.realTimeUpdatesService.getConnectionStats(),
        cacheStats: this.performanceService.getCacheStats(),
      };
    } catch (error) {
      this.logger.error('Error getting scheduler status:', error);
      return {
        isActive: false,
        lastCleanup: new Date(),
        connectionStats: {
          connectedUsers: 0,
          locationSubscriptions: 0,
          emergencySubscriptions: 0,
          totalSubscriptions: 0,
        },
        cacheStats: { size: 0, keys: [] },
      };
    }
  }
}
