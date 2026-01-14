import { Controller, Post, Body, Get, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  MigrationService,
  MigrationResult,
  LegacyUserData,
  LegacyRideData,
} from './migration.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from '../common/utils';

export class MigrationRequestDto {
  users?: LegacyUserData[];
  rides?: LegacyRideData[];
}

export class MigrationResponseDto {
  success: boolean;
  results: MigrationResult[];
  totalMigrated: number;
  totalErrors: number;
}

@ApiTags('Migration')
@Controller('migration')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(private readonly migrationService: MigrationService) {}

  @Post('users')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Migrate user data from legacy system' })
  @ApiResponse({
    status: 200,
    description: 'User migration completed',
    type: MigrationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async migrateUsers(
    @Body() body: { users: LegacyUserData[] },
  ): Promise<MigrationResult> {
    this.logger.log(`Received request to migrate ${body.users.length} users`);
    return await this.migrationService.migrateUserData(body.users);
  }

  @Post('rides')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Migrate ride history from legacy system' })
  @ApiResponse({
    status: 200,
    description: 'Ride migration completed',
    type: MigrationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async migrateRides(
    @Body() body: { rides: LegacyRideData[] },
  ): Promise<MigrationResult> {
    this.logger.log(`Received request to migrate ${body.rides.length} rides`);
    return await this.migrationService.migrateRideHistory(body.rides);
  }

  @Post('location-data')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Migrate location data to GeoJSON format' })
  @ApiResponse({
    status: 200,
    description: 'Location data migration completed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async migrateLocationData(): Promise<MigrationResult> {
    this.logger.log('Received request to migrate location data');
    return await this.migrationService.migrateLocationData();
  }

  @Post('indexes')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Create geospatial indexes for location queries' })
  @ApiResponse({ status: 200, description: 'Geospatial indexes created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async createIndexes(): Promise<MigrationResult> {
    this.logger.log('Received request to create geospatial indexes');
    return await this.migrationService.createGeospatialIndexes();
  }

  @Post('all')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Run complete migration process' })
  @ApiResponse({
    status: 200,
    description: 'Complete migration finished',
    type: MigrationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async runAllMigrations(
    @Body() body: MigrationRequestDto,
  ): Promise<MigrationResponseDto> {
    this.logger.log('Received request to run complete migration');

    const results = await this.migrationService.runAllMigrations(body);

    const totalMigrated = results.reduce(
      (sum, result) => sum + result.migratedCount,
      0,
    );
    const totalErrors = results.reduce(
      (sum, result) => sum + result.errorCount,
      0,
    );

    return {
      success: results.every((result) => result.success),
      results,
      totalMigrated,
      totalErrors,
    };
  }

  @Get('validate')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Validate migration data integrity' })
  @ApiResponse({ status: 200, description: 'Migration validation completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async validateMigration(): Promise<{ isValid: boolean; issues: string[] }> {
    this.logger.log('Received request to validate migration');
    return await this.migrationService.validateMigration();
  }
}
