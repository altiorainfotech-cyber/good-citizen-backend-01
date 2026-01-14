/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DriverMatchingService } from './driver-matching.service';
import {
  DriverMatchQuery,
  DriverMatchResult,
  DriverResponseDto,
} from './dto/driver-matching.dto';

@ApiTags('Driver Matching')
@Controller('driver-matching')
export class DriverMatchingController {
  private readonly logger = new Logger(DriverMatchingController.name);

  constructor(private readonly driverMatchingService: DriverMatchingService) {}

  /**
   * Find available drivers for a ride request
   */
  @Post('find-drivers')
  @ApiOperation({ summary: 'Find available drivers for a ride request' })
  @ApiResponse({
    status: 200,
    description: 'List of available drivers',
    type: [DriverMatchResult],
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async findAvailableDrivers(
    @Body() query: DriverMatchQuery,
  ): Promise<DriverMatchResult[]> {
    this.logger.log(
      `Finding drivers for location: ${query.location.latitude}, ${query.location.longitude}`,
    );
    return this.driverMatchingService.findAvailableDrivers(query);
  }

  /**
   * Assign a driver to a ride
   */
  @Post('assign-driver')
  @ApiOperation({ summary: 'Assign a driver to a ride' })
  @ApiResponse({ status: 200, description: 'Driver assigned successfully' })
  @ApiResponse({ status: 400, description: 'Driver assignment failed' })
  async assignDriver(
    @Body() assignmentData: { rideId: string; driverId: string },
  ): Promise<{ message: string }> {
    const { rideId, driverId } = assignmentData;
    this.logger.log(`Assigning driver ${driverId} to ride ${rideId}`);

    await this.driverMatchingService.assignDriver(rideId, driverId);

    return { message: 'Driver assigned successfully' };
  }

  /**
   * Distribute ride offers to available drivers
   */
  @Post('distribute-offers/:rideId')
  @ApiOperation({ summary: 'Distribute ride offers to available drivers' })
  @ApiResponse({ status: 200, description: 'Ride offers distributed' })
  @ApiResponse({ status: 400, description: 'Failed to distribute offers' })
  async distributeRideOffers(
    @Param('rideId') rideId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Distributing ride offers for ride ${rideId}`);

    const success =
      await this.driverMatchingService.distributeRideOffers(rideId);

    return {
      success,
      message: success
        ? 'Ride offers distributed successfully'
        : 'No drivers available',
    };
  }

  /**
   * Handle driver response to ride offer
   */
  @Post('driver-response')
  @ApiOperation({ summary: 'Handle driver response to ride offer' })
  @ApiResponse({ status: 200, description: 'Driver response processed' })
  @ApiResponse({ status: 400, description: 'Invalid response' })
  async handleDriverResponse(
    @Body() response: DriverResponseDto,
  ): Promise<{ accepted: boolean; message: string }> {
    this.logger.log(
      `Processing driver response: ${response.driver_id} ${response.accepted ? 'accepted' : 'rejected'} ride ${response.ride_id}`,
    );

    const accepted =
      await this.driverMatchingService.handleDriverResponse(response);

    return {
      accepted,
      message: accepted
        ? 'Ride assigned to driver'
        : 'Driver response processed',
    };
  }

  /**
   * Get driver matching statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get driver matching statistics' })
  @ApiResponse({ status: 200, description: 'Driver matching statistics' })
  async getMatchingStats(): Promise<any> {
    this.logger.log('Fetching driver matching statistics');
    return this.driverMatchingService.getMatchingStats();
  }
}
