/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RideService } from './ride.service';
import { RideStateMachineService } from './ride-state-machine.service';
import { CreateRideDto } from './dto/create-ride.dto';
import {
  RideResponse,
  RideStatusResponse,
  RideHistoryResponse,
  CompleteRideDto,
  RideReceipt,
  RatingDto,
  PaginationDto,
} from './dto/ride-response.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RideStatus } from '../common/utils';
import {
  FrontendIntegrationService,
  RideSliceResponse,
} from '../common/frontend-integration.service';

@ApiTags('rides')
@Controller('rides')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RideController {
  constructor(
    private readonly rideService: RideService,
    private readonly rideStateMachine: RideStateMachineService,
    private readonly frontendIntegration: FrontendIntegrationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Request a new ride' })
  @ApiResponse({ status: 201, description: 'Ride created successfully' })
  async requestRide(
    @Body() createRideDto: CreateRideDto,
    @Req() req: Request,
  ): Promise<RideSliceResponse> {
    const rideResponse = await this.rideService.requestRide(
      (req.user as any)._id,
      createRideDto,
    );
    return this.frontendIntegration.formatRideResponse(rideResponse);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get ride status' })
  @ApiResponse({ status: 200, description: 'Ride status retrieved' })
  async getRideStatus(@Param('id') rideId: string): Promise<RideSliceResponse> {
    const statusResponse = await this.rideService.getRideStatus(rideId);
    return this.frontendIntegration.formatRideResponse(
      statusResponse,
      statusResponse.driver,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a ride' })
  @ApiResponse({ status: 200, description: 'Ride cancelled successfully' })
  async cancelRide(
    @Param('id') rideId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.rideService.cancelRide(rideId, (req.user as any)._id);
    return { message: 'Ride cancelled successfully' };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user ride history' })
  @ApiResponse({ status: 200, description: 'Ride history retrieved' })
  async getRideHistory(@Query() pagination: PaginationDto, @Req() req) {
    const historyResponse = await this.rideService.getRideHistory(
      req.user._id,
      pagination,
    );
    return this.frontendIntegration.formatRideHistoryResponse(
      historyResponse.rides,
      historyResponse.total,
      historyResponse.page,
      historyResponse.limit,
    );
  }

  @Put(':id/complete')
  @ApiOperation({ summary: 'Complete a ride' })
  @ApiResponse({
    status: 200,
    description: 'Ride completed successfully',
    type: RideReceipt,
  })
  async completeRide(
    @Param('id') rideId: string,
    @Body() completionDto: CompleteRideDto,
  ): Promise<RideReceipt> {
    return this.rideService.completeRide(rideId, completionDto);
  }

  @Put(':id/rate')
  @ApiOperation({ summary: 'Rate a completed ride' })
  @ApiResponse({ status: 200, description: 'Ride rated successfully' })
  async rateRide(
    @Param('id') rideId: string,
    @Body() ratingDto: RatingDto,
    @Req() req,
  ): Promise<{ message: string }> {
    await this.rideService.rateRide(rideId, req.user._id, ratingDto);
    return { message: 'Ride rated successfully' };
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update ride status (for drivers)' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateRideStatus(
    @Param('id') rideId: string,
    @Body() body: { status: RideStatus },
    @Req() req,
  ): Promise<{ message: string }> {
    await this.rideService.updateRideStatus(rideId, body.status, req.user._id);
    return { message: 'Status updated successfully' };
  }

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Get ride status history' })
  @ApiResponse({ status: 200, description: 'Status history retrieved' })
  async getRideStatusHistory(@Param('id') rideId: string): Promise<any[]> {
    return this.rideService.getRideStatusHistory(rideId);
  }

  @Get(':id/can-cancel')
  @ApiOperation({ summary: 'Check if ride can be cancelled' })
  @ApiResponse({ status: 200, description: 'Cancellation status retrieved' })
  async canCancelRide(
    @Param('id') rideId: string,
  ): Promise<{ canCancel: boolean }> {
    const canCancel = await this.rideService.canCancelRide(rideId);
    return { canCancel };
  }

  @Get('status/:status/valid-transitions')
  @ApiOperation({ summary: 'Get valid status transitions for a given status' })
  @ApiResponse({ status: 200, description: 'Valid transitions retrieved' })
  async getValidTransitions(
    @Param('status') status: RideStatus,
  ): Promise<{ validTransitions: RideStatus[] }> {
    const validTransitions = this.rideStateMachine.getValidNextStates(status);
    return { validTransitions };
  }
}
