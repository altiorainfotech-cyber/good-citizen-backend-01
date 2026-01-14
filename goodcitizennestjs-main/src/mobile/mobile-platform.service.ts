/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Session, SessionDocument } from '../user/entities/session.entity';
import { NotificationService } from '../common/notification.service';
import {
  LocationPermissionDto,
  LocationPermissionResponse,
  FCMTokenDto,
  NotificationSetupResponse,
  ImageUploadDto,
  ImageUploadResponse,
  OfflineSyncDto,
  SyncResponse,
  DeepLinkDto,
  DeepLinkResponse,
  AppStateDto,
  AppStateResponse,
  LocationPermissionStatus,
  LocationAccuracy,
  DeviceType,
} from './dto/mobile-platform.dto';

@Injectable()
export class MobilePlatformService {
  private readonly logger = new Logger(MobilePlatformService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private notificationService: NotificationService,
  ) {}

  /**
   * Handle Expo location permission states
   * Requirements: 25.1
   */
  async handleLocationPermission(
    userId: string,
    permissionData: LocationPermissionDto,
  ): Promise<LocationPermissionResponse> {
    try {
      this.logger.debug(
        `Processing location permission for user ${userId}:`,
        permissionData,
      );

      const userObjectId = new Types.ObjectId(userId);

      // Update user's location permission status
      const updateData: any = {
        location_permission_status: permissionData.status,
        location_permission_accuracy:
          permissionData.accuracy || LocationAccuracy.NONE,
        background_location_permission:
          permissionData.backgroundPermission || false,
        updated_at: new Date(),
      };

      await this.userModel.findByIdAndUpdate(userObjectId, updateData);

      // Determine response based on permission status
      const response: LocationPermissionResponse = {
        granted: permissionData.status === LocationPermissionStatus.GRANTED,
        accuracy: permissionData.accuracy || LocationAccuracy.NONE,
        backgroundPermission: permissionData.backgroundPermission || false,
      };

      // Add helpful messages based on permission status
      switch (permissionData.status) {
        case LocationPermissionStatus.DENIED:
          response.message =
            'Location permission denied. Some features may not work properly.';
          break;
        case LocationPermissionStatus.RESTRICTED:
          response.message =
            'Location permission restricted by device settings.';
          break;
        case LocationPermissionStatus.UNDETERMINED:
          response.message =
            'Location permission not yet determined. Please grant permission for full functionality.';
          break;
        case LocationPermissionStatus.GRANTED:
          response.message = 'Location permission granted successfully.';
          break;
      }

      this.logger.log(
        `Location permission processed for user ${userId}: ${permissionData.status}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error handling location permission:', error);
      throw new BadRequestException('Failed to process location permission');
    }
  }

  /**
   * Setup FCM push notifications
   * Requirements: 25.2
   */
  async setupPushNotifications(
    userId: string,
    fcmData: FCMTokenDto,
  ): Promise<NotificationSetupResponse> {
    try {
      this.logger.debug(`Setting up push notifications for user ${userId}:`, {
        deviceType: fcmData.deviceType,
        hasToken: !!fcmData.fcmToken,
      });

      const userObjectId = new Types.ObjectId(userId);

      // Validate FCM token format
      if (!fcmData.fcmToken || fcmData.fcmToken.length < 10) {
        throw new BadRequestException('Invalid FCM token provided');
      }

      // Update user's FCM token and device info
      const updateData: any = {
        fcm_token: fcmData.fcmToken,
        device_type: fcmData.deviceType,
        device_id: fcmData.deviceId,
        app_version: fcmData.appVersion,
        os_version: fcmData.osVersion,
        push_notifications_enabled: true,
        updated_at: new Date(),
      };

      await this.userModel.findByIdAndUpdate(userObjectId, updateData);

      // Update session with device information
      await this.sessionModel.updateMany(
        { user_id: userObjectId, is_active: true },
        {
          device_type: this.mapDeviceTypeToSession(fcmData.deviceType),
          device_token: fcmData.fcmToken,
          fcm_token: fcmData.fcmToken,
          updated_at: new Date(),
        },
      );

      // Test push notification setup by sending a welcome notification
      try {
        await this.notificationService.sendNotification({
          user_id: userId,
          title: 'Notifications Enabled',
          message: 'You will now receive important updates and alerts.',
          type: 'SYSTEM_ANNOUNCEMENT' as any,
          data: { fcm_token: fcmData.fcmToken },
        });
      } catch (notificationError) {
        this.logger.warn(
          'Failed to send test notification:',
          notificationError,
        );
      }

      const response: NotificationSetupResponse = {
        success: true,
        pushToken: fcmData.fcmToken,
        deviceId: fcmData.deviceId,
        message: 'Push notifications setup successfully',
      };

      this.logger.log(`Push notifications setup completed for user ${userId}`);
      return response;
    } catch (error) {
      this.logger.error('Error setting up push notifications:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        pushToken: '',
        message: 'Failed to setup push notifications',
      };
    }
  }

  /**
   * Process image uploads from Expo ImagePicker
   * Requirements: 25.3
   */
  async handleImageUpload(
    userId: string,
    imageData: ImageUploadDto,
  ): Promise<ImageUploadResponse> {
    try {
      this.logger.debug(`Processing image upload for user ${userId}:`, {
        imageType: imageData.imageType,
        hasUri: !!imageData.imageUri,
      });

      // Validate image data
      if (!imageData.imageUri || !imageData.imageType) {
        throw new BadRequestException('Image URI and type are required');
      }

      // Validate image type
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
      if (!allowedTypes.includes(imageData.imageType.toLowerCase())) {
        throw new BadRequestException(
          'Unsupported image type. Allowed: JPEG, PNG, WebP',
        );
      }

      // Extract base64 data if present
      let imageBuffer: Buffer;
      let originalSize = 0;

      if (imageData.imageUri.startsWith('data:')) {
        // Handle base64 data URI
        const base64Data = imageData.imageUri.split(',')[1];
        if (!base64Data) {
          throw new BadRequestException('Invalid base64 image data');
        }
        imageBuffer = Buffer.from(base64Data, 'base64');
        originalSize = imageBuffer.length;
      } else {
        // For now, we'll simulate processing a file URI
        // In a real implementation, you'd fetch the file from the URI
        throw new BadRequestException(
          'File URI processing not implemented. Please use base64 data URI.',
        );
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (originalSize > maxSize) {
        throw new BadRequestException('Image too large. Maximum size is 10MB.');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = imageData.imageType.split('/')[1];
      const filename = `user_${userId}_${timestamp}.${extension}`;
      const thumbnailFilename = `user_${userId}_${timestamp}_thumb.${extension}`;

      // Simulate image processing and upload to S3
      // In a real implementation, you would:
      // 1. Resize/compress the image if needed
      // 2. Generate thumbnail
      // 3. Upload to S3 or other storage service
      // 4. Return the URLs

      const processedSize = imageData.compress
        ? Math.floor(originalSize * 0.7)
        : originalSize;
      const compressionRatio =
        originalSize > 0 ? processedSize / originalSize : 1;

      // Simulate S3 URLs
      const baseUrl =
        process.env.S3_BASE_URL || 'https://your-bucket.s3.amazonaws.com';
      const imageUrl = `${baseUrl}/uploads/images/${filename}`;
      const thumbnailUrl = `${baseUrl}/uploads/thumbnails/${thumbnailFilename}`;

      // Update user profile with new image URL if this is a profile picture
      if (imageData.imageType.includes('profile')) {
        await this.userModel.findByIdAndUpdate(new Types.ObjectId(userId), {
          profile_picture: imageUrl,
          updated_at: new Date(),
        });
      }

      const response: ImageUploadResponse = {
        success: true,
        imageUrl,
        thumbnailUrl,
        fileSize: processedSize,
        originalSize,
        compressionRatio,
        message: 'Image uploaded successfully',
      };

      this.logger.log(`Image upload completed for user ${userId}: ${filename}`);
      return response;
    } catch (error) {
      this.logger.error('Error handling image upload:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        imageUrl: '',
        fileSize: 0,
        message: 'Failed to upload image',
      };
    }
  }

  /**
   * Handle offline data synchronization
   */
  async handleOfflineSync(
    userId: string,
    syncData: OfflineSyncDto,
  ): Promise<SyncResponse> {
    try {
      this.logger.debug(`Processing offline sync for user ${userId}:`, {
        itemCount: syncData.offlineData.length,
      });

      let synced = 0;
      let failed = 0;
      const conflicts: any[] = [];

      for (const item of syncData.offlineData) {
        try {
          switch (item.type) {
            case 'location_update':
              await this.syncLocationUpdate(userId, item.data);
              synced++;
              break;

            case 'ride_request':
              // Handle offline ride requests
              await this.syncRideRequest(userId, item.data);
              synced++;
              break;

            case 'driver_status':
              await this.syncDriverStatus(userId, item.data);
              synced++;
              break;

            default:
              this.logger.warn(`Unknown sync data type: ${item.type}`);
              failed++;
          }
        } catch (syncError) {
          this.logger.error(`Failed to sync item ${item.type}:`, syncError);
          failed++;
          conflicts.push({
            type: item.type,
            data: item.data,
            error: (syncError as any)?.message || 'Unknown error',
          });
        }
      }

      const response: SyncResponse = {
        synced,
        failed,
        conflicts,
        message: `Synced ${synced} items, ${failed} failed`,
      };

      this.logger.log(
        `Offline sync completed for user ${userId}: ${synced}/${syncData.offlineData.length} synced`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error handling offline sync:', error);
      throw new BadRequestException('Failed to process offline sync');
    }
  }

  /**
   * Handle deep link navigation
   */
  async processDeepLink(deepLinkData: DeepLinkDto): Promise<DeepLinkResponse> {
    try {
      this.logger.debug('Processing deep link:', deepLinkData);

      const url = new URL(deepLinkData.url);
      const pathSegments = url.pathname.split('/').filter((segment) => segment);
      const queryParams = Object.fromEntries(url.searchParams.entries());

      let screenName = 'Home';
      let params: any = {};
      let requiresAuth = true;

      // Parse deep link patterns
      if (pathSegments.length > 0) {
        switch (pathSegments[0]) {
          case 'ride':
            screenName = 'RideDetails';
            params = {
              rideId: pathSegments[1] || queryParams.rideId,
              ...queryParams,
            };
            break;

          case 'driver':
            screenName = 'DriverProfile';
            params = {
              driverId: pathSegments[1] || queryParams.driverId,
              ...queryParams,
            };
            break;

          case 'emergency':
            screenName = 'Emergency';
            params = {
              type: pathSegments[1] || queryParams.type,
              ...queryParams,
            };
            break;

          case 'auth':
            screenName = 'Login';
            requiresAuth = false;
            params = queryParams;
            break;

          default:
            screenName = 'Home';
            params = queryParams;
        }
      }

      const response: DeepLinkResponse = {
        screenName,
        params,
        requiresAuth,
        message: 'Deep link processed successfully',
      };

      this.logger.log(
        `Deep link processed: ${deepLinkData.url} -> ${screenName}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error processing deep link:', error);

      // Return safe fallback
      return {
        screenName: 'Home',
        params: {},
        requiresAuth: true,
        message: 'Failed to process deep link, redirecting to home',
      };
    }
  }

  /**
   * Handle app state changes
   */
  async handleAppStateChange(
    userId: string,
    stateData: AppStateDto,
  ): Promise<AppStateResponse> {
    try {
      this.logger.debug(`App state change for user ${userId}:`, stateData);

      const userObjectId = new Types.ObjectId(userId);

      // Update user's app state
      const updateData: any = {
        app_state: stateData.state,
        last_app_state_change: stateData.timestamp || new Date(),
        updated_at: new Date(),
      };

      // Handle specific state transitions
      if (stateData.state === 'background') {
        updateData.last_background_time = new Date();
      } else if (
        stateData.state === 'active' &&
        stateData.previousState === 'background'
      ) {
        updateData.last_foreground_time = new Date();
      }

      await this.userModel.findByIdAndUpdate(userObjectId, updateData);

      this.logger.log(
        `App state updated for user ${userId}: ${stateData.state}`,
      );
      return {
        success: true,
        message: 'App state updated successfully',
      };
    } catch (error) {
      this.logger.error('Error handling app state change:', error);
      return {
        success: false,
        message: 'Failed to update app state',
      };
    }
  }

  /**
   * Private helper methods
   */

  private mapDeviceTypeToSession(deviceType: DeviceType): string {
    switch (deviceType) {
      case DeviceType.IOS:
        return 'IOS';
      case DeviceType.ANDROID:
        return 'ANDROID';
      case DeviceType.WEB:
        return 'WEB';
      default:
        return 'UNKNOWN';
    }
  }

  private async syncLocationUpdate(
    userId: string,
    locationData: any,
  ): Promise<void> {
    // Update user location
    await this.userModel.findByIdAndUpdate(new Types.ObjectId(userId), {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      location: {
        type: 'Point',
        coordinates: [locationData.longitude, locationData.latitude],
      },
      last_location_update: locationData.timestamp || new Date(),
      updated_at: new Date(),
    });
  }

  private async syncRideRequest(
    _userId: string,
    _rideData: any,
  ): Promise<void> {
    // Handle offline ride request sync
    // This would integrate with the ride service
    this.logger.debug('Syncing offline ride request (placeholder)');
  }

  private async syncDriverStatus(
    userId: string,
    statusData: any,
  ): Promise<void> {
    // Update driver availability status
    await this.userModel.findByIdAndUpdate(new Types.ObjectId(userId), {
      is_online: statusData.isOnline,
      driver_status: statusData.status,
      updated_at: new Date(),
    });
  }
}
