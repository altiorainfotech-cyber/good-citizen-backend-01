/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { MobilePlatformService } from './mobile-platform.service';
import { NavigationService } from './navigation.service';
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
} from './dto/mobile-platform.dto';
import {
  NavigationParamsDto,
  NavigationResponse,
  ScreenStateDto,
  ScreenStateResponse,
  RouteParamsValidationDto,
  RouteParamsValidationResponse,
  NavigationHistoryDto,
  NavigationHistoryResponse,
  DeepLinkValidationDto,
  DeepLinkValidationResponse,
  BackNavigationDto,
  BackNavigationResponse,
  RideNavigationDto,
  DriverNavigationDto,
  EmergencyNavigationDto,
  AuthNavigationDto,
} from './dto/navigation.dto';

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private mobilePlatformService: MobilePlatformService,
    private navigationService: NavigationService,
  ) {}

  /**
   * Mobile Platform Integration Methods
   * Requirements: 25.1, 25.2, 25.3
   */

  async handleLocationPermission(
    userId: string,
    permissionData: LocationPermissionDto,
  ): Promise<LocationPermissionResponse> {
    this.logger.debug(`Handling location permission for user ${userId}`);
    return this.mobilePlatformService.handleLocationPermission(
      userId,
      permissionData,
    );
  }

  async setupPushNotifications(
    userId: string,
    fcmData: FCMTokenDto,
  ): Promise<NotificationSetupResponse> {
    this.logger.debug(`Setting up push notifications for user ${userId}`);
    return this.mobilePlatformService.setupPushNotifications(userId, fcmData);
  }

  async handleImageUpload(
    userId: string,
    imageData: ImageUploadDto,
  ): Promise<ImageUploadResponse> {
    this.logger.debug(`Handling image upload for user ${userId}`);
    return this.mobilePlatformService.handleImageUpload(userId, imageData);
  }

  async handleOfflineSync(
    userId: string,
    syncData: OfflineSyncDto,
  ): Promise<SyncResponse> {
    this.logger.debug(`Handling offline sync for user ${userId}`);
    return this.mobilePlatformService.handleOfflineSync(userId, syncData);
  }

  async processDeepLink(deepLinkData: DeepLinkDto): Promise<DeepLinkResponse> {
    this.logger.debug('Processing deep link');
    return this.mobilePlatformService.processDeepLink(deepLinkData);
  }

  async handleAppStateChange(
    userId: string,
    stateData: AppStateDto,
  ): Promise<AppStateResponse> {
    this.logger.debug(`Handling app state change for user ${userId}`);
    return this.mobilePlatformService.handleAppStateChange(userId, stateData);
  }

  /**
   * Navigation Service Methods
   * Requirements: 22.1, 22.2, 22.3, 22.6
   */

  async validateNavigation(
    navigationData: NavigationParamsDto,
  ): Promise<NavigationResponse> {
    this.logger.debug('Validating navigation');
    return this.navigationService.validateNavigation(navigationData);
  }

  async preserveScreenState(
    stateData: ScreenStateDto,
  ): Promise<ScreenStateResponse> {
    this.logger.debug('Preserving screen state');
    return this.navigationService.preserveScreenState(stateData);
  }

  async validateRouteParams(
    validationData: RouteParamsValidationDto,
  ): Promise<RouteParamsValidationResponse> {
    this.logger.debug('Validating route parameters');
    return this.navigationService.validateRouteParams(validationData);
  }

  async processNavigationHistory(
    historyData: NavigationHistoryDto,
  ): Promise<NavigationHistoryResponse> {
    this.logger.debug('Processing navigation history');
    return this.navigationService.processNavigationHistory(historyData);
  }

  async validateDeepLink(
    deepLinkData: DeepLinkValidationDto,
  ): Promise<DeepLinkValidationResponse> {
    this.logger.debug('Validating deep link');
    return this.navigationService.validateDeepLink(deepLinkData);
  }

  async handleBackNavigation(
    backData: BackNavigationDto,
  ): Promise<BackNavigationResponse> {
    this.logger.debug('Handling back navigation');
    return this.navigationService.handleBackNavigation(backData);
  }

  /**
   * Specialized Navigation Methods
   */

  async createRideNavigation(
    rideData: RideNavigationDto,
  ): Promise<NavigationResponse> {
    this.logger.debug('Creating ride navigation');
    return this.navigationService.createRideNavigation(rideData);
  }

  async createDriverNavigation(
    driverData: DriverNavigationDto,
  ): Promise<NavigationResponse> {
    this.logger.debug('Creating driver navigation');
    return this.navigationService.createDriverNavigation(driverData);
  }

  async createEmergencyNavigation(
    emergencyData: EmergencyNavigationDto,
  ): Promise<NavigationResponse> {
    this.logger.debug('Creating emergency navigation');
    return this.navigationService.createEmergencyNavigation(emergencyData);
  }

  async createAuthNavigation(
    authData: AuthNavigationDto,
  ): Promise<NavigationResponse> {
    this.logger.debug('Creating auth navigation');
    return this.navigationService.createAuthNavigation(authData);
  }

  /**
   * Combined Mobile + Navigation Features
   */

  async handleMobileDeepLink(
    userId: string,
    deepLinkData: DeepLinkDto,
  ): Promise<{
    platformResponse: DeepLinkResponse;
    navigationResponse: DeepLinkValidationResponse;
  }> {
    this.logger.debug(`Handling mobile deep link for user ${userId}`);

    // Process deep link through platform service
    const platformResponse =
      await this.mobilePlatformService.processDeepLink(deepLinkData);

    // Validate navigation through navigation service
    const navigationResponse = await this.navigationService.validateDeepLink({
      url: deepLinkData.url,
      userId,
    });

    return {
      platformResponse,
      navigationResponse,
    };
  }

  async handleNavigationWithStatePreservation(
    userId: string,
    navigationData: NavigationParamsDto,
    currentState?: Record<string, any>,
  ): Promise<{
    navigationResponse: NavigationResponse;
    stateResponse: ScreenStateResponse;
  }> {
    this.logger.debug(
      `Handling navigation with state preservation for user ${userId}`,
    );

    // Validate navigation
    const navigationResponse =
      await this.navigationService.validateNavigation(navigationData);

    // Preserve current screen state if provided
    let stateResponse: ScreenStateResponse = { success: true };
    if (currentState && navigationData.screenName) {
      stateResponse = await this.navigationService.preserveScreenState({
        screenName: navigationData.screenName,
        state: currentState,
        userId,
        timestamp: new Date(),
      });
    }

    return {
      navigationResponse,
      stateResponse,
    };
  }

  /**
   * Health Check and Status Methods
   */

  async getMobileFeatureStatus(userId: string): Promise<{
    locationPermission: boolean;
    pushNotifications: boolean;
    offlineSync: boolean;
    deepLinking: boolean;
    navigation: boolean;
  }> {
    this.logger.debug(`Getting mobile feature status for user ${userId}`);

    // This would typically check the user's current settings and capabilities
    // For now, return a basic status check
    return {
      locationPermission: true,
      pushNotifications: true,
      offlineSync: true,
      deepLinking: true,
      navigation: true,
    };
  }

  async validateMobileCompatibility(deviceInfo: {
    platform: string;
    version: string;
    appVersion: string;
  }): Promise<{
    compatible: boolean;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    recommendations: string[];
  }> {
    this.logger.debug('Validating mobile compatibility:', deviceInfo);

    const supportedFeatures: string[] = [];
    const unsupportedFeatures: string[] = [];
    const recommendations: string[] = [];

    // Basic compatibility checks
    const features = [
      'location_services',
      'push_notifications',
      'image_upload',
      'offline_sync',
      'deep_linking',
      'background_location',
    ];

    // For now, assume all features are supported
    // In a real implementation, you'd check device capabilities
    supportedFeatures.push(...features);

    const compatible = unsupportedFeatures.length === 0;

    if (!compatible) {
      recommendations.push('Please update your app to the latest version');
      recommendations.push('Ensure your device OS is up to date');
    }

    return {
      compatible,
      supportedFeatures,
      unsupportedFeatures,
      recommendations,
    };
  }
}
