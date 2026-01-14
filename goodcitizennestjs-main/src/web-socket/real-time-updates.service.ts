/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/no-base-to-string */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SocketGateway } from './web-socket.gateway';
import { PerformanceService } from '../common/performance.service';
import { NotificationService } from '../common/notification.service';
import { WebSocketEventCompatibilityService } from '../common/websocket-event-compatibility.service';
import {
  AmbulanceProvider,
  AmbulanceProviderDocument,
} from '../explore/entities/ambulance-provider.entity';
import {
  HealthcareFacility,
  HealthcareFacilityDocument,
} from '../explore/entities/healthcare-facility.entity';
import {
  BloodBank,
  BloodBankDocument,
} from '../explore/entities/blood-bank.entity';
import {
  FacilityDetail,
  FacilityDetailDocument,
} from '../detail/entities/facility-detail.entity';
import { User, UserDocument } from '../user/entities/user.entity';

export interface AmbulanceAvailabilityUpdate {
  ambulanceId: string;
  availability: boolean;
  location?:
    | {
        latitude: number;
        longitude: number;
      }
    | undefined;
  responseTime?: number | undefined;
  lastUpdated: Date;
}

export interface EmergencyServiceStatusUpdate {
  serviceId: string;
  serviceType: 'ambulance' | 'hospital' | 'blood_bank' | 'emergency_contact';
  status: 'available' | 'busy' | 'offline' | 'emergency';
  capacity?: number;
  estimatedWaitTime?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  lastUpdated: Date;
}

export interface LocationDataUpdate {
  entityId: string;
  entityType: 'hospital' | 'ambulance' | 'blood_bank' | 'facility';
  location: {
    latitude: number;
    longitude: number;
  };
  metadata?: any;
  lastUpdated: Date;
}

@Injectable()
export class RealTimeUpdatesService {
  private readonly logger = new Logger(RealTimeUpdatesService.name);

  // Cache for tracking active subscriptions
  private locationSubscriptions = new Map<string, Set<string>>(); // userId -> Set of entityIds
  private emergencySubscriptions = new Map<string, Set<string>>(); // userId -> Set of serviceIds

  // Rate limiting for broadcasts
  private lastBroadcast = new Map<string, Date>();
  private readonly BROADCAST_RATE_LIMIT_MS = 1000; // 1 second minimum between broadcasts

