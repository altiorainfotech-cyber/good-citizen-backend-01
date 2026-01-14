import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { LocationManagerService } from './location-manager.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationResponseDto } from './dto/location-response.dto';

@ApiTags('Location')
@Controller('v1/location')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LocationController {
  constructor(private readonly locationManagerService: LocationManagerService) {}

  @Post('update')
  @ApiOperation({ summary: 'Update user location' })
  @ApiResponse({
    status: 200,
    description: 'Location updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Location updated successfully' },
        status: { type: 'string', example: 'success' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid location data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async updateLocation(
    @Request() req: any,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    try {
      const userId = updateLocationDto.userId || req.user.sub || req.user.id;
      
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
      }

      await this.locationManagerService.updateLocationFromDto(userId, updateLocationDto);

      return {
        message: 'Location updated successfully',
        status: 'success',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update location',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('current')
  @ApiOperation({ summary: 'Get user current location' })
  @ApiResponse({
    status: 200,
    description: 'Current location retrieved successfully',
    type: LocationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Location not found for user',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getCurrentLocation(
    @Request() req: any,
    @Query('userId') userId?: string,
  ): Promise<LocationResponseDto> {
    try {
      const targetUserId = userId || req.user.sub || req.user.id;
      
      if (!targetUserId) {
        throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
      }

      const location = await this.locationManagerService.getUserLastLocation(targetUserId);
      
      if (!location) {
        throw new NotFoundException('No location found for user');
      }

      return location;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve current location',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user location history' })
  @ApiResponse({
    status: 200,
    description: 'Location history retrieved successfully',
    type: [LocationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getLocationHistory(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<LocationResponseDto[]> {
    try {
      const targetUserId = userId || req.user.sub || req.user.id;
      const limitNumber = limit ? parseInt(limit, 10) : 10;
      
      if (!targetUserId) {
        throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
      }

      if (limitNumber < 1 || limitNumber > 100) {
        throw new HttpException('Limit must be between 1 and 100', HttpStatus.BAD_REQUEST);
      }

      return await this.locationManagerService.trackLocationHistory(targetUserId, limitNumber);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve location history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}