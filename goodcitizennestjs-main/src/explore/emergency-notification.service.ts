/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/no-base-to-string */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationService,
  NotificationData,
} from '../common/notification.service';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../entities/emergency-request.entity';
import {
  AmbulanceProvider,
  AmbulanceProviderDocument,
} from './entities/ambulance-provider.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { EmergencyWebSocketService } from './emergency-websocket.service';

export interface EmergencyNotificationData {
  emergencyRequestId: string;
  emergencyType: string;
  priority: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  description: string;
  userId: string;
  assignedProviderId?: string;
}

export interface AmbulanceStatusUpdate {
  providerId: string;
  availability: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
  responseTime?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class EmergencyNotificationService {
  private readonly logger = new Logger(EmergencyNotificationService.name);

  constructor(
    @InjectModel(EmergencyRequest.name)
    private emergencyRequestModel: Model<EmergencyRequestDocument>,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationService: NotificationService,
    private emergencyWebSocketService: EmergencyWebSocketService,
  ) {}

  /**
   * Send emergency request notifications to relevant parties
   */
  async notifyEmergencyRequest(data: EmergencyNotificationData): Promise<void> {
    try {
      this.logger.log(
        `Sending emergency notifications for request ${data.emergencyRequestId}`,
      );

      // Notify the user who made the request
      await this.notifyUserEmergencyCreated(data);

      // Notify assigned ambulance provider if available
      if (data.assignedProviderId) {
        await this.notifyProviderAssignment(data);
      }

      // Notify nearby ambulance providers for ambulance requests
      if (data.emergencyType === 'ambulance') {
        await this.notifyNearbyProviders(data);
      }

      // Notify emergency contacts/authorities based on emergency type
      await this.notifyEmergencyAuthorities(data);

      // Send real-time WebSocket update
      await this.emergencyWebSocketService.notifyEmergencyRequestCreated({
        id: data.emergencyRequestId,
        emergencyType: data.emergencyType,
        priority: data.priority,
        location: data.location,
        address: data.address,
        status: 'pending',
        userId: data.userId,
        createdAt: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send emergency notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send status update notifications
   */
  async notifyEmergencyStatusUpdate(
    emergencyRequestId: string,
    oldStatus: string,
    newStatus: string,
    additionalData?: any,
  ): Promise<void> {
    try {
      const request = await this.emergencyRequestModel
        .findById(emergencyRequestId)
        .populate('assignedProviderId', 'name contactNumber')
        .lean();

      if (!request) {
        this.logger.warn(`Emergency request not found: ${emergencyRequestId}`);
        return;
      }

      this.logger.log(
        `Notifying status update: ${oldStatus} -> ${newStatus} for request ${emergencyRequestId}`,
      );

      // Notify the user about status change
      await this.notifyUserStatusUpdate(
        request,
        oldStatus,
        newStatus,
        additionalData,
      );

      // Notify assigned provider about status change
      if (request.assignedProviderId) {
        await this.notifyProviderStatusUpdate(
          request,
          oldStatus,
          newStatus,
          additionalData,
        );
      }

      // Send real-time WebSocket update
      await this.emergencyWebSocketService.notifyEmergencyStatusUpdate(
        emergencyRequestId,
        oldStatus,
        newStatus,
        {
          userId: request.userId.toString(),
          assignedProviderId: request.assignedProviderId?.toString(),
          ...additionalData,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send status update notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send ambulance availability update notifications
   */
  async notifyAmbulanceStatusUpdate(
    data: AmbulanceStatusUpdate,
  ): Promise<void> {
    try {
      this.logger.log(
        `Notifying ambulance status update for provider ${data.providerId}`,
      );

      const provider = await this.ambulanceProviderModel
        .findById(data.providerId)
        .lean();
      if (!provider) {
        this.logger.warn(`Ambulance provider not found: ${data.providerId}`);
        return;
      }

      // Find active emergency requests that might be affected
      const activeRequests = await this.emergencyRequestModel
        .find({
          emergencyType: 'ambulance',
          status: { $in: ['pending', 'assigned'] },
          isActive: true,
        })
        .lean();

      // Notify users with pending requests if ambulance becomes available
      if (data.availability && activeRequests.length > 0) {
        for (const request of activeRequests) {
          if (request.status === 'pending') {
            await this.notifyUserAmbulanceAvailable(request, provider);
          }
        }
      }

      // Notify admin/dispatch about availability change
      await this.notifyDispatchAmbulanceUpdate(provider, data);

      // Send real-time WebSocket update
      await this.emergencyWebSocketService.notifyAmbulanceAvailabilityUpdate(
        data.providerId,
        data.availability,
        data.location,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ambulance status notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Notify user about emergency request creation
   */
  private async notifyUserEmergencyCreated(
    data: EmergencyNotificationData,
  ): Promise<void> {
    const notificationData: NotificationData = {
      user_id: data.userId,
      title: 'Emergency Request Created',
      message: `Your ${data.emergencyType} emergency request has been created. Help is on the way.`,
      type: NotificationType.EMERGENCY_ALERT,
      priority: this.mapPriorityToNotificationPriority(data.priority),
      data: {
        emergencyRequestId: data.emergencyRequestId,
        emergencyType: data.emergencyType,
        location: data.location,
        address: data.address,
      },
      delivery_options: {
        push: true,
        force_delivery: true, // Override user preferences for emergency
      },
    };

    await this.notificationService.sendNotification(notificationData);
  }

  /**
   * Notify assigned provider about assignment
   */
  private async notifyProviderAssignment(
    data: EmergencyNotificationData,
  ): Promise<void> {
    if (!data.assignedProviderId) return;

    // Find provider's user account
    const provider = await this.ambulanceProviderModel
      .findById(data.assignedProviderId)
      .lean();
    if (!provider) return;

    // For now, we'll use the provider's contact info to find associated user
    // In a real implementation, you'd have a proper provider-user relationship
    const notificationData: NotificationData = {
      user_id: data.assignedProviderId, // This would be the provider's user ID
      title: 'Emergency Assignment',
      message: `You have been assigned to a ${data.emergencyType} emergency at ${data.address}`,
      type: NotificationType.EMERGENCY_ALERT,
      priority: NotificationPriority.HIGH,
      data: {
        emergencyRequestId: data.emergencyRequestId,
        emergencyType: data.emergencyType,
        location: data.location,
        address: data.address,
        description: data.description,
      },
      delivery_options: {
        push: true,
        force_delivery: true,
      },
    };

    await this.notificationService.sendNotification(notificationData);
  }

  /**
   * Notify nearby providers about emergency request
   */
  private async notifyNearbyProviders(
    data: EmergencyNotificationData,
  ): Promise<void> {
    const nearbyProviders = await this.ambulanceProviderModel
      .find({
        isActive: true,
        availability: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [data.location.longitude, data.location.latitude],
            },
            $maxDistance: 20000, // 20km radius
          },
        },
      })
      .limit(5) // Notify up to 5 nearby providers
      .lean();

    for (const provider of nearbyProviders) {
      const notificationData: NotificationData = {
        user_id: provider._id.toString(), // This would be the provider's user ID
        title: 'Emergency Request Nearby',
        message: `${data.emergencyType} emergency request near your location: ${data.address}`,
        type: NotificationType.EMERGENCY_ALERT,
        priority: NotificationPriority.HIGH,
        data: {
          emergencyRequestId: data.emergencyRequestId,
          emergencyType: data.emergencyType,
          location: data.location,
          address: data.address,
          distance: this.calculateDistance(
            provider.location.coordinates[1],
            provider.location.coordinates[0],
            data.location.latitude,
            data.location.longitude,
          ),
        },
        delivery_options: {
          push: true,
        },
      };

      await this.notificationService.sendNotification(notificationData);
    }
  }

  /**
   * Notify emergency authorities based on emergency type
   */
  private async notifyEmergencyAuthorities(
    data: EmergencyNotificationData,
  ): Promise<void> {
    // This would integrate with emergency services APIs
    // For now, we'll log the emergency for authorities to see
    this.logger.log(
      `Emergency authorities notified: ${JSON.stringify({
        type: data.emergencyType,
        location: data.location,
        address: data.address,
        priority: data.priority,
        description: data.description,
        timestamp: new Date().toISOString(),
      })}`,
    );

    // In a real implementation, this would:
    // 1. Send notifications to emergency dispatch systems
    // 2. Integrate with local emergency services APIs
    // 3. Send alerts to relevant authorities based on emergency type
  }

  /**
   * Notify user about status updates
   */
  private async notifyUserStatusUpdate(
    request: any,
    oldStatus: string,
    newStatus: string,
    additionalData?: any,
  ): Promise<void> {
    const statusMessages = {
      assigned: 'Your emergency request has been assigned to a provider.',
      in_progress: 'Help is on the way! The emergency responder is en route.',
      completed: 'Your emergency request has been completed.',
      cancelled: 'Your emergency request has been cancelled.',
    };

    const message =
      statusMessages[newStatus] ||
      `Your emergency request status has been updated to ${newStatus}.`;

    const notificationData: NotificationData = {
      user_id: request.userId,
      title: 'Emergency Status Update',
      message,
      type: NotificationType.EMERGENCY_ALERT,
      priority:
        newStatus === 'in_progress'
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL,
      data: {
        emergencyRequestId: request._id,
        oldStatus,
        newStatus,
        assignedProvider: request.assignedProviderId,
        ...additionalData,
      },
      delivery_options: {
        push: true,
        force_delivery: newStatus === 'in_progress',
      },
    };

    await this.notificationService.sendNotification(notificationData);
  }

  /**
   * Notify provider about status updates
   */
  private async notifyProviderStatusUpdate(
    request: any,
    oldStatus: string,
    newStatus: string,
    additionalData?: any,
  ): Promise<void> {
    if (!request.assignedProviderId) return;

    const notificationData: NotificationData = {
      user_id: request.assignedProviderId._id || request.assignedProviderId,
      title: 'Emergency Request Update',
      message: `Emergency request status updated: ${oldStatus} → ${newStatus}`,
      type: NotificationType.EMERGENCY_ALERT,
      priority: NotificationPriority.NORMAL,
      data: {
        emergencyRequestId: request._id,
        oldStatus,
        newStatus,
        ...additionalData,
      },
      delivery_options: {
        push: true,
      },
    };

    await this.notificationService.sendNotification(notificationData);
  }

  /**
   * Notify user about ambulance availability
   */
  private async notifyUserAmbulanceAvailable(
    request: any,
    provider: any,
  ): Promise<void> {
    const notificationData: NotificationData = {
      user_id: request.userId,
      title: 'Ambulance Available',
      message: `An ambulance (${provider.name}) is now available for your emergency request.`,
      type: NotificationType.EMERGENCY_ALERT,
      priority: NotificationPriority.HIGH,
      data: {
        emergencyRequestId: request._id,
        providerId: provider._id,
        providerName: provider.name,
        estimatedResponseTime: provider.responseTime,
      },
      delivery_options: {
        push: true,
        force_delivery: true,
      },
    };

    await this.notificationService.sendNotification(notificationData);
  }

  /**
   * Notify dispatch about ambulance updates
   */
  private async notifyDispatchAmbulanceUpdate(
    provider: any,
    data: AmbulanceStatusUpdate,
  ): Promise<void> {
    // This would notify dispatch/admin users about ambulance status changes
    this.logger.log(
      `Dispatch notified: Ambulance ${provider.name} (${provider._id}) availability: ${data.availability}`,
    );

    // In a real implementation, this would send notifications to dispatch users
  }

  /**
   * Map emergency priority to notification priority
   */
  private mapPriorityToNotificationPriority(
    priority: string,
  ): NotificationPriority {
    switch (priority) {
      case 'critical':
        return NotificationPriority.EMERGENCY;
      case 'high':
        return NotificationPriority.HIGH;
      case 'medium':
        return NotificationPriority.NORMAL;
      case 'low':
        return NotificationPriority.LOW;
      default:
        return NotificationPriority.NORMAL;
    }
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
