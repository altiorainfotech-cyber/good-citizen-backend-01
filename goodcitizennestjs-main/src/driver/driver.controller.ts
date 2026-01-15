/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import {
  ID,
  RideDto,
  UploadVerification,
  UpdateAvailabilityDto,
} from './dto/driver.dto';
import { ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { UserType } from '../common/utils';
import { Roles } from '../authentication/roles.decorator';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import {
  FrontendIntegrationService,
  DriverSliceResponse,
} from '../common/frontend-integration.service';

@Controller({ path: 'driver', version: '1' })
export class DriverController {
  constructor(
    private readonly driverService: DriverService,
    private readonly frontendIntegration: FrontendIntegrationService,
  ) {}

  /**
   * Will handle the driver start ride controller logic
   * @param {RideDto} dto - The data of pickup and drop location
   * @returns
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('start-ride')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Driver Start Ride  Api` })
  async start_ride(@Body() dto: RideDto, @Req() req) {
    return await this.driverService.start_ride(dto, req.user);
  }

  /**
   * Will handle the ride detail controller logic
   * @returns
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('ride-detail/:id')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Driver Ride detail Api` })
  async ride_detail(@Param() ID: ID, @Req() req) {
    return await this.driverService.ride_detail(ID.id, req.user);
  }
  /**
   * dssfdskfd
   */
  /**
   * Will handle the end ride controller logic
   * @returns
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('end-ride/:id')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Driver End Ride Api` })
  async end_ride(@Param() ID: ID, @Req() req) {
    return await this.driverService.end_ride(ID.id, req.user);
  }

  /**
   * Will handle the ride detail controller logic
   * @returns
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('upload/verification')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Driver verification detail Api` })
  async upload_vrerification(@Body() dto: UploadVerification, @Req() req) {
    return await this.driverService.verification(dto, req.user);
  }

  /**
   * Get driver profile with documents status - formatted for Redux driverSlice
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('profile')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get driver profile Api` })
  async getDriverProfile(@Req() req): Promise<DriverSliceResponse> {
    const profile = await this.driverService.getDriverProfile(req.user);
    const earnings = await this.driverService.getDriverEarnings(req.user);
    const stats = await this.driverService.getDriverStatistics(req.user);

    return this.frontendIntegration.formatDriverResponse(
      req.user,
      null, // No current ride in profile endpoint
      earnings,
      stats,
    );
  }

  /**
   * Get driver earnings and statistics
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('earnings')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get driver earnings Api` })
  async getDriverEarnings(@Req() req) {
    return await this.driverService.getDriverEarnings(req.user);
  }

  /**
   * Get detailed driver statistics
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('statistics')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get driver statistics Api` })
  async getDriverStatistics(@Req() req) {
    return await this.driverService.getDriverStatistics(req.user);
  }

  /**
   * Get driver earnings history with pagination
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('earnings/history')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get driver earnings history Api` })
  async getDriverEarningsHistory(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return await this.driverService.getDriverEarningsHistory(
      req.user,
      page,
      limit,
    );
  }

  /**
   * Update driver availability status - returns formatted driver state
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('availability')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Update driver availability Api` })
  async updateDriverAvailability(
    @Body() body: UpdateAvailabilityDto,
    @Req() req,
  ): Promise<DriverSliceResponse> {
    const result = await this.driverService.updateDriverAvailability(
      req.user,
      body.is_online,
    );
    const earnings = await this.driverService.getDriverEarnings(req.user);
    const stats = await this.driverService.getDriverStatistics(req.user);

    // Update user object with new online status
    const updatedUser = { ...req.user, is_online: body.is_online };

    return this.frontendIntegration.formatDriverResponse(
      updatedUser,
      null, // No current ride when updating availability
      earnings,
      stats,
    );
  }
}
