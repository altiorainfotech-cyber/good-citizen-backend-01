/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable no-case-declarations */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
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

interface ScreenConfig {
  requiresAuth: boolean;
  allowedParams: string[];
  requiredParams: string[];
  paramValidators?: Record<string, (value: any) => boolean>;
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  // Screen configuration for validation and navigation
  private readonly screenConfigs: Record<string, ScreenConfig> = {
    // User App Screens
    Home: {
      requiresAuth: true,
      allowedParams: ['tab', 'initialLocation'],
      requiredParams: [],
    },
    RideRequest: {
      requiresAuth: true,
      allowedParams: ['pickupLocation', 'destinationLocation', 'vehicleType'],
      requiredParams: [],
    },
    RideDetails: {
      requiresAuth: true,
      allowedParams: ['rideId', 'action'],
      requiredParams: ['rideId'],
      paramValidators: {
        rideId: (value) => Types.ObjectId.isValid(value),
      },
    },
    RideTracking: {
      requiresAuth: true,
      allowedParams: ['rideId', 'driverId'],
      requiredParams: ['rideId'],
      paramValidators: {
        rideId: (value) => Types.ObjectId.isValid(value),
        driverId: (value) => !value || Types.ObjectId.isValid(value),
      },
    },
    DriverProfile: {
      requiresAuth: true,
      allowedParams: ['driverId', 'action'],
      requiredParams: ['driverId'],
      paramValidators: {
        driverId: (value) => Types.ObjectId.isValid(value),
      },
    },
    Emergency: {
      requiresAuth: true,
      allowedParams: ['emergencyType', 'emergencyId', 'location'],
      requiredParams: ['emergencyType'],
    },
    Profile: {
      requiresAuth: true,
      allowedParams: ['section'],
      requiredParams: [],
    },
    Settings: {
      requiresAuth: true,
      allowedParams: ['section'],
      requiredParams: [],
    },
    RideHistory: {
      requiresAuth: true,
      allowedParams: ['page', 'filter'],
      requiredParams: [],
    },

    // Partner App Screens (Driver/Ambulance)
    DriverHome: {
      requiresAuth: true,
      allowedParams: ['status'],
      requiredParams: [],
    },
    RideOffer: {
      requiresAuth: true,
      allowedParams: [
        'rideId',
        'pickupLocation',
        'destinationLocation',
        'estimatedFare',
      ],
      requiredParams: ['rideId'],
      paramValidators: {
        rideId: (value) => Types.ObjectId.isValid(value),
      },
    },
    ActiveRide: {
      requiresAuth: true,
      allowedParams: ['rideId', 'status'],
      requiredParams: ['rideId'],
      paramValidators: {
        rideId: (value) => Types.ObjectId.isValid(value),
      },
    },
    DriverEarnings: {
      requiresAuth: true,
      allowedParams: ['period', 'detailed'],
      requiredParams: [],
    },
    AmbulanceDriver: {
      requiresAuth: true,
      allowedParams: ['emergencyId', 'status'],
      requiredParams: [],
    },

    // Auth Screens
    Login: {
      requiresAuth: false,
      allowedParams: ['redirectTo', 'redirectParams', 'authProvider'],
      requiredParams: [],
    },
    Register: {
      requiresAuth: false,
      allowedParams: ['userType', 'redirectTo'],
      requiredParams: [],
    },
    ForgotPassword: {
      requiresAuth: false,
      allowedParams: ['email'],
      requiredParams: [],
    },
    VerifyEmail: {
      requiresAuth: false,
      allowedParams: ['token', 'email'],
      requiredParams: [],
    },

    // Onboarding
    Onboarding: {
      requiresAuth: false,
      allowedParams: ['step'],
      requiredParams: [],
    },
    Splash: {
      requiresAuth: false,
      allowedParams: [],
      requiredParams: [],
    },
  };

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /**
   * Validate and process navigation parameters
   * Requirements: 22.1, 22.2
   */
  async validateNavigation(
    navigationData: NavigationParamsDto,
  ): Promise<NavigationResponse> {
    try {
      this.logger.debug('Validating navigation:', navigationData);

      const { screenName, params = {}, action = 'navigate' } = navigationData;

      // Check if screen exists in configuration
      const screenConfig = this.screenConfigs[screenName];
      if (!screenConfig) {
        throw new BadRequestException(`Unknown screen: ${screenName}`);
      }

      // Validate required parameters
      for (const requiredParam of screenConfig.requiredParams) {
        if (!(requiredParam in params)) {
          throw new BadRequestException(
            `Missing required parameter: ${requiredParam}`,
          );
        }
      }

      // Validate parameter values
      const validationErrors: string[] = [];
      if (screenConfig.paramValidators) {
        for (const [paramName, validator] of Object.entries(
          screenConfig.paramValidators,
        )) {
          if (paramName in params && !validator(params[paramName])) {
            validationErrors.push(`Invalid value for parameter: ${paramName}`);
          }
        }
      }

      if (validationErrors.length > 0) {
        throw new BadRequestException(
          `Parameter validation failed: ${validationErrors.join(', ')}`,
        );
      }

      // Sanitize parameters (only keep allowed ones)
      const sanitizedParams: Record<string, any> = {};
      for (const allowedParam of screenConfig.allowedParams) {
        if (allowedParam in params) {
          sanitizedParams[allowedParam] = params[allowedParam];
        }
      }

      // Add any required parameters that might be missing but have defaults
      this.addDefaultParameters(screenName, sanitizedParams);

      const response: NavigationResponse = {
        success: true,
        screenName,
        params: sanitizedParams,
        message: `Navigation to ${screenName} validated successfully`,
      };

      this.logger.log(
        `Navigation validated: ${screenName} with action ${action}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error validating navigation:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to validate navigation');
    }
  }

  /**
   * Handle screen state preservation
   * Requirements: 22.6
   */
  async preserveScreenState(
    stateData: ScreenStateDto,
  ): Promise<ScreenStateResponse> {
    try {
      this.logger.debug('Preserving screen state:', {
        screenName: stateData.screenName,
        hasUserId: !!stateData.userId,
      });

      // Validate screen exists
      if (!this.screenConfigs[stateData.screenName]) {
        throw new BadRequestException(
          `Unknown screen: ${stateData.screenName}`,
        );
      }

      // If userId is provided, store state in user document
      if (stateData.userId) {
        const userObjectId = new Types.ObjectId(stateData.userId);

        await this.userModel.findByIdAndUpdate(userObjectId, {
          [`screen_states.${stateData.screenName}`]: {
            state: stateData.state,
            timestamp: stateData.timestamp || new Date(),
          },
          updated_at: new Date(),
        });
      }

      this.logger.log(`Screen state preserved for ${stateData.screenName}`);
      return {
        success: true,
        message: 'Screen state preserved successfully',
      };
    } catch (error) {
      this.logger.error('Error preserving screen state:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        message: 'Failed to preserve screen state',
      };
    }
  }

  /**
   * Validate route parameters
   */
  async validateRouteParams(
    validationData: RouteParamsValidationDto,
  ): Promise<RouteParamsValidationResponse> {
    try {
      const { screenName, params } = validationData;

      const screenConfig = this.screenConfigs[screenName];
      if (!screenConfig) {
        return {
          valid: false,
          sanitizedParams: {},
          errors: [`Unknown screen: ${screenName}`],
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const sanitizedParams: Record<string, any> = {};

      // Check required parameters
      for (const requiredParam of screenConfig.requiredParams) {
        if (!(requiredParam in params)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }

      // Validate and sanitize parameters
      for (const [paramName, paramValue] of Object.entries(params)) {
        if (screenConfig.allowedParams.includes(paramName)) {
          // Validate parameter if validator exists
          if (screenConfig.paramValidators?.[paramName]) {
            if (screenConfig.paramValidators[paramName](paramValue)) {
              sanitizedParams[paramName] = paramValue;
            } else {
              errors.push(`Invalid value for parameter: ${paramName}`);
            }
          } else {
            sanitizedParams[paramName] = paramValue;
          }
        } else {
          warnings.push(`Unknown parameter will be ignored: ${paramName}`);
        }
      }

      return {
        valid: errors.length === 0,
        sanitizedParams,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      this.logger.error('Error validating route params:', error);
      return {
        valid: false,
        sanitizedParams: {},
        errors: ['Failed to validate route parameters'],
      };
    }
  }

  /**
   * Process navigation history
   */
  async processNavigationHistory(
    historyData: NavigationHistoryDto,
  ): Promise<NavigationHistoryResponse> {
    try {
      this.logger.debug('Processing navigation history:', {
        itemCount: historyData.history.length,
        hasUserId: !!historyData.userId,
      });

      // Validate each history item
      let validItems = 0;
      for (const item of historyData.history) {
        if (this.screenConfigs[item.screenName]) {
          validItems++;
        }
      }

      // Store history if userId is provided
      if (historyData.userId) {
        const userObjectId = new Types.ObjectId(historyData.userId);

        await this.userModel.findByIdAndUpdate(userObjectId, {
          navigation_history: historyData.history.slice(-20), // Keep last 20 items
          updated_at: new Date(),
        });
      }

      return {
        success: true,
        historyCount: validItems,
        message: `Processed ${validItems}/${historyData.history.length} navigation history items`,
      };
    } catch (error) {
      this.logger.error('Error processing navigation history:', error);
      return {
        success: false,
        historyCount: 0,
        message: 'Failed to process navigation history',
      };
    }
  }

  /**
   * Validate deep link
   * Requirements: 22.3
   */
  async validateDeepLink(
    deepLinkData: DeepLinkValidationDto,
  ): Promise<DeepLinkValidationResponse> {
    try {
      this.logger.debug('Validating deep link:', deepLinkData);

      const url = new URL(deepLinkData.url);
      const pathSegments = url.pathname.split('/').filter((segment) => segment);
      const queryParams = Object.fromEntries(url.searchParams.entries());

      let screenName = 'Home';
      let params: Record<string, any> = {};
      const errors: string[] = [];

      // Parse deep link patterns
      if (pathSegments.length > 0) {
        const route = pathSegments[0];

        switch (route) {
          case 'ride':
            screenName =
              pathSegments[1] === 'track' ? 'RideTracking' : 'RideDetails';
            params = {
              rideId: pathSegments[2] || queryParams.rideId,
              ...queryParams,
            };
            break;

          case 'driver':
            screenName = 'DriverProfile';
            params = {
              driverId: pathSegments[1] || queryParams.driverId,
              action: pathSegments[2] || queryParams.action,
              ...queryParams,
            };
            break;

          case 'emergency':
            screenName = 'Emergency';
            params = {
              emergencyType: pathSegments[1] || queryParams.type,
              emergencyId: queryParams.emergencyId,
              ...queryParams,
            };
            break;

          case 'auth':
            const authAction = pathSegments[1] || 'login';
            screenName =
              authAction === 'login'
                ? 'Login'
                : authAction === 'register'
                  ? 'Register'
                  : authAction === 'forgot-password'
                    ? 'ForgotPassword'
                    : authAction === 'verify'
                      ? 'VerifyEmail'
                      : 'Login';
            params = queryParams;
            break;

          default:
            errors.push(`Unknown route: ${route}`);
            screenName = 'Home';
        }
      }

      // Validate the resulting navigation
      const screenConfig = this.screenConfigs[screenName];
      if (!screenConfig) {
        errors.push(`Invalid screen: ${screenName}`);
        screenName = 'Home';
        params = {};
      } else {
        // Validate parameters
        const validation = await this.validateRouteParams({
          screenName,
          params,
        });
        if (!validation.valid) {
          errors.push(...(validation.errors || []));
        }
        params = validation.sanitizedParams;
      }

      return {
        valid: errors.length === 0,
        screenName,
        params,
        requiresAuth: this.screenConfigs[screenName]?.requiresAuth || true,
        errors: errors.length > 0 ? errors : undefined,
        message:
          errors.length === 0
            ? 'Deep link validated successfully'
            : 'Deep link validation failed',
      };
    } catch (error) {
      this.logger.error('Error validating deep link:', error);
      return {
        valid: false,
        screenName: 'Home',
        params: {},
        requiresAuth: true,
        errors: ['Failed to parse deep link'],
        message: 'Deep link validation failed',
      };
    }
  }

  /**
   * Handle back navigation
   */
  async handleBackNavigation(
    backData: BackNavigationDto,
  ): Promise<BackNavigationResponse> {
    try {
      this.logger.debug('Handling back navigation:', backData);

      // Default back navigation logic
      let targetScreen = 'Home';
      const targetParams: Record<string, any> = {};

      // Determine target screen based on current screen
      if (backData.currentScreen) {
        switch (backData.currentScreen) {
          case 'RideDetails':
          case 'RideTracking':
            targetScreen = 'RideHistory';
            break;

          case 'DriverProfile':
            targetScreen = 'Home';
            break;

          case 'Emergency':
            targetScreen = 'Home';
            break;

          case 'Settings':
          case 'Profile':
            targetScreen = 'Home';
            break;

          default:
            targetScreen = 'Home';
        }
      }

      return {
        success: true,
        targetScreen,
        targetParams,
        message: 'Back navigation processed successfully',
      };
    } catch (error) {
      this.logger.error('Error handling back navigation:', error);
      return {
        success: false,
        message: 'Failed to process back navigation',
      };
    }
  }

  /**
   * Helper methods for specific navigation types
   */

  async createRideNavigation(
    rideData: RideNavigationDto,
  ): Promise<NavigationResponse> {
    const screenName =
      rideData.action === 'track' ? 'RideTracking' : 'RideDetails';
    return this.validateNavigation({
      screenName,
      params: {
        rideId: rideData.rideId,
        action: rideData.action,
        ...rideData.additionalData,
      },
    });
  }

  async createDriverNavigation(
    driverData: DriverNavigationDto,
  ): Promise<NavigationResponse> {
    return this.validateNavigation({
      screenName: 'DriverProfile',
      params: {
        driverId: driverData.driverId,
        action: driverData.action,
        ...driverData.additionalData,
      },
    });
  }

  async createEmergencyNavigation(
    emergencyData: EmergencyNavigationDto,
  ): Promise<NavigationResponse> {
    return this.validateNavigation({
      screenName: 'Emergency',
      params: {
        emergencyType: emergencyData.emergencyType,
        emergencyId: emergencyData.emergencyId,
        location: emergencyData.location,
        ...emergencyData.additionalData,
      },
    });
  }

  async createAuthNavigation(
    authData: AuthNavigationDto,
  ): Promise<NavigationResponse> {
    const screenName =
      authData.authAction === 'login'
        ? 'Login'
        : authData.authAction === 'register'
          ? 'Register'
          : authData.authAction === 'forgot-password'
            ? 'ForgotPassword'
            : authData.authAction === 'verify'
              ? 'VerifyEmail'
              : 'Login';

    return this.validateNavigation({
      screenName,
      params: {
        redirectTo: authData.redirectTo,
        redirectParams: authData.redirectParams,
        ...authData.additionalData,
      },
    });
  }

  /**
   * Private helper methods
   */

  private addDefaultParameters(
    screenName: string,
    params: Record<string, any>,
  ): void {
    // Add default parameters based on screen
    switch (screenName) {
      case 'Home':
        if (!params.tab) {
          params.tab = 'map';
        }
        break;

      case 'RideHistory':
        if (!params.page) {
          params.page = 1;
        }
        break;

      case 'Settings':
        if (!params.section) {
          params.section = 'general';
        }
        break;
    }
  }
}
