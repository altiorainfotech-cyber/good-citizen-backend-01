/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { NotificationService, NotificationData } from './notification.service';
import { NotificationQueueService } from './notification-queue.service';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';
import { NotificationPreference } from '../user/entities/notification-preference.entity';

export class CreateNotificationDto {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  data?: any;
  target_user_ids?: string[];
}

export class CreateTemplatedNotificationDto {
  template_key: string;
  user_id: string;
  variables: Record<string, any>;
  driver_id?: string;
  ride_id?: string;
  priority?: NotificationPriority;
  language?: string;
}

export class CreateBroadcastNotificationDto {
  user_ids: string[];
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  data?: any;
}

export class UpdatePreferencesDto {
  push_notifications_enabled?: boolean;
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  notification_types?: { [key: string]: boolean };
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  emergency_override_quiet_hours?: boolean;
  language?: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * Get user notifications with pagination
   */
  @Get()
  async getUserNotifications(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('unread_only') unreadOnly: string = 'false',
  ) {
    try {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const unreadOnlyBool = unreadOnly === 'true';

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new HttpException(
          'Invalid pagination parameters',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.notificationService.getUserNotifications(
        req.user.userId,
        pageNum,
        limitNum,
        unreadOnlyBool,
      );

      return {
        success: true,
        data: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total,
          pages: Math.ceil(result.total / limitNum),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch notifications';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  /**
   * Mark notification as read
   */
  @Put(':id/read')
  async markAsRead(@Param('id') notificationId: string, @Request() req) {
    try {
      await this.notificationService.markAsRead(notificationId);
      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to mark notification as read';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Mark all user notifications as read
   */
  @Put('read-all')
  async markAllAsRead(@Request() req) {
    try {
      await this.notificationService.markAllAsRead(req.user.userId);
      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to mark all notifications as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user notification preferences
   */
  @Get('preferences')
  async getPreferences(@Request() req) {
    try {
      // This would need to be implemented in the service
      return {
        success: true,
        message: 'Preferences endpoint - to be implemented',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update user notification preferences
   */
  @Put('preferences')
  async updatePreferences(
    @Body() preferences: UpdatePreferencesDto,
    @Request() req,
  ) {
    try {
      // Convert the preferences to the correct format
      const convertedPreferences: any = {
        ...preferences,
      };

      // Convert notification_types object to Map if provided
      if (preferences.notification_types) {
        convertedPreferences.notification_types = new Map(
          Object.entries(preferences.notification_types),
        );
      }

      const result = await this.notificationService.updateUserPreferences(
        req.user.userId,
        convertedPreferences,
      );

      return {
        success: true,
        data: result,
        message: 'Preferences updated successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to update preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Send templated notification
   */
  @Post('send-templated')
  async sendTemplatedNotification(
    @Body() notificationDto: CreateTemplatedNotificationDto,
    @Request() req,
  ) {
    try {
      const result = await this.notificationService.sendTemplatedNotification(
        notificationDto.template_key,
        notificationDto.user_id,
        notificationDto.variables,
        {
          ...(notificationDto.driver_id && {
            driver_id: notificationDto.driver_id,
          }),
          ...(notificationDto.ride_id && { ride_id: notificationDto.ride_id }),
          ...(notificationDto.priority && {
            priority: notificationDto.priority,
          }),
          ...(notificationDto.language && {
            language: notificationDto.language,
          }),
        },
      );

      return {
        success: true,
        data: result,
        message: 'Templated notification sent',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to send templated notification';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Send broadcast notification
   */
  @Post('broadcast')
  async sendBroadcastNotification(
    @Body() notificationDto: CreateBroadcastNotificationDto,
    @Request() req,
  ) {
    try {
      const results = await this.notificationService.sendBroadcastNotification(
        notificationDto.user_ids,
        notificationDto.title,
        notificationDto.message,
        notificationDto.type,
        notificationDto.priority,
        notificationDto.data,
      );

      const successCount = results.filter((r) => r.delivered).length;
      const failureCount = results.length - successCount;

      return {
        success: true,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results,
        },
        message: `Broadcast sent to ${results.length} users (${successCount} successful, ${failureCount} failed)`,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to send broadcast notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get notification queue status
   */
  @Get('queue/status')
  async getQueueStatus(@Request() req) {
    try {
      const status = this.notificationQueueService.getQueueStatus();
      return {
        success: true,
        data: status,
        message: 'Queue status retrieved',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get queue status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Clear notification queue (admin only)
   */
  @Post('queue/clear')
  async clearQueue(@Request() req) {
    try {
      // This should be admin-only in production
      this.notificationQueueService.clearQueue();
      return {
        success: true,
        message: 'Queue cleared successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to clear queue',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Post('send')
  async sendNotification(
    @Body() notificationDto: CreateNotificationDto,
    @Request() req,
  ) {
    try {
      // This would typically be admin-only
      const results: any[] = [];

      if (
        notificationDto.target_user_ids &&
        notificationDto.target_user_ids.length > 0
      ) {
        for (const userId of notificationDto.target_user_ids) {
          const notificationData: NotificationData = {
            user_id: userId,
            title: notificationDto.title,
            message: notificationDto.message,
            type: notificationDto.type,
            priority: notificationDto.priority || NotificationPriority.NORMAL,
            data: notificationDto.data || {},
          };

          const result =
            await this.notificationService.sendNotification(notificationData);
          results.push(result);
        }
      }

      return {
        success: true,
        data: results,
        message: 'Notifications sent',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to send notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
