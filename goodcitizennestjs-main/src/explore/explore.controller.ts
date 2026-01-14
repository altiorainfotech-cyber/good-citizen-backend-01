/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ExploreService } from './explore.service';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '../authentication/guards/enhanced-jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/enhanced-roles.guard';
import { Roles } from '../authentication/roles.decorator';
import {
  AdminPermissions,
  RequiresDriverApproval,
} from '../authentication/decorators/admin-permissions.decorator';
import { UserType } from '../common/utils';
import {
  HospitalQueryDto,
  AmbulanceQueryDto,
  BloodBankQueryDto,
  EmergencyServicesQueryDto,
  HealthTipsQueryDto,
  CommunityStatsQueryDto,
} from './dto/explore-query.dto';
import {
  CreateEmergencyRequestDto,
  UpdateEmergencyRequestDto,
  EmergencyRequestQueryDto,
  EmergencyContactQueryDto,
  AmbulanceAvailabilityUpdateDto,
} from './dto/emergency-service.dto';

@ApiTags('Explore')
@Controller({ path: 'explore', version: '1' })
export class ExploreController {
  constructor(
    private readonly exploreService: ExploreService,
    private readonly emergencyService: EmergencyService,
  ) {}

  /**
   * Get nearby hospitals with location filtering
   * @param dto Hospital query parameters
   * @param req Request object with user info
   * @returns List of nearby hospitals
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('hospitals')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get nearby hospitals with location filtering' })
  async getHospitals(@Query() dto: HospitalQueryDto, @Req() req) {
    return await this.exploreService.getHospitals(dto, req.user);
  }

  /**
   * Get available ambulance services
   * @param dto Ambulance query parameters
   * @param req Request object with user info
   * @returns List of available ambulance providers
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('ambulances')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get available ambulance services with response times',
  })
  async getAmbulances(@Query() dto: AmbulanceQueryDto, @Req() req) {
    return await this.exploreService.getAmbulances(dto, req.user);
  }

  /**
   * Get nearby blood banks with availability
   * @param dto Blood bank query parameters
   * @param req Request object with user info
   * @returns List of blood banks with availability status
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('blood-banks')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get nearby blood banks with availability status' })
  async getBloodBanks(@Query() dto: BloodBankQueryDto, @Req() req) {
    return await this.exploreService.getBloodBanks(dto, req.user);
  }

  /**
   * Get emergency services contact information
   * @param dto Emergency services query parameters
   * @param req Request object with user info
   * @returns Emergency contact information
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('emergency-services')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get comprehensive emergency contact information' })
  async getEmergencyServices(
    @Query() dto: EmergencyServicesQueryDto,
    @Req() req,
  ) {
    return await this.exploreService.getEmergencyServices(dto, req.user);
  }

  /**
   * Get health tips and safety information
   * @param dto Health tips query parameters
   * @param req Request object with user info
   * @returns Health and safety tips
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('health-tips')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get relevant health and safety information' })
  async getHealthTips(@Query() dto: HealthTipsQueryDto, @Req() req) {
    return await this.exploreService.getHealthTips(dto, req.user);
  }

  /**
   * Get community statistics and metrics
   * @param dto Community stats query parameters
   * @param req Request object with user info
   * @returns Platform usage and assistance metrics
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('community-stats')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get aggregated platform usage and assistance metrics',
  })
  async getCommunityStats(@Query() dto: CommunityStatsQueryDto, @Req() req) {
    return await this.exploreService.getCommunityStats(dto, req.user);
  }

  // Emergency Services Endpoints

  /**
   * Create a new emergency request
   * @param dto Emergency request data
   * @param req Request object with user info
   * @returns Created emergency request
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('emergency-requests')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Create a new emergency request' })
  async createEmergencyRequest(
    @Body() dto: CreateEmergencyRequestDto,
    @Req() req,
  ) {
    return await this.emergencyService.createEmergencyRequest(dto, req.user);
  }

  /**
   * Get emergency requests with filtering
   * @param dto Emergency request query parameters
   * @param req Request object with user info
   * @returns List of emergency requests
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER, UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('emergency-requests')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get emergency requests with filtering' })
  async getEmergencyRequests(
    @Query() dto: EmergencyRequestQueryDto,
    @Req() req,
  ) {
    return await this.emergencyService.getEmergencyRequests(dto, req.user);
  }

  /**
   * Get emergency request by ID
   * @param id Emergency request ID
   * @param req Request object with user info
   * @returns Emergency request details
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER, UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('emergency-requests/:id')
  @ApiOperation({ summary: 'Get emergency request by ID' })
  async getEmergencyRequestById(@Param('id') id: string, @Req() req) {
    return await this.emergencyService.getEmergencyRequestById(id, req.user);
  }

  /**
   * Update emergency request status
   * @param id Emergency request ID
   * @param dto Update data
   * @param req Request object with user info
   * @returns Updated emergency request
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN, UserType.DRIVER)
  @AdminPermissions({ resource: 'emergency_requests', action: 'write' })
  @UseGuards(JwtAuthGuard, RolesGuard, RolesGuard)
  @Put('emergency-requests/:id')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Update emergency request status' })
  async updateEmergencyRequest(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyRequestDto,
    @Req() req,
  ) {
    return await this.emergencyService.updateEmergencyRequest(
      id,
      dto,
      req.user,
    );
  }

  /**
   * Get location-specific emergency contacts
   * @param dto Emergency contact query parameters
   * @param req Request object with user info
   * @returns Emergency contact information
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('emergency-contacts')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get location-specific emergency contacts' })
  async getEmergencyContacts(
    @Query() dto: EmergencyContactQueryDto,
    @Req() req,
  ) {
    return await this.emergencyService.getEmergencyContacts(dto, req.user);
  }

  /**
   * Get real-time ambulance availability
   * @param query Query parameters for location filtering
   * @param req Request object with user info
   * @returns Available ambulances
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER, UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('ambulance-availability')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get real-time ambulance availability' })
  async getAmbulanceAvailability(@Query() query: any, @Req() req) {
    const { latitude, longitude, radius } = query;
    return await this.emergencyService.getAmbulanceAvailability(
      latitude ? parseFloat(latitude) : undefined,
      longitude ? parseFloat(longitude) : undefined,
      radius ? parseInt(radius) : 20,
    );
  }

  /**
   * Update ambulance availability status
   * @param dto Ambulance availability update data
   * @param req Request object with user info
   * @returns Updated ambulance status
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.DRIVER, UserType.ADMIN)
  @RequiresDriverApproval()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('ambulance-availability')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Update ambulance availability status' })
  async updateAmbulanceAvailability(
    @Body() dto: AmbulanceAvailabilityUpdateDto,
    @Req() req,
  ) {
    return await this.emergencyService.updateAmbulanceAvailability(dto);
  }
}
