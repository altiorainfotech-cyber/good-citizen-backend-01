/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RouteDetail,
  RouteDetailDocument,
} from './entities/route-detail.entity';
import { RouteQueryDto } from './dto/detail-query.dto';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    @InjectModel(RouteDetail.name)
    private routeDetailModel: Model<RouteDetailDocument>,
  ) {}

  /**
   * Get detailed route information with turn-by-turn navigation
   * @param assistId Assistance request ID
   * @param dto Route query parameters
   * @param user Current user
   * @returns Detailed route information
   */
  async getRouteDetail(assistId: string, dto: RouteQueryDto, user: any) {
    try {
      this.logger.log(`Getting route detail for assist ${assistId}`);

      // Validate coordinates
      this.validateCoordinates(dto.originLat, dto.originLng);
      this.validateCoordinates(dto.destinationLat, dto.destinationLng);

      // Check if we have a cached route for this request
      let routeDetail = await this.routeDetailModel
        .findOne({
          routeId: assistId,
          isActive: true,
        })
        .exec();

      if (!routeDetail) {
        // Generate new route detail
        const newRouteDetail = await this.generateRouteDetail(assistId, dto);
        routeDetail = newRouteDetail;
      }

      // Update with real-time traffic if requested
      if (dto.includeTraffic !== false && routeDetail) {
        await this.updateTrafficConditions(routeDetail);
      }

      if (!routeDetail) {
        throw new NotFoundException(
          `Route detail for assist ${assistId} not found`,
        );
      }

      return this.formatRouteResponse(routeDetail);
    } catch (error) {
      this.logger.error(
        `Error getting route detail for assist ${assistId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate new route detail
   * @param assistId Assistance request ID
   * @param dto Route query parameters
   * @returns Generated route detail
   */
  private async generateRouteDetail(assistId: string, dto: RouteQueryDto) {
    const routeDetail = new this.routeDetailModel({
      routeId: assistId,
      origin: {
        type: 'Point',
        coordinates: [dto.originLng, dto.originLat],
      },
      destination: {
        type: 'Point',
        coordinates: [dto.destinationLng, dto.destinationLat],
      },
      waypoints: [],
      instructions: this.generateNavigationInstructions(dto),
      estimatedTime: this.calculateEstimatedTime(dto),
      distance: this.calculateDistance(
        dto.originLat,
        dto.originLng,
        dto.destinationLat,
        dto.destinationLng,
      ),
      trafficConditions: 'light',
      routeType: dto.routeType || 'fastest',
      metadata: {
        generatedAt: new Date(),
        userId: assistId,
      },
    });

    return await routeDetail.save();
  }

  /**
   * Generate navigation instructions
   * @param dto Route query parameters
   * @returns Navigation instructions array
   */
  private generateNavigationInstructions(dto: RouteQueryDto) {
    // This would typically integrate with a mapping service like Google Maps or Mapbox
    // For now, we'll generate basic instructions
    const instructions = [
      {
        instruction: 'Head north on current road',
        distance: 0.5,
        duration: 2,
        maneuver: 'straight',
        coordinates: {
          type: 'Point' as const,
          coordinates: [dto.originLng, dto.originLat],
        },
      },
      {
        instruction: 'Turn right onto main road',
        distance: 2.1,
        duration: 8,
        maneuver: 'turn-right',
        coordinates: {
          type: 'Point' as const,
          coordinates: [dto.originLng + 0.01, dto.originLat + 0.01],
        },
      },
      {
        instruction: 'Continue straight for 5 km',
        distance: 5.0,
        duration: 15,
        maneuver: 'straight',
        coordinates: {
          type: 'Point' as const,
          coordinates: [dto.originLng + 0.02, dto.originLat + 0.02],
        },
      },
      {
        instruction: 'Arrive at destination',
        distance: 0.0,
        duration: 0,
        maneuver: 'arrive',
        coordinates: {
          type: 'Point' as const,
          coordinates: [dto.destinationLng, dto.destinationLat],
        },
      },
    ];

    return instructions;
  }

  /**
   * Calculate estimated travel time
   * @param dto Route query parameters
   * @returns Estimated time in minutes
   */
  private calculateEstimatedTime(dto: RouteQueryDto): number {
    const distance = this.calculateDistance(
      dto.originLat,
      dto.originLng,
      dto.destinationLat,
      dto.destinationLng,
    );

    // Base speed assumptions (km/h)
    let averageSpeed = 40; // Default city speed

    if (dto.routeType === 'fastest') {
      averageSpeed = 50;
    } else if (dto.routeType === 'avoid_tolls') {
      averageSpeed = 35;
    }

    return Math.round((distance / averageSpeed) * 60); // Convert to minutes
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Origin latitude
   * @param lng1 Origin longitude
   * @param lat2 Destination latitude
   * @param lng2 Destination longitude
   * @returns Distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param degrees Degrees value
   * @returns Radians value
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Update traffic conditions for route
   * @param routeDetail Route detail document
   */
  private async updateTrafficConditions(
    routeDetail: RouteDetailDocument,
  ): Promise<void> {
    // This would typically integrate with a traffic service
    // For now, we'll simulate traffic conditions based on time of day
    const currentHour = new Date().getHours();

    let trafficCondition = 'light';
    if (
      (currentHour >= 7 && currentHour <= 10) ||
      (currentHour >= 17 && currentHour <= 20)
    ) {
      trafficCondition = 'heavy';
    } else if (
      (currentHour >= 11 && currentHour <= 16) ||
      (currentHour >= 21 && currentHour <= 23)
    ) {
      trafficCondition = 'moderate';
    }

    routeDetail.trafficConditions = trafficCondition;

    // Adjust estimated time based on traffic
    const trafficMultiplier =
      trafficCondition === 'heavy'
        ? 1.5
        : trafficCondition === 'moderate'
          ? 1.2
          : 1.0;
    routeDetail.estimatedTime = Math.round(
      routeDetail.estimatedTime * trafficMultiplier,
    );

    await routeDetail.save();
  }

  /**
   * Validate coordinate values
   * @param lat Latitude
   * @param lng Longitude
   */
  private validateCoordinates(lat: number, lng: number): void {
    if (lat < -90 || lat > 90) {
      throw new BadRequestException(
        'Invalid latitude value. Must be between -90 and 90.',
      );
    }
    if (lng < -180 || lng > 180) {
      throw new BadRequestException(
        'Invalid longitude value. Must be between -180 and 180.',
      );
    }
  }

  /**
   * Format route response
   * @param routeDetail Route detail document
   * @returns Formatted response
   */
  private formatRouteResponse(routeDetail: RouteDetailDocument) {
    return {
      id: routeDetail.routeId,
      origin: {
        latitude: routeDetail.origin.coordinates[1],
        longitude: routeDetail.origin.coordinates[0],
      },
      destination: {
        latitude: routeDetail.destination.coordinates[1],
        longitude: routeDetail.destination.coordinates[0],
      },
      waypoints: routeDetail.waypoints.map((wp) => ({
        latitude: wp.coordinates[1],
        longitude: wp.coordinates[0],
      })),
      instructions: routeDetail.instructions.map((inst) => ({
        instruction: inst.instruction,
        distance: inst.distance,
        duration: inst.duration,
        maneuver: inst.maneuver,
        coordinates: {
          latitude: inst.coordinates.coordinates[1],
          longitude: inst.coordinates.coordinates[0],
        },
      })),
      estimatedTime: routeDetail.estimatedTime,
      distance: routeDetail.distance,
      trafficConditions: routeDetail.trafficConditions,
      routeType: routeDetail.routeType,
      lastUpdated: (routeDetail as any).updatedAt || new Date(),
    };
  }
}
