import { Injectable, BadRequestException } from '@nestjs/common';
import { LocationDto } from '../../ride/dto/create-ride.dto';

@Injectable()
export class GpsValidationService {
  /**
   * Validate GPS coordinates are within Earth bounds
   * Latitude: -90 to 90 degrees
   * Longitude: -180 to 180 degrees
   */
  validateCoordinates(latitude: number, longitude: number): void {
    if (!this.isValidLatitude(latitude)) {
      throw new BadRequestException(
        `Invalid latitude: ${latitude}. Must be between -90 and 90 degrees.`,
      );
    }

    if (!this.isValidLongitude(longitude)) {
      throw new BadRequestException(
        `Invalid longitude: ${longitude}. Must be between -180 and 180 degrees.`,
      );
    }

    if (!this.isFiniteNumber(latitude) || !this.isFiniteNumber(longitude)) {
      throw new BadRequestException('GPS coordinates must be finite numbers');
    }
  }

  /**
   * Validate location DTO with comprehensive checks
   */
  validateLocationDto(location: LocationDto): void {
    if (!location) {
      throw new BadRequestException('Location is required');
    }

    this.validateCoordinates(location.latitude, location.longitude);

    // Additional validation for precision (max 6 decimal places for GPS accuracy)
    if (
      !this.hasValidPrecision(location.latitude) ||
      !this.hasValidPrecision(location.longitude)
    ) {
      throw new BadRequestException(
        'GPS coordinates should not exceed 6 decimal places for accuracy',
      );
    }
  }

  /**
   * Validate distance between two points is reasonable
   */
  validateDistance(pickup: LocationDto, destination: LocationDto): void {
    this.validateLocationDto(pickup);
    this.validateLocationDto(destination);

    const distance = this.calculateHaversineDistance(pickup, destination);

    // Maximum reasonable ride distance: 500km
    if (distance > 500) {
      throw new BadRequestException(
        `Distance between pickup and destination (${distance.toFixed(2)}km) exceeds maximum allowed distance of 500km`,
      );
    }

    // Minimum distance: 50 meters
    if (distance < 0.05) {
      throw new BadRequestException(
        'Pickup and destination locations are too close. Minimum distance is 50 meters.',
      );
    }
  }

  private isValidLatitude(lat: number): boolean {
    return typeof lat === 'number' && lat >= -90 && lat <= 90;
  }

  private isValidLongitude(lng: number): boolean {
    return typeof lng === 'number' && lng >= -180 && lng <= 180;
  }

  private isFiniteNumber(num: number): boolean {
    return typeof num === 'number' && isFinite(num) && !isNaN(num);
  }

  private hasValidPrecision(coord: number): boolean {
    const decimalPlaces = (coord.toString().split('.')[1] || '').length;
    return decimalPlaces <= 6;
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateHaversineDistance(
    point1: LocationDto,
    point2: LocationDto,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