  constructor(
    @Inject(forwardRef(() => SocketGateway))
    private readonly socketGateway: SocketGateway,
    private readonly performanceService: PerformanceService,
    private readonly notificationService: NotificationService,
    private readonly eventCompatibility: WebSocketEventCompatibilityService,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
    @InjectModel(HealthcareFacility.name)
    private healthcareFacilityModel: Model<HealthcareFacilityDocument>,
    @InjectModel(BloodBank.name)
    private bloodBankModel: Model<BloodBankDocument>,
    @InjectModel(FacilityDetail.name)
    private facilityDetailModel: Model<FacilityDetailDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Broadcast ambulance availability updates to connected clients
   */
  async broadcastAmbulanceAvailabilityUpdate(
    update: AmbulanceAvailabilityUpdate,
  ): Promise<void> {
    try {
      const broadcastKey = `ambulance_${update.ambulanceId}`;

      // Rate limiting check
      if (this.isRateLimited(broadcastKey)) {
        this.logger.debug(
          `Ambulance availability broadcast rate limited: ${update.ambulanceId}`,
        );
        return;
      }

      this.logger.log(
        `Broadcasting ambulance availability update: ${update.ambulanceId}`,
      );

      // Get ambulance details for broadcast
      const ambulance = await this.ambulanceProviderModel
        .findById(update.ambulanceId)
        .lean();
      if (!ambulance) {
        this.logger.warn(
          `Ambulance not found for broadcast: ${update.ambulanceId}`,
        );
        return;
      }

      // Create broadcast event using compatibility service
      const broadcastEvent =
        this.eventCompatibility.formatAmbulanceAvailabilityEvent(
          update.ambulanceId,
          update.availability,
          update.location
            ? {
                lat: update.location.latitude,
                long: update.location.longitude,
              }
            : undefined,
          {
            responseTime: update.responseTime,
            vehicleType: ambulance.vehicleType,
            services: ambulance.services,
            lastUpdated: update.lastUpdated,
          },
        );

      // Broadcast to all connected clients
      await this.socketGateway.broadcastToAll(
        broadcastEvent.event,
        broadcastEvent.data,
      );

      // Send targeted notifications to users who have subscribed to this ambulance
      await this.notifySubscribedUsers(
        'ambulance',
        update.ambulanceId,
        broadcastEvent,
      );

      // Update rate limiting
      this.lastBroadcast.set(broadcastKey, new Date());

      // Invalidate related cache entries
      this.invalidateLocationCache(update.location);
    } catch (error) {
      this.logger.error(
        `Error broadcasting ambulance availability update:`,
        error,
      );
    }
  }

  /**
   * Broadcast emergency service status changes
   */
  async broadcastEmergencyServiceStatusUpdate(
    update: EmergencyServiceStatusUpdate,
  ): Promise<void> {
    try {
      const broadcastKey = `emergency_${update.serviceId}_${update.serviceType}`;

      // Rate limiting check
      if (this.isRateLimited(broadcastKey)) {
        this.logger.debug(
          `Emergency service status broadcast rate limited: ${update.serviceId}`,
        );
        return;
      }

      this.logger.log(
        `Broadcasting emergency service status update: ${update.serviceId} (${update.serviceType})`,
      );

      // Create broadcast event using compatibility service
      const broadcastEvent =
        this.eventCompatibility.formatEmergencyServiceStatusEvent(
          update.serviceId,
          update.status,
          update.location
            ? {
                lat: update.location.latitude,
                long: update.location.longitude,
              }
            : undefined,
          update.estimatedWaitTime,
        );

      // Broadcast to all connected clients
      await this.socketGateway.broadcastToAll(
        broadcastEvent.event,
        broadcastEvent.data,
      );

      // Send high-priority notifications for critical status changes
      if (update.status === 'emergency' || update.status === 'offline') {
        await this.sendCriticalStatusNotifications(update);
      }

      // Send targeted notifications to subscribed users
      await this.notifySubscribedUsers(
        'emergency_service',
        update.serviceId,
        broadcastEvent,
      );

      // Update rate limiting
      this.lastBroadcast.set(broadcastKey, new Date());

      // Invalidate related cache entries
      this.invalidateServiceCache(update.serviceType, update.serviceId);
    } catch (error) {
      this.logger.error(
        `Error broadcasting emergency service status update:`,
        error,
      );
    }
  }

  /**
   * Handle location-based data updates and cache invalidation
   */
  async handleLocationDataUpdate(update: LocationDataUpdate): Promise<void> {
    try {
      this.logger.log(
        `Handling location data update: ${update.entityId} (${update.entityType})`,
      );

      // Update the entity's location in the database
      await this.updateEntityLocation(update);

      // Invalidate location-based cache entries
      this.invalidateLocationCache(update.location);

      // Create broadcast event for location update
      const broadcastEvent =
        this.eventCompatibility.formatEntityLocationUpdateEvent(
          update.entityId,
          update.entityType,
          {
            lat: update.location.latitude,
            long: update.location.longitude,
          },
          {
            metadata: update.metadata,
            lastUpdated: update.lastUpdated,
          },
        );

      // Broadcast to users in the vicinity
      await this.broadcastToNearbyUsers(update.location, broadcastEvent);

      // Update real-time capacity if it's a healthcare facility
      if (
        update.entityType === 'hospital' ||
        update.entityType === 'facility'
      ) {
        await this.updateRealTimeCapacity(update.entityId);
      }
    } catch (error) {
      this.logger.error(`Error handling location data update:`, error);
    }
  }

  /**
   * Subscribe user to real-time updates for specific entities
   */
  async subscribeToLocationUpdates(
    userId: string,
    entityIds: string[],
  ): Promise<void> {
    try {
      if (!this.locationSubscriptions.has(userId)) {
        this.locationSubscriptions.set(userId, new Set());
      }

      const userSubscriptions = this.locationSubscriptions.get(userId)!;
      entityIds.forEach((entityId) => userSubscriptions.add(entityId));

      this.logger.debug(
        `User ${userId} subscribed to location updates for ${entityIds.length} entities`,
      );
    } catch (error) {
      this.logger.error(`Error subscribing user to location updates:`, error);
    }
  }

  /**
   * Subscribe user to emergency service updates
   */
  async subscribeToEmergencyUpdates(
    userId: string,
    serviceIds: string[],
  ): Promise<void> {
    try {
      if (!this.emergencySubscriptions.has(userId)) {
        this.emergencySubscriptions.set(userId, new Set());
      }

      const userSubscriptions = this.emergencySubscriptions.get(userId)!;
      serviceIds.forEach((serviceId) => userSubscriptions.add(serviceId));

      this.logger.debug(
        `User ${userId} subscribed to emergency updates for ${serviceIds.length} services`,
      );
    } catch (error) {
      this.logger.error(`Error subscribing user to emergency updates:`, error);
    }
  }

  /**
   * Unsubscribe user from real-time updates
   */
  async unsubscribeFromUpdates(userId: string): Promise<void> {
    try {
      this.locationSubscriptions.delete(userId);
      this.emergencySubscriptions.delete(userId);

      this.logger.debug(
        `User ${userId} unsubscribed from all real-time updates`,
      );
    } catch (error) {
      this.logger.error(`Error unsubscribing user from updates:`, error);
    }
  }

  /**
   * Get real-time status for multiple ambulances
   */
  async getAmbulanceRealTimeStatus(
    ambulanceIds: string[],
  ): Promise<AmbulanceAvailabilityUpdate[]> {
    try {
      const ambulances = await this.ambulanceProviderModel
        .find({
          _id: { $in: ambulanceIds.map((id) => new Types.ObjectId(id)) },
        })
        .lean();

      return ambulances.map((ambulance) => ({
        ambulanceId: ambulance._id.toString(),
        availability: ambulance.availability || false,
        location:
          ambulance.location &&
          ambulance.location.coordinates &&
          ambulance.location.coordinates.length >= 2
            ? {
                latitude: ambulance.location.coordinates[1],
                longitude: ambulance.location.coordinates[0],
              }
            : undefined,
        responseTime: ambulance.responseTime || undefined,
        lastUpdated: (ambulance as any).updatedAt || new Date(),
      }));
    } catch (error) {
      this.logger.error(`Error getting ambulance real-time status:`, error);
      return [];
    }
  }

  /**
   * Update ambulance availability status
   */
  async updateAmbulanceAvailability(
    ambulanceId: string,
    availability: boolean,
    location?: { latitude: number; longitude: number },
    responseTime?: number,
  ): Promise<void> {
    try {
      const updateData: any = {
        availability,
        updatedAt: new Date(),
      };

      if (location) {
        updateData.location = {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        };
      }

      if (responseTime !== undefined) {
        updateData.responseTime = responseTime;
      }

      await this.ambulanceProviderModel.findByIdAndUpdate(
        ambulanceId,
        updateData,
      );

      // Broadcast the update
      const updatePayload: AmbulanceAvailabilityUpdate = {
        ambulanceId,
        availability,
        lastUpdated: new Date(),
      };

      if (location) {
        updatePayload.location = location;
      }

      if (responseTime !== undefined) {
        updatePayload.responseTime = responseTime;
      }

      await this.broadcastAmbulanceAvailabilityUpdate(updatePayload);
    } catch (error) {
      this.logger.error(`Error updating ambulance availability:`, error);
      throw error;
    }
  }

  /**
   * Update emergency service status
   */
  async updateEmergencyServiceStatus(
    serviceId: string,
    serviceType: 'ambulance' | 'hospital' | 'blood_bank' | 'emergency_contact',
    status: 'available' | 'busy' | 'offline' | 'emergency',
    additionalData?: {
      capacity?: number;
      estimatedWaitTime?: number;
      location?: { latitude: number; longitude: number };
    },
  ): Promise<void> {
    try {
      // Update the appropriate model based on service type
      const updateData: any = {
        updatedAt: new Date(),
      };

      switch (serviceType) {
        case 'ambulance':
          updateData.availability = status === 'available';
          if (additionalData?.location) {
            updateData.location = {
              type: 'Point',
              coordinates: [
                additionalData.location.longitude,
                additionalData.location.latitude,
              ],
            };
          }
          if (additionalData?.estimatedWaitTime !== undefined) {
            updateData.responseTime = additionalData.estimatedWaitTime;
          }
          await this.ambulanceProviderModel.findByIdAndUpdate(
            serviceId,
            updateData,
          );
          break;

        case 'hospital':
          updateData.isActive = status !== 'offline';
          if (additionalData?.capacity !== undefined) {
            updateData['metadata.capacity'] = additionalData.capacity;
          }
          await this.healthcareFacilityModel.findByIdAndUpdate(
            serviceId,
            updateData,
          );
          break;

        case 'blood_bank':
          updateData.isActive = status !== 'offline';
          await this.bloodBankModel.findByIdAndUpdate(serviceId, updateData);
          break;

        case 'emergency_contact':
          // Handle emergency contact updates if needed
          break;
      }

      // Broadcast the status update
      const updatePayload: EmergencyServiceStatusUpdate = {
        serviceId,
        serviceType,
        status,
        lastUpdated: new Date(),
      };

      if (additionalData?.capacity !== undefined) {
        updatePayload.capacity = additionalData.capacity;
      }

      if (additionalData?.estimatedWaitTime !== undefined) {
        updatePayload.estimatedWaitTime = additionalData.estimatedWaitTime;
      }

      if (additionalData?.location) {
        updatePayload.location = additionalData.location;
      }

      await this.broadcastEmergencyServiceStatusUpdate(updatePayload);
    } catch (error) {
      this.logger.error(`Error updating emergency service status:`, error);
      throw error;
    }
  }

  /**
   * Check if broadcast is rate limited
   */
  private isRateLimited(key: string): boolean {
    const lastBroadcast = this.lastBroadcast.get(key);
    if (!lastBroadcast) return false;

    return Date.now() - lastBroadcast.getTime() < this.BROADCAST_RATE_LIMIT_MS;
  }

  /**
   * Invalidate location-based cache entries
   */
  private invalidateLocationCache(location?: {
    latitude: number;
    longitude: number;
  }): void {
    if (!location) return;

    // Clear cache entries related to this location
    this.performanceService.clearCache('drivers_');
    this.performanceService.clearCache('emergency_path_');
    this.performanceService.clearCache(
      `hospitals_${location.latitude}_${location.longitude}`,
    );
    this.performanceService.clearCache(
      `ambulances_${location.latitude}_${location.longitude}`,
    );
    this.performanceService.clearCache(
      `blood_banks_${location.latitude}_${location.longitude}`,
    );

    this.logger.debug(
      `Cache invalidated for location: ${location.latitude}, ${location.longitude}`,
    );
  }

  /**
   * Invalidate service-specific cache entries
   */
  private invalidateServiceCache(serviceType: string, serviceId: string): void {
    this.performanceService.clearCache(`${serviceType}_${serviceId}`);
    this.performanceService.clearCache(`${serviceType}_list`);

    this.logger.debug(
      `Cache invalidated for service: ${serviceType}/${serviceId}`,
    );
  }

  /**
   * Send notifications to users subscribed to specific entities
   */
  private async notifySubscribedUsers(
    subscriptionType: 'ambulance' | 'emergency_service',
    entityId: string,
    broadcastEvent: any,
  ): Promise<void> {
    try {
      const subscriptionMap =
        subscriptionType === 'ambulance'
          ? this.locationSubscriptions
          : this.emergencySubscriptions;

      const subscribedUsers: string[] = [];

      for (const [userId, subscriptions] of subscriptionMap.entries()) {
        if (subscriptions.has(entityId)) {
          subscribedUsers.push(userId);
        }
      }

      if (subscribedUsers.length > 0) {
        // Send targeted notifications to subscribed users
        for (const userId of subscribedUsers) {
          await this.socketGateway.sendToUser(
            userId,
            broadcastEvent.event,
            broadcastEvent.data,
          );
        }

        this.logger.debug(
          `Notified ${subscribedUsers.length} subscribed users for ${subscriptionType}/${entityId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error notifying subscribed users:`, error);
    }
  }

  /**
   * Send critical status notifications for emergency situations
   */
  private async sendCriticalStatusNotifications(
    update: EmergencyServiceStatusUpdate,
  ): Promise<void> {
    try {
      // Find users in the vicinity who might be affected
      if (update.location) {
        const nearbyUsers =
          await this.performanceService.findUsersInEmergencyPath(
            update.location,
            0, // No specific bearing for status updates
            2, // 2km radius for critical notifications
          );

        if (nearbyUsers.length > 0) {
          const userIds = nearbyUsers.map((user) => user._id.toString());

          const title = 'Emergency Service Alert';
          let message = `${update.serviceType} service status changed to ${update.status}`;

          if (update.status === 'offline') {
            message = `${update.serviceType} service is temporarily unavailable. Please seek alternative options.`;
          } else if (update.status === 'emergency') {
            message = `${update.serviceType} service is handling an emergency. Response times may be longer.`;
          }

          await this.notificationService.sendEmergencyAlert(
            userIds,
            title,
            message,
            {
              serviceId: update.serviceId,
              serviceType: update.serviceType,
              status: update.status,
              location: update.location,
            },
          );

          this.logger.log(
            `Sent critical status notifications to ${userIds.length} nearby users`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error sending critical status notifications:`, error);
    }
  }

  /**
   * Update entity location in database
   */
  private async updateEntityLocation(
    update: LocationDataUpdate,
  ): Promise<void> {
    const locationData = {
      type: 'Point' as const,
      coordinates: [update.location.longitude, update.location.latitude],
    };

    const updateData = {
      location: locationData,
      updatedAt: new Date(),
      ...(update.metadata || {}),
    };

    switch (update.entityType) {
      case 'hospital':
        await this.healthcareFacilityModel.findByIdAndUpdate(
          update.entityId,
          updateData,
        );
        break;
      case 'ambulance':
        await this.ambulanceProviderModel.findByIdAndUpdate(
          update.entityId,
          updateData,
        );
        break;
      case 'blood_bank':
        await this.bloodBankModel.findByIdAndUpdate(
          update.entityId,
          updateData,
        );
        break;
      case 'facility':
        await this.facilityDetailModel.findByIdAndUpdate(
          update.entityId,
          updateData,
        );
        break;
    }
  }

  /**
   * Broadcast to users in the vicinity of a location
   */
  private async broadcastToNearbyUsers(
    location: { latitude: number; longitude: number },
    broadcastEvent: any,
    radiusKm: number = 5,
  ): Promise<void> {
    try {
      const nearbyUsers = await this.userModel
        .find({
          is_online: true,
          socket_id: { $exists: true, $ne: null },
          location: {
            $nearSphere: {
              $geometry: {
                type: 'Point',
                coordinates: [location.longitude, location.latitude],
              },
              $maxDistance: radiusKm * 1000,
            },
          },
        })
        .select('_id socket_id')
        .lean();

      for (const user of nearbyUsers) {
        await this.socketGateway.sendToUser(
          user._id.toString(),
          broadcastEvent.event,
          broadcastEvent.data,
        );
      }

      this.logger.debug(
        `Broadcasted location update to ${nearbyUsers.length} nearby users`,
      );
    } catch (error) {
      this.logger.error(`Error broadcasting to nearby users:`, error);
    }
  }

  /**
   * Update real-time capacity for healthcare facilities
   */
  private async updateRealTimeCapacity(entityId: string): Promise<void> {
    try {
      // Simulate real-time capacity update based on current time and random factors
      const currentHour = new Date().getHours();
      let capacity = 80; // Default 80% available

      // Simulate capacity variations based on time of day
      if (currentHour >= 8 && currentHour <= 12) {
        capacity = Math.floor(Math.random() * 30) + 50; // 50-80% during morning hours
      } else if (currentHour >= 13 && currentHour <= 17) {
        capacity = Math.floor(Math.random() * 40) + 40; // 40-80% during afternoon
      } else if (currentHour >= 18 && currentHour <= 22) {
        capacity = Math.floor(Math.random() * 20) + 30; // 30-50% during evening
      } else {
        capacity = Math.floor(Math.random() * 50) + 50; // 50-100% during night/early morning
      }

      await this.facilityDetailModel.findOneAndUpdate(
        { facilityId: entityId },
        {
          realTimeCapacity: capacity,
          updatedAt: new Date(),
        },
      );

      this.logger.debug(
        `Updated real-time capacity for facility ${entityId}: ${capacity}%`,
      );
    } catch (error) {
      this.logger.error(`Error updating real-time capacity:`, error);
    }
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats(): {
    connectedUsers: number;
    locationSubscriptions: number;
    emergencySubscriptions: number;
    totalSubscriptions: number;
  } {
    const locationSubCount = Array.from(
      this.locationSubscriptions.values(),
    ).reduce((total, subscriptions) => total + subscriptions.size, 0);

    const emergencySubCount = Array.from(
      this.emergencySubscriptions.values(),
    ).reduce((total, subscriptions) => total + subscriptions.size, 0);

    return {
      connectedUsers: this.socketGateway.getConnectedUsersCount(),
      locationSubscriptions: locationSubCount,
      emergencySubscriptions: emergencySubCount,
      totalSubscriptions: locationSubCount + emergencySubCount,
    };
  }

  /**
   * Cleanup inactive subscriptions
   */
  async cleanupInactiveSubscriptions(): Promise<void> {
    try {
      // Get list of currently connected users
      const connectedUserIds = new Set<string>();

      // Clean up location subscriptions for disconnected users
      for (const userId of this.locationSubscriptions.keys()) {
        if (!connectedUserIds.has(userId)) {
          this.locationSubscriptions.delete(userId);
        }
      }

      // Clean up emergency subscriptions for disconnected users
      for (const userId of this.emergencySubscriptions.keys()) {
        if (!connectedUserIds.has(userId)) {
          this.emergencySubscriptions.delete(userId);
        }
      }

      this.logger.debug('Cleaned up inactive subscriptions');
    } catch (error) {
      this.logger.error('Error cleaning up inactive subscriptions:', error);
    }
  }
}
