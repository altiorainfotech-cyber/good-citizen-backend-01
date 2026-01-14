/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { VersionInterceptor } from './version.interceptor';
import {
  SessionCompatibilityService,
  LegacySessionData,
} from './session-compatibility.service';
import { EnumMappingService } from './enum-mapping.service';
import { ApiVersion, ApiVersions } from './api-version.decorator';
import { Roles } from '../../authentication/roles.decorator';
import { UserType } from '../utils';

export class LegacySessionMigrationDto {
  sessions: LegacySessionData[];
}

export class EnumMappingRequestDto {
  enumType:
    | 'ride_status'
    | 'vehicle_type'
    | 'user_role'
    | 'device_type'
    | 'approval_status';
  values: string[];
  toLegacy?: boolean;
}

/**
 * Controller to handle legacy API compatibility and migration endpoints
 * Requirements: 19.3, 19.5, 19.6, 19.7 - API versioning and backward compatibility
 */
@ApiTags('Legacy Compatibility')
@Controller('legacy')
@UseGuards(JwtAuthGuard)
@UseInterceptors(VersionInterceptor)
@ApiBearerAuth()
@ApiVersion(ApiVersions.LEGACY)
export class LegacyCompatibilityController {
  private readonly logger = new Logger(LegacyCompatibilityController.name);

  constructor(
    private readonly sessionCompatibilityService: SessionCompatibilityService,
    private readonly enumMappingService: EnumMappingService,
  ) {}

  @Post('sessions/migrate')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Migrate legacy sessions to new format' })
  @ApiResponse({ status: 200, description: 'Session migration completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async migrateLegacySessions(@Body() body: LegacySessionMigrationDto) {
    this.logger.log(
      `Received request to migrate ${body.sessions.length} legacy sessions`,
    );
    return await this.sessionCompatibilityService.migrateLegacySessions(
      body.sessions,
    );
  }

  @Post('sessions/cleanup')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Clean up expired legacy sessions' })
  @ApiResponse({ status: 200, description: 'Session cleanup completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async cleanupExpiredSessions() {
    this.logger.log('Received request to cleanup expired sessions');
    return await this.sessionCompatibilityService.cleanupExpiredSessions();
  }

  @Get('sessions/validate/:token')
  @ApiOperation({ summary: 'Validate legacy token' })
  @ApiResponse({ status: 200, description: 'Token validation result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validateLegacyToken(@Param('token') token: string) {
    this.logger.log('Received request to validate legacy token');
    return await this.sessionCompatibilityService.validateLegacyToken(token);
  }

  @Get('sessions/user/:userId')
  @ApiOperation({ summary: 'Get user sessions in legacy format' })
  @ApiResponse({ status: 200, description: 'User sessions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserSessions(@Param('userId') userId: string) {
    this.logger.log(`Received request to get sessions for user: ${userId}`);
    const sessions =
      await this.sessionCompatibilityService.getUserSessions(userId);
    return sessions.map((session) =>
      this.sessionCompatibilityService.convertToLegacyFormat(session),
    );
  }

  @Post('enums/map')
  @ApiOperation({ summary: 'Map enum values between legacy and new formats' })
  @ApiResponse({ status: 200, description: 'Enum mapping completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async mapEnumValues(@Body() body: EnumMappingRequestDto) {
    this.logger.log(`Received request to map ${body.enumType} values`);

    const mappedValues = body.values.map((value) => {
      switch (body.enumType) {
        case 'ride_status':
          return this.enumMappingService.mapRideStatus(value, body.toLegacy);
        case 'vehicle_type':
          return this.enumMappingService.mapVehicleType(value, body.toLegacy);
        case 'user_role':
          return this.enumMappingService.mapUserRole(value, body.toLegacy);
        case 'device_type':
          return this.enumMappingService.mapDeviceType(value, body.toLegacy);
        case 'approval_status':
          return this.enumMappingService.mapApprovalStatus(
            value,
            body.toLegacy,
          );
        default:
          return value;
      }
    });

    return {
      enumType: body.enumType,
      originalValues: body.values,
      mappedValues,
      toLegacy: body.toLegacy || false,
    };
  }

  @Get('enums/mappings/:enumType')
  @ApiOperation({ summary: 'Get available enum mappings' })
  @ApiResponse({ status: 200, description: 'Enum mappings retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEnumMappings(
    @Param('enumType')
    enumType:
      | 'ride_status'
      | 'vehicle_type'
      | 'user_role'
      | 'device_type'
      | 'approval_status',
  ) {
    this.logger.log(`Received request to get mappings for: ${enumType}`);
    return {
      enumType,
      mappings: this.enumMappingService.getAvailableMappings(enumType),
    };
  }

  @Get('enums/migration-recommendations')
  @ApiOperation({
    summary: 'Get migration recommendations for deprecated enum values',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration recommendations retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMigrationRecommendations() {
    this.logger.log('Received request for migration recommendations');
    return this.enumMappingService.getMigrationRecommendations();
  }

  @Post('enums/validate')
  @ApiOperation({ summary: 'Validate enum values' })
  @ApiResponse({ status: 200, description: 'Enum validation completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validateEnumValues(
    @Body() body: { enumType: string; values: string[] },
  ) {
    this.logger.log(`Received request to validate ${body.enumType} values`);

    const validationResults = body.values.map((value) => ({
      value,
      isValid: this.enumMappingService.isValidEnumValue(
        value,
        body.enumType as
          | 'ride_status'
          | 'vehicle_type'
          | 'user_role'
          | 'device_type'
          | 'approval_status',
      ),
    }));

    return {
      enumType: body.enumType,
      validationResults,
      totalValues: body.values.length,
      validValues: validationResults.filter((r) => r.isValid).length,
      invalidValues: validationResults.filter((r) => !r.isValid).length,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Legacy API health check' })
  @ApiResponse({ status: 200, description: 'Legacy API is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      version: ApiVersions.LEGACY,
      timestamp: new Date().toISOString(),
      message: 'Legacy compatibility layer is operational',
      deprecationWarning:
        'This API version is deprecated. Please migrate to v2.0',
      migrationGuide: '/docs/api/migration-guide',
    };
  }
}
