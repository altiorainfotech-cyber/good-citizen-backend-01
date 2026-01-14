/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { MobileService } from './mobile.service';
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

@ApiTags('Mobile Platform Integration')
@Controller('mobile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  /**
   * Mobile Platform Integration Endpoints
   * Requirements: 25.1, 25.2, 25.3
   */

  @Post('location-permission')
  @ApiOperation({ summary: 'Handle Expo location permission status' })
  @ApiResponse({
    status: 200,
    description: 'Location permission processed',
    type: LocationPermissionResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid permission data' })
  @ApiBody({ type: LocationPermissionDto })
  @HttpCode(HttpStatus.OK)
  async handleLocationPermission(
    @Request() req: any,
    @Body() permissionData: LocationPermissionDto,
  ): Promise<LocationPermissionResponse> {
    return this.mobileService.handleLocationPermission(
      req.user.userId,
      permissionData,
    );
  }

  @Post('push-notifications/setup')
  @ApiOperation({ summary: 'Setup FCM push notifications' })
  @ApiResponse({
    status: 200,
    description: 'Push notifications setup',
    type: NotificationSetupResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid FCM token' })
  @ApiBody({ type: FCMTokenDto })
  @HttpCode(HttpStatus.OK)
  async setupPushNotifications(
    @Request() req: any,
    @Body() fcmData: FCMTokenDto,
  ): Promise<NotificationSetupResponse> {
    return this.mobileService.setupPushNotifications(req.user.userId, fcmData);
  }

  @Post('image-upload')
  @ApiOperation({ summary: 'Process image upload from Expo ImagePicker' })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    type: ImageUploadResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid image data' })
  @ApiBody({ type: ImageUploadDto })
  @HttpCode(HttpStatus.OK)
  async handleImageUpload(
    @Request() req: any,
    @Body() imageData: ImageUploadDto,
  ): Promise<ImageUploadResponse> {
    return this.mobileService.handleImageUpload(req.user.userId, imageData);
  }

  @Post('offline-sync')
  @ApiOperation({
    summary: 'Synchronize offline data when app comes back online',
  })
  @ApiResponse({
    status: 200,
    description: 'Offline data synchronized',
    type: SyncResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid sync data' })
  @ApiBody({ type: OfflineSyncDto })
  @HttpCode(HttpStatus.OK)
  async handleOfflineSync(
    @Request() req: any,
    @Body() syncData: OfflineSyncDto,
  ): Promise<SyncResponse> {
    return this.mobileService.handleOfflineSync(req.user.userId, syncData);
  }

  @Post('deep-link')
  @ApiOperation({ summary: 'Process deep link navigation' })
  @ApiResponse({
    status: 200,
    description: 'Deep link processed',
    type: DeepLinkResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid deep link' })
  @ApiBody({ type: DeepLinkDto })
  @HttpCode(HttpStatus.OK)
  async processDeepLink(
    @Body() deepLinkData: DeepLinkDto,
  ): Promise<DeepLinkResponse> {
    return this.mobileService.processDeepLink(deepLinkData);
  }

  @Post('app-state')
  @ApiOperation({ summary: 'Handle app state changes (background/foreground)' })
  @ApiResponse({
    status: 200,
    description: 'App state updated',
    type: AppStateResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid state data' })
  @ApiBody({ type: AppStateDto })
  @HttpCode(HttpStatus.OK)
  async handleAppStateChange(
    @Request() req: any,
    @Body() stateData: AppStateDto,
  ): Promise<AppStateResponse> {
    return this.mobileService.handleAppStateChange(req.user.userId, stateData);
  }

  /**
   * Navigation Integration Endpoints
   * Requirements: 22.1, 22.2, 22.3, 22.6
   */

  @Post('navigation/validate')
  @ApiOperation({
    summary: 'Validate navigation parameters for custom navigation system',
  })
  @ApiResponse({
    status: 200,
    description: 'Navigation validated',
    type: NavigationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid navigation data' })
  @ApiBody({ type: NavigationParamsDto })
  @HttpCode(HttpStatus.OK)
  async validateNavigation(
    @Body() navigationData: NavigationParamsDto,
  ): Promise<NavigationResponse> {
    return this.mobileService.validateNavigation(navigationData);
  }

  @Post('navigation/screen-state')
  @ApiOperation({
    summary: 'Preserve screen state for React Native state management',
  })
  @ApiResponse({
    status: 200,
    description: 'Screen state preserved',
    type: ScreenStateResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid state data' })
  @ApiBody({ type: ScreenStateDto })
  @HttpCode(HttpStatus.OK)
  async preserveScreenState(
    @Body() stateData: ScreenStateDto,
  ): Promise<ScreenStateResponse> {
    return this.mobileService.preserveScreenState(stateData);
  }

  @Post('navigation/validate-params')
  @ApiOperation({ summary: 'Validate route parameters for screen navigation' })
  @ApiResponse({
    status: 200,
    description: 'Route parameters validated',
    type: RouteParamsValidationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiBody({ type: RouteParamsValidationDto })
  @HttpCode(HttpStatus.OK)
  async validateRouteParams(
    @Body() validationData: RouteParamsValidationDto,
  ): Promise<RouteParamsValidationResponse> {
    return this.mobileService.validateRouteParams(validationData);
  }

  @Post('navigation/history')
  @ApiOperation({
    summary: 'Process navigation history for back navigation support',
  })
  @ApiResponse({
    status: 200,
    description: 'Navigation history processed',
    type: NavigationHistoryResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid history data' })
  @ApiBody({ type: NavigationHistoryDto })
  @HttpCode(HttpStatus.OK)
  async processNavigationHistory(
    @Body() historyData: NavigationHistoryDto,
  ): Promise<NavigationHistoryResponse> {
    return this.mobileService.processNavigationHistory(historyData);
  }

  @Post('navigation/deep-link/validate')
  @ApiOperation({ summary: 'Validate deep link for navigation compatibility' })
  @ApiResponse({
    status: 200,
    description: 'Deep link validated',
    type: DeepLinkValidationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid deep link' })
  @ApiBody({ type: DeepLinkValidationDto })
  @HttpCode(HttpStatus.OK)
  async validateDeepLink(
    @Body() deepLinkData: DeepLinkValidationDto,
  ): Promise<DeepLinkValidationResponse> {
    return this.mobileService.validateDeepLink(deepLinkData);
  }

  @Post('navigation/back')
  @ApiOperation({ summary: 'Handle back navigation with proper data flow' })
  @ApiResponse({
    status: 200,
    description: 'Back navigation processed',
    type: BackNavigationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid back navigation data' })
  @ApiBody({ type: BackNavigationDto })
  @HttpCode(HttpStatus.OK)
  async handleBackNavigation(
    @Body() backData: BackNavigationDto,
  ): Promise<BackNavigationResponse> {
    return this.mobileService.handleBackNavigation(backData);
  }

  /**
   * Specialized Navigation Endpoints
   */

  @Post('navigation/ride')
  @ApiOperation({ summary: 'Create ride-specific navigation data' })
  @ApiResponse({
    status: 200,
    description: 'Ride navigation created',
    type: NavigationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid ride data' })
  @ApiBody({ type: RideNavigationDto })
  @HttpCode(HttpStatus.OK)
  async createRideNavigation(
    @Body() rideData: RideNavigationDto,
  ): Promise<NavigationResponse> {
    return this.mobileService.createRideNavigation(rideData);
  }

  @Post('navigation/driver')
  @ApiOperation({ summary: 'Create driver-specific navigation data' })
  @ApiResponse({
    status: 200,
    description: 'Driver navigation created',
    type: NavigationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid driver data' })
  @ApiBody({ type: DriverNavigationDto })
  @HttpCode(HttpStatus.OK)
  async createDriverNavigation(
    @Body() driverData: DriverNavigationDto,
  ): Promise<NavigationResponse> {
    return this.mobileService.createDriverNavigation(driverData);
  }

  @Post('navigation/emergency')
  @ApiOperation({ summary: 'Create emergency-specific navigation data' })
  @ApiResponse({
    status: 200,
    description: 'Emergency navigation created',
    type: NavigationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid emergency data' })
  @ApiBody({ type: EmergencyNavigationDto })
  @HttpCode(HttpStatus.OK)
  async createEmergencyNavigation(
    @Body() emergencyData: EmergencyNavigationDto,
  ): Promise<NavigationResponse> {
    return this.mobileService.createEmergencyNavigation(emergencyData);
  }

  @Post('navigation/auth')
  @ApiOperation({ summary: 'Create authentication-specific navigation data' })
  @ApiResponse({
    status: 200,
    description: 'Auth navigation created',
    type: NavigationResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid auth data' })
  @ApiBody({ type: AuthNavigationDto })
  @HttpCode(HttpStatus.OK)
  async createAuthNavigation(
    @Body() authData: AuthNavigationDto,
  ): Promise<NavigationResponse> {
    return this.mobileService.createAuthNavigation(authData);
  }

  /**
   * Combined Mobile + Navigation Features
   */

  @Post('deep-link/full')
  @ApiOperation({
    summary: 'Handle deep link with both platform and navigation processing',
  })
  @ApiResponse({ status: 200, description: 'Deep link fully processed' })
  @ApiResponse({ status: 400, description: 'Invalid deep link' })
  @ApiBody({ type: DeepLinkDto })
  @HttpCode(HttpStatus.OK)
  async handleMobileDeepLink(
    @Request() req: any,
    @Body() deepLinkData: DeepLinkDto,
  ): Promise<{
    platformResponse: DeepLinkResponse;
    navigationResponse: DeepLinkValidationResponse;
  }> {
    return this.mobileService.handleMobileDeepLink(
      req.user.userId,
      deepLinkData,
    );
  }

  @Post('navigation/with-state')
  @ApiOperation({
    summary: 'Handle navigation with automatic state preservation',
  })
  @ApiResponse({
    status: 200,
    description: 'Navigation with state preservation completed',
  })
  @ApiResponse({ status: 400, description: 'Invalid navigation or state data' })
  @HttpCode(HttpStatus.OK)
  async handleNavigationWithStatePreservation(
    @Request() req: any,
    @Body()
    data: {
      navigation: NavigationParamsDto;
      currentState?: Record<string, any>;
    },
  ): Promise<{
    navigationResponse: NavigationResponse;
    stateResponse: ScreenStateResponse;
  }> {
    return this.mobileService.handleNavigationWithStatePreservation(
      req.user.userId,
      data.navigation,
      data.currentState,
    );
  }

  /**
   * Status and Health Check Endpoints
   */

  @Get('status')
  @ApiOperation({ summary: 'Get mobile feature status for current user' })
  @ApiResponse({ status: 200, description: 'Mobile feature status retrieved' })
  async getMobileFeatureStatus(@Request() req: any): Promise<{
    locationPermission: boolean;
    pushNotifications: boolean;
    offlineSync: boolean;
    deepLinking: boolean;
    navigation: boolean;
  }> {
    return this.mobileService.getMobileFeatureStatus(req.user.userId);
  }

  @Post('compatibility')
  @ApiOperation({ summary: 'Validate mobile app compatibility' })
  @ApiResponse({ status: 200, description: 'Compatibility check completed' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        platform: { type: 'string', example: 'ios' },
        version: { type: 'string', example: '15.0' },
        appVersion: { type: 'string', example: '1.0.0' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async validateMobileCompatibility(
    @Body()
    deviceInfo: {
      platform: string;
      version: string;
      appVersion: string;
    },
  ): Promise<{
    compatible: boolean;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    recommendations: string[];
  }> {
    return this.mobileService.validateMobileCompatibility(deviceInfo);
  }
}
