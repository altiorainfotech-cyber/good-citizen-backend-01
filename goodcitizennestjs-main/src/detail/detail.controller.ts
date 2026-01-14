/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/enhanced-jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/enhanced-roles.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from '../common/utils';
import { RouteService } from './route.service';
import { FacilityDetailService } from './facility-detail.service';
import { PaymentMethodService } from './payment-method.service';
import {
  RouteQueryDto,
  FacilityDetailQueryDto,
  StationDetailQueryDto,
  HospitalDetailQueryDto,
  PaymentMethodsQueryDto,
} from './dto/detail-query.dto';

@ApiTags('Detail Services')
@Controller({ version: '1' })
export class DetailController {
  constructor(
    private readonly routeService: RouteService,
    private readonly facilityDetailService: FacilityDetailService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  /**
   * Get detailed route information with turn-by-turn navigation
   * @param assistId Assistance request ID
   * @param dto Route query parameters
   * @param req Request object with user info
   * @returns Detailed route information with navigation
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('assists/:id/route')
  @ApiParam({ name: 'id', description: 'Assistance request ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get turn-by-turn navigation and timing data for assistance route',
  })
  async getAssistRoute(
    @Param('id') assistId: string,
    @Query() dto: RouteQueryDto,
    @Req() req,
  ) {
    return await this.routeService.getRouteDetail(assistId, dto, req.user);
  }

  /**
   * Get comprehensive station information
   * @param stationId Station ID
   * @param dto Station detail query parameters
   * @param req Request object with user info
   * @returns Comprehensive station information
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('stations/:id')
  @ApiParam({ name: 'id', description: 'Station ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary:
      'Get comprehensive facility information including services and contact details',
  })
  async getStationDetail(
    @Param('id') stationId: string,
    @Query() dto: StationDetailQueryDto,
    @Req() req,
  ) {
    return await this.facilityDetailService.getStationDetail(
      stationId,
      dto,
      req.user,
    );
  }

  /**
   * Get comprehensive hospital information
   * @param hospitalId Hospital ID
   * @param dto Hospital detail query parameters
   * @param req Request object with user info
   * @returns Comprehensive hospital information
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('hospitals/:id')
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary:
      'Get specialties, availability, and real-time capacity information',
  })
  async getHospitalDetail(
    @Param('id') hospitalId: string,
    @Query() dto: HospitalDetailQueryDto,
    @Req() req,
  ) {
    return await this.facilityDetailService.getHospitalDetail(
      hospitalId,
      dto,
      req.user,
    );
  }

  /**
   * Get available payment methods with processing capabilities
   * @param dto Payment methods query parameters
   * @param req Request object with user info
   * @returns Available payment options and processing capabilities
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('payments/methods')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get available payment options and processing capabilities',
  })
  async getPaymentMethods(@Query() dto: PaymentMethodsQueryDto, @Req() req) {
    return await this.paymentMethodService.getPaymentMethods(dto, req.user);
  }

  /**
   * Get specific payment method details
   * @param methodId Payment method ID
   * @param req Request object with user info
   * @returns Detailed payment method information
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('payments/methods/:id')
  @ApiParam({ name: 'id', description: 'Payment method ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get detailed payment method information' })
  async getPaymentMethodDetail(@Param('id') methodId: string, @Req() req) {
    return await this.paymentMethodService.getPaymentMethodDetail(
      methodId,
      req.user,
    );
  }

  /**
   * Get general facility details (fallback endpoint)
   * @param facilityId Facility ID
   * @param dto Facility detail query parameters
   * @param req Request object with user info
   * @returns General facility information
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('facilities/:id')
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get general facility information' })
  async getFacilityDetail(
    @Param('id') facilityId: string,
    @Query() dto: FacilityDetailQueryDto,
    @Req() req,
  ) {
    return await this.facilityDetailService.getFacilityDetail(
      facilityId,
      dto,
      req.user,
    );
  }
}
