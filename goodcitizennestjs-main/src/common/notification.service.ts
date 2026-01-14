/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/restrict-template-expressions */

/* eslint-disable no-useless-catch */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
// import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import {
  Notification,
  NotificationDocument,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../entities/notification.entity';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from '../user/entities/notification-preference.entity';
import {
  LoyaltyPoint,
  LoyaltyPointDocument,
} from '../user/entities/loyalty-point.entity';
import { User, UserDocument } from '../user/entities/user.entity';

export interface NotificationDeliveryOptions {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  force_delivery?: boolean; // Override user preferences for emergency
}

export interface NotificationData {
  user_id: string | Types.ObjectId;
  driver_id?: string | Types.ObjectId | undefined;
  ride_id?: string | Types.ObjectId | undefined;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority | undefined;
  data?: any;
  template_key?: string;
  template_variables?: Record<string, any>;
  delivery_options?: NotificationDeliveryOptions | undefined;
}

export interface NotificationDeliveryResult {
  notification_id: string;
  delivered: boolean;
  delivery_channels: {
    push?: { success: boolean; error?: string };
    email?: { success: boolean; error?: string };
    sms?: { success: boolean; error?: string };
  };
  failed_reason?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private option = { lean: true, sort: { _id: -1 } } as const;

  // Rate limiting for emergency notifications (per user)
  private emergencyNotificationCache = new Map<string, Date>();
  private readonly EMERGENCY_RATE_LIMIT_MS = 30000; // 30 seconds

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(NotificationPreference.name)
    private notificationPreferenceModel: Model<NotificationPreferenceDocument>,
    @InjectModel(LoyaltyPoint.name)
    private loyaltyPointModel: Model<LoyaltyPointDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // @InjectFirebaseAdmin() private firebase: FirebaseAdmin,
  ) {}

  /**
   * Enhanced notification sending with status tracking and preferences
   */
  async sendNotification(
    notificationData: NotificationData,
  ): Promise<NotificationDeliveryResult> {
    try {
      const userId = new Types.ObjectId(notificationData.user_id);

      // Check rate limiting for emergency notifications
      if (notificationData.priority === NotificationPriority.EMERGENCY) {
        const cacheKey = `${userId}_emergency`;
        const lastNotification = this.emergencyNotificationCache.get(cacheKey);

        if (
          lastNotification &&
          Date.now() - lastNotification.getTime() < this.EMERGENCY_RATE_LIMIT_MS
        ) {
          this.logger.warn(
            `Emergency notification rate limited for user ${userId}`,
          );
          return {
            notification_id: '',
            delivered: false,
            delivery_channels: {},
            failed_reason:
              'Rate limited - emergency notifications too frequent',
          };
        }

        this.emergencyNotificationCache.set(cacheKey, new Date());
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);

      // Check if user has opted out of this notification type
      if (
        !notificationData.delivery_options?.force_delivery &&
        !this.shouldDeliverNotification(notificationData, preferences)
      ) {
        this.logger.debug(
          `Notification skipped due to user preferences: ${userId}`,
        );
        return {
          notification_id: '',
          delivered: false,
          delivery_channels: {},
          failed_reason: 'User opted out of this notification type',
        };
      }

      // Create notification record
      const notification =
        await this.createNotificationRecord(notificationData);

      // Determine delivery channels
      const deliveryChannels = this.getDeliveryChannels(
        notificationData,
        preferences,
      );

      // Deliver notification through various channels
      const deliveryResults = await this.deliverNotification(
        notification,
        notificationData,
        deliveryChannels,
      );

      // Update notification status based on delivery results
      await this.updateNotificationStatus(notification._id, deliveryResults);

      return {
        notification_id: notification._id.toString(),
        delivered: Object.values(deliveryResults).some(
          (result) => result.success,
        ),
        delivery_channels: deliveryResults,
      };
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async send_notification(
    data: any,
    message: string,
    title: string,
    driver_id: string | Types.ObjectId,
    ride_id: string | Types.ObjectId,
  ): Promise<NotificationDeliveryResult> {
    const notificationData: NotificationData = {
      user_id: data?.user_id || data?._id,
      driver_id,
      ride_id,
      title,
      message,
      type: NotificationType.RIDE_UPDATE,
      priority: NotificationPriority.NORMAL,
      data: {
        fcm_token: data?.fcm_token,
        ambulance_num: data?.ambulance_num || 'CH 01 9093',
        distance: data?.distance || '3.2 Km',
      },
    };

    const result = await this.sendNotification(notificationData);

    // Award loyalty points (legacy behavior)
    if (result.delivered) {
      await this.loyalty_point(data?._id, driver_id, ride_id);
    }

    return result;
  }

  /**
   * Send high-priority emergency notifications
   */
  async sendEmergencyAlert(
    userIds: (string | Types.ObjectId)[],
    title: string,
    message: string,
    emergencyData: any,
  ): Promise<NotificationDeliveryResult[]> {
    const results: NotificationDeliveryResult[] = [];

    for (const userId of userIds) {
      const notificationData: NotificationData = {
        user_id: userId,
        title,
        message,
        type: NotificationType.EMERGENCY_ALERT,
        priority: NotificationPriority.EMERGENCY,
        data: emergencyData,
        delivery_options: {
          force_delivery: true, // Override user preferences for emergency
          push: true,
          email: false,
          sms: false,
        },
      };

      try {
        const result = await this.sendNotification(notificationData);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to send emergency alert to user ${userId}:`,
          error,
        );
        results.push({
          notification_id: '',
          delivered: false,
          delivery_channels: {},
          failed_reason: (error as any)?.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: Types.ObjectId): Promise<any> {
    return await this.notificationPreferenceModel
      .findOne({ user_id: userId })
      .lean();
  }

  /**
   * Check if notification should be delivered based on user preferences
   */
  private shouldDeliverNotification(
    notificationData: NotificationData,
    preferences: any,
  ): boolean {
    if (!preferences) {
      return true; // Default to delivering if no preferences set
    }

    // Check if user has enabled this notification type
    const typeEnabled =
      preferences.notification_types?.get?.(notificationData.type) ??
      preferences.notification_types?.[notificationData.type];
    if (typeEnabled === false) {
      return false;
    }

    // Check quiet hours (except for emergency notifications)
    if (
      notificationData.priority !== NotificationPriority.EMERGENCY &&
      !preferences.emergency_override_quiet_hours
    ) {
      if (this.isInQuietHours(preferences)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is within user's quiet hours
   */
  private isInQuietHours(preferences: any): boolean {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quiet_hours_start
      .split(':')
      .map(Number);
    const [endHour, endMin] = preferences.quiet_hours_end
      .split(':')
      .map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day quiet hours
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(
    notificationData: NotificationData,
  ): Promise<NotificationDocument> {
    const notificationRecord = {
      user_id: new Types.ObjectId(notificationData.user_id),
      driver_id: notificationData.driver_id
        ? new Types.ObjectId(notificationData.driver_id)
        : undefined,
      ride_id: notificationData.ride_id
        ? new Types.ObjectId(notificationData.ride_id)
        : undefined,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      status: NotificationStatus.UNREAD,
      priority: notificationData.priority || NotificationPriority.NORMAL,
      data: notificationData.data || {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    return await this.notificationModel.create(notificationRecord);
  }

  /**
   * Determine which delivery channels to use
   */
  private getDeliveryChannels(
    notificationData: NotificationData,
    preferences: any,
  ): NotificationDeliveryOptions {
    const defaultChannels: NotificationDeliveryOptions = {
      push: true,
      email: false,
      sms: false,
    };

    if (notificationData.delivery_options) {
      return notificationData.delivery_options;
    }

    if (!preferences) {
      return defaultChannels;
    }

    return {
      push: preferences.push_notifications_enabled,
      email: preferences.email_notifications_enabled,
      sms: preferences.sms_notifications_enabled,
    };
  }

  /**
   * Deliver notification through various channels
   */
  private async deliverNotification(
    notification: NotificationDocument,
    notificationData: NotificationData,
    channels: NotificationDeliveryOptions,
  ): Promise<Record<string, { success: boolean; error?: string }>> {
    const results: Record<string, { success: boolean; error?: string }> = {};

    // Push notification delivery
    if (channels.push) {
      results.push = await this.deliverPushNotification(
        notification,
        notificationData,
      );
    }

    // Email delivery (placeholder for future implementation)
    if (channels.email) {
      results.email = {
        success: false,
        error: 'Email delivery not implemented',
      };
    }

    // SMS delivery (placeholder for future implementation)
    if (channels.sms) {
      results.sms = { success: false, error: 'SMS delivery not implemented' };
    }

    return results;
  }

  /**
   * Deliver push notification
   */
  private async deliverPushNotification(
    _notification: NotificationDocument,
    notificationData: NotificationData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fcmToken = notificationData.data?.fcm_token;

      if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 10) {
        return { success: false, error: 'Invalid or missing FCM token' };
      }

      // TODO: Re-enable Firebase notifications when credentials are configured
      this.logger.debug('Firebase notifications disabled - would send:', {
        title: notificationData.title,
        message: notificationData.message,
        fcmToken: fcmToken,
        priority: notificationData.priority,
      });

      // Simulate successful delivery for now
      return { success: true };

      // const payload = {
      //   notification: {
      //     title: notificationData.title,
      //     body: notificationData.message,
      //   },
      //   data: {
      //     notification_id: notification._id.toString(),
      //     type: notificationData.type,
      //     priority: notificationData.priority || NotificationPriority.NORMAL,
      //     ...notificationData.data
      //   },
      //   token: fcmToken,
      //   android: {
      //     priority: notificationData.priority === NotificationPriority.EMERGENCY ? 'high' : 'normal',
      //   },
      //   apns: {
      //     headers: {
      //       'apns-priority': notificationData.priority === NotificationPriority.EMERGENCY ? '10' : '5',
      //     },
      //   },
      // };

      // const response = await this.firebase.messaging.send(payload);
      // this.logger.log('Push notification sent successfully:', response);
      // return { success: true };
    } catch (error: any) {
      this.logger.error('Error sending push notification:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Update notification status after delivery attempts
   */
  private async updateNotificationStatus(
    notificationId: Types.ObjectId,
    deliveryResults: Record<string, { success: boolean; error?: string }>,
  ): Promise<void> {
    const hasSuccessfulDelivery = Object.values(deliveryResults).some(
      (result) => result.success,
    );
    const status = hasSuccessfulDelivery
      ? NotificationStatus.DELIVERED
      : NotificationStatus.FAILED;

    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (hasSuccessfulDelivery) {
      updateData.delivered_at = new Date();
    } else {
      const errors = Object.entries(deliveryResults)
        .filter(([_, result]) => !result.success)
        .map(
          ([channel, result]) =>
            `${channel}: ${result.error || 'Unknown error'}`,
        )
        .join('; ');
      updateData.failed_reason = errors;
    }

    await this.notificationModel.findByIdAndUpdate(notificationId, updateData);
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{
    notifications: NotificationDocument[];
    total: number;
    unread_count: number;
  }> {
    const userObjectId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const filter: any = { user_id: userObjectId };
    if (unreadOnly) {
      filter.status = NotificationStatus.UNREAD;
    }

    const [notifications, total, unread_count] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        user_id: userObjectId,
        status: NotificationStatus.UNREAD,
      }),
    ]);

    return { notifications, total, unread_count };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string | Types.ObjectId): Promise<void> {
    await this.notificationModel.findByIdAndUpdate(notificationId, {
      status: NotificationStatus.READ,
      read_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string | Types.ObjectId): Promise<void> {
    await this.notificationModel.updateMany(
      {
        user_id: new Types.ObjectId(userId),
        status: NotificationStatus.UNREAD,
      },
      {
        status: NotificationStatus.READ,
        read_at: new Date(),
        updated_at: new Date(),
      },
    );
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string | Types.ObjectId,
    preferences: Partial<NotificationPreference>,
  ): Promise<NotificationPreferenceDocument> {
    const userObjectId = new Types.ObjectId(userId);

    return await this.notificationPreferenceModel.findOneAndUpdate(
      { user_id: userObjectId },
      {
        ...preferences,
        updated_at: new Date(),
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  /**
   * Send notification using template
   */
  async sendTemplatedNotification(
    templateKey: string,
    userId: string | Types.ObjectId,
    variables: Record<string, any>,
    options?: {
      driver_id?: string | Types.ObjectId;
      ride_id?: string | Types.ObjectId;
      priority?: NotificationPriority;
      delivery_options?: NotificationDeliveryOptions;
      language?: string;
    },
  ): Promise<NotificationDeliveryResult> {
    try {
      // Get template
      const template = await this.getNotificationTemplate(templateKey);
      if (!template) {
        throw new Error(`Template not found: ${templateKey}`);
      }

      // Get user preferences for language
      const userPreferences = await this.getUserPreferences(
        new Types.ObjectId(userId),
      );
      const language = options?.language || userPreferences?.language || 'en';

      // Get localized content
      const content =
        template.localized_content.get(language) ||
        template.localized_content.get('en');
      if (!content) {
        throw new Error(
          `No content found for template ${templateKey} in language ${language}`,
        );
      }

      // Replace variables in content
      const title = this.replaceVariables(content.title, variables);
      const message = this.replaceVariables(content.message, variables);

      const notificationData: NotificationData = {
        user_id: userId,
        driver_id: options?.driver_id || undefined,
        ride_id: options?.ride_id || undefined,
        title,
        message,
        type: template.type,
        priority: options?.priority || template.priority,
        data: {
          template_key: templateKey,
          variables,
          ...variables,
        },
        delivery_options: options?.delivery_options || undefined,
      };

      return await this.sendNotification(notificationData);
    } catch (error) {
      this.logger.error('Error sending templated notification:', error);
      throw error;
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(
    notifications: NotificationData[],
  ): Promise<NotificationDeliveryResult[]> {
    const results: NotificationDeliveryResult[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map((notification) =>
        this.sendNotification(notification).catch((error) => ({
          notification_id: '',
          delivered: false,
          delivery_channels: {},
          failed_reason: error.message,
        })),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches to prevent rate limiting
      if (i + batchSize < notifications.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Send broadcast notification to multiple users
   */
  async sendBroadcastNotification(
    userIds: (string | Types.ObjectId)[],
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM_ANNOUNCEMENT,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    data?: any,
  ): Promise<NotificationDeliveryResult[]> {
    const notifications: NotificationData[] = userIds.map((userId) => ({
      user_id: userId,
      title,
      message,
      type,
      priority,
      data: data || {},
    }));

    return await this.sendBatchNotifications(notifications);
  }

  /**
   * Get notification template
   */
  private async getNotificationTemplate(_templateKey: string): Promise<any> {
    // For now, return null since we removed the template model from constructor
    // This would need to be implemented when template functionality is needed
    return null;
  }

  /**
   * Replace variables in template content
   */
  private replaceVariables(
    content: string,
    variables: Record<string, any>,
  ): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * Legacy loyalty point method
   */
  async loyalty_point(
    user_id: string,
    driver_id: string | Types.ObjectId,
    ride_id: string | Types.ObjectId,
  ) {
    try {
      const query = {
        user_id: new Types.ObjectId(user_id),
        driver_id: new Types.ObjectId(driver_id),
        ride_id: new Types.ObjectId(ride_id),
      };
      const point = await this.loyaltyPointModel.findOne(
        query,
        {},
        this.option,
      );
      if (!point) {
        const data = {
          user_id: new Types.ObjectId(user_id),
          driver_id: new Types.ObjectId(driver_id),
          ride_id: new Types.ObjectId(ride_id),
          loyalty_point: 5,
        };
        await this.loyaltyPointModel.create(data);
        await this.userModel.findByIdAndUpdate(
          { _id: new Types.ObjectId(user_id) },
          { $inc: { loyalty_point: 5 } },
        );
      }
    } catch (error) {
      throw error;
    }
  }
}
