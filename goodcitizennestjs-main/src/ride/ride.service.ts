import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ride, RideDocument } from './entities/ride.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { CreateRideDto, LocationDto } from './dto/create-ride.dto';
import {
  RideResponse,
  RideStatusResponse,
  RideHistoryResponse,
  CompleteRideDto,
  RideReceipt,
  RatingDto,
  PaginationDto,
} from './dto/ride-response.dto';
import { RideStatus } from '../common/utils';
import { RideStateMachineService } from './ride-state-machine.service';
import { DriverMatchingService } from '../driver/driver-matching.service';
import { PrivacyService } from '../common/privacy.service';
import { GpsValidationService } from '../common/validation/gps-validation.service';
import { DatabaseResilienceService } from '../common/resilience/database-resilience.service';
import { ErrorMonitoringService } from '../common/monitoring/error-monitoring.service';
import { RewardsService } from '../user/rewards.service';

@Injectable()
export class RideService {
  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private rideStateMachine: RideStateMachineService,
    private driverMatchingService: DriverMatchingService,
    private privacyService: PrivacyService,
    private gpsValidationService: GpsValidationService,
    private databaseResilienceService: DatabaseResilienceService,
    private errorMonitoringService: ErrorMonitoringService,
    private rewardsService: RewardsService,
  ) {}

  /**
   * Create a new ride request with comprehensive validation
   */
  async requestRide(
    userId: string,
    rideDto: CreateRideDto,
  ): Promise<RideResponse> {
    try {
      // Validate GPS coordinates and distance
      this.gpsValidationService.validateDistance(
        rideDto.pickup_location,
        rideDto.destination_location,
      );

      // Use resilient database operations
      const result = await this.databaseResilienceService.executeWithRetry(
        async () => {
          // Validate user exists
          const user = await this.userModel.findById(userId);
          if (!user) {
            throw new NotFoundException('User not found');
          }

          // Check if user has an active ride
          const activeRide = await this.rideModel.findOne({
            user_id: new Types.ObjectId(userId),
            status: {
              $in: [
                RideStatus.REQUESTED,
                RideStatus.DRIVER_ASSIGNED,
                RideStatus.DRIVER_ARRIVING,
                RideStatus.DRIVER_ARRIVED,
                RideStatus.IN_PROGRESS,
              ],
            },
          });

          if (activeRide) {
            throw new BadRequestException('User already has an active ride');
          }

          // Calculate estimated fare and duration
          const distance = this.calculateDistance(
            rideDto.pickup_location,
            rideDto.destination_location,
          );
          const estimatedFare = this.calculateFare(
            distance,
            rideDto.vehicle_type || 'REGULAR',
          );
          const estimatedDuration = this.calculateDuration(distance);

          // Create ride
          const ride = new this.rideModel({
            user_id: new Types.ObjectId(userId),
            pickup_location: rideDto.pickup_location,
            destination_location: rideDto.destination_location,
            vehicle_type: rideDto.vehicle_type || 'REGULAR',
            emergency_details: rideDto.emergency_details,
            estimated_fare: estimatedFare,
            distance_km: distance,
            duration_minutes: estimatedDuration,
            status: RideStatus.REQUESTED,
            requested_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          });

          return await ride.save();
        },
        'ride-creation',
        { maxRetries: 2, baseDelay: 500 },
      );

      // Start driver matching process with emergency prioritization
      try {
        await this.driverMatchingService.distributeRideOffers(
          result._id.toString(),
        );
      } catch (error) {
        // Log error but don't fail the ride creation
        this.errorMonitoringService.logError(error as Error, {
          operation: 'driver-matching',
          userId,
          metadata: { rideId: result._id.toString() },
        });
      }

      return this.formatRideResponse(result);
    } catch (error) {
      this.errorMonitoringService.logError(error as Error, {
        endpoint: '/ride/request',
        userId,
        operation: 'ride-creation',
        metadata: rideDto,
      });
      throw error;
    }
  }

  /**
   * Format ride response for frontend compatibility
   */
  private formatRideResponse(ride: RideDocument): RideResponse {
    return {
      ride_id: ride._id.toString(),
      status: ride.status,
      estimated_fare: ride.estimated_fare,
      estimated_duration: ride.duration_minutes || 0,
      pickup_location: ride.pickup_location,
      destination_location: ride.destination_location,
    };
  }

  /**
   * Get current ride status
   */
  async getRideStatus(rideId: string): Promise<RideStatusResponse> {
    const ride = await this.rideModel.findById(rideId).populate('driver_id');
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    const response: RideStatusResponse = {
      ride_id: ride._id.toString(),
      status: ride.status,
    };

    // Add driver information if assigned
    if (ride.driver_id) {
      const driver = await this.userModel.findById(ride.driver_id);
      if (driver) {
        response.driver = {
          driver_id: driver._id.toString(),
          name: `${driver.first_name} ${driver.last_name}`,
          rating: 4.5, // Default rating since driver_rating field doesn't exist
          vehicle: 'Vehicle', // Default vehicle since vehicle_type field doesn't exist
          plate: 'ABC123', // Default plate since vehicle_plate field doesn't exist
          phone: driver.phone_number || '',
          current_location: {
            latitude: driver.latitude || 0,
            longitude: driver.longitude || 0,
          },
        };
        response.current_location = response.driver.current_location;
      }
    }

    return response;
  }

  /**
   * Cancel a ride using state machine
   */
  async cancelRide(rideId: string, userId: string): Promise<void> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    // Check if user owns the ride
    if (ride.user_id.toString() !== userId) {
      throw new ForbiddenException('Not authorized to cancel this ride');
    }

    // Use state machine to cancel
    await this.rideStateMachine.transitionRideStatus(
      rideId,
      RideStatus.CANCELLED,
      { userId },
    );

    // If driver was assigned, make them available again
    if (ride.driver_id) {
      await this.userModel.findByIdAndUpdate(ride.driver_id, {
        is_online: true,
        updated_at: new Date(),
      });
    }
  }

  /**
   * Get user's ride history with pagination and privacy controls
   */
  async getRideHistory(
    userId: string,
    pagination: PaginationDto,
    requestingUserId?: string,
  ): Promise<RideHistoryResponse> {
    // Validate data access permissions
    const actualRequestingUserId = requestingUserId || userId;
    const hasAccess = await this.privacyService.validateDataAccess({
      userId: actualRequestingUserId,
      requestedUserId: userId,
      dataType: 'rides',
      purpose: 'ride_history_access',
    });

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to ride history');
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Build query - only return rides where user is passenger or driver
    const query = {
      $or: [
        { user_id: new Types.ObjectId(userId) },
        { driver_id: new Types.ObjectId(userId) },
      ],
    };

    const [rides, total] = await Promise.all([
      this.rideModel
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.rideModel.countDocuments(query),
    ]);

    // Filter sensitive data based on user role in each ride
    const rideResponses: RideResponse[] = rides.map((ride) => {
      const isPassenger = ride.user_id.toString() === userId;
      const isDriver = ride.driver_id?.toString() === userId;

      // Base ride data
      const rideResponse: RideResponse = {
        ride_id: ride._id.toString(),
        status: ride.status,
        estimated_fare: ride.final_fare || ride.estimated_fare,
        estimated_duration: ride.duration_minutes || 0,
        pickup_location: ride.pickup_location,
        destination_location: ride.destination_location,
      };

      // If user is not directly involved in the ride, limit data
      if (!isPassenger && !isDriver) {
        // Remove specific addresses for privacy
        rideResponse.pickup_location = {
          latitude: ride.pickup_location.latitude,
          longitude: ride.pickup_location.longitude,
          // address removed for privacy
        };
        rideResponse.destination_location = {
          latitude: ride.destination_location.latitude,
          longitude: ride.destination_location.longitude,
          // address removed for privacy
        };
      }

      return rideResponse;
    });

    return {
      rides: rideResponses,
      total,
      page,
      limit,
    };
  }

  /**
   * Complete a ride
   */
  async completeRide(
    rideId: string,
    completionDto: CompleteRideDto,
  ): Promise<RideReceipt> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== RideStatus.IN_PROGRESS) {
      throw new BadRequestException('Ride is not in progress');
    }

    const updatedRide = await this.rideModel.findByIdAndUpdate(
      rideId,
      {
        status: RideStatus.COMPLETED,
        final_fare: completionDto.final_fare,
        distance_km: completionDto.distance_km,
        duration_minutes: completionDto.duration_minutes,
        ride_completed_at: new Date(),
        updated_at: new Date(),
      },
      { new: true },
    );

    // Make driver available again
    if (ride.driver_id) {
      await this.userModel.findByIdAndUpdate(ride.driver_id, {
        is_online: true,
        updated_at: new Date(),
      });
    }

    if (!updatedRide) {
      throw new NotFoundException('Ride not found after update');
    }

    // Track ride completion in rewards system
    try {
      const rideData = {
        ride_id: updatedRide._id.toString(),
        final_fare: updatedRide.final_fare || 0,
        distance_km: updatedRide.distance_km || 0,
        duration_minutes: updatedRide.duration_minutes || 0,
        vehicle_type: updatedRide.vehicle_type || 'REGULAR',
        completed_at: updatedRide.ride_completed_at || new Date(),
      };

      await this.rewardsService.trackRideCompletion(
        updatedRide.user_id.toString(),
        rideData,
      );

      // Update user achievements
      await this.rewardsService.updateUserAchievements(
        updatedRide.user_id.toString(),
      );
    } catch (error) {
      // Log error but don't fail the ride completion
      this.errorMonitoringService.logError(error as Error, {
        operation: 'rewards-tracking',
        userId: updatedRide.user_id.toString(),
        metadata: { rideId: updatedRide._id.toString() },
      });
    }

    return {
      ride_id: updatedRide._id.toString(),
      final_fare: updatedRide.final_fare || 0,
      distance_km: updatedRide.distance_km || 0,
      duration_minutes: updatedRide.duration_minutes || 0,
      completed_at: updatedRide.ride_completed_at || new Date(),
    };
  }

  /**
   * Rate a completed ride
   */
  async rateRide(
    rideId: string,
    userId: string,
    rating: RatingDto,
  ): Promise<void> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.user_id.toString() !== userId) {
      throw new ForbiddenException('Not authorized to rate this ride');
    }

    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed rides');
    }

    await this.rideModel.findByIdAndUpdate(rideId, {
      user_rating: rating.rating,
      user_feedback: rating.feedback,
      updated_at: new Date(),
    });

    // Update driver's average rating
    if (ride.driver_id) {
      await this.updateDriverRating(ride.driver_id.toString());
    }
  }

  /**
   * Update ride status using state machine (for driver operations)
   */
  async updateRideStatus(
    rideId: string,
    newStatus: RideStatus,
    driverId?: string,
  ): Promise<void> {
    const metadata = driverId ? { driverId } : {};
    await this.rideStateMachine.transitionRideStatus(
      rideId,
      newStatus,
      metadata,
    );
  }

  /**
   * Get ride status history
   */
  async getRideStatusHistory(rideId: string): Promise<any[]> {
    return this.rideStateMachine.getRideStatusHistory(rideId);
  }

  /**
   * Check if ride can be cancelled
   */
  async canCancelRide(rideId: string): Promise<boolean> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      return false;
    }
    return this.rideStateMachine.canCancelRide(ride.status);
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(point1: LocationDto, point2: LocationDto): number {
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

  /**
   * Calculate fare based on distance and vehicle type
   */
  private calculateFare(
    distanceKm: number,
    vehicleType: 'REGULAR' | 'EMERGENCY',
  ): number {
    const baseFare = 50; // Base fare in currency units
    const perKmRate = vehicleType === 'EMERGENCY' ? 25 : 15; // Rate per km
    const emergencyMultiplier = vehicleType === 'EMERGENCY' ? 1.5 : 1;

    return Math.round(
      (baseFare + distanceKm * perKmRate) * emergencyMultiplier,
    );
  }

  /**
   * Calculate estimated duration based on distance
   */
  private calculateDuration(distanceKm: number): number {
    const averageSpeedKmh = 30; // Average speed in city
    return Math.round((distanceKm / averageSpeedKmh) * 60); // Convert to minutes
  }

  /**
   * Handle driver acceptance of ride offer
   */
  async handleDriverAcceptance(
    rideId: string,
    driverId: string,
  ): Promise<void> {
    await this.driverMatchingService.assignDriver(rideId, driverId);
  }

  /**
   * Get available drivers for a ride with emergency prioritization
   */
  async getAvailableDriversForRide(rideId: string): Promise<any[]> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    const isEmergency = ride.vehicle_type === 'EMERGENCY';
    const searchRadius = isEmergency ? 10 : 5; // Larger radius for emergency rides

    const query = {
      location: ride.pickup_location,
      radius_km: searchRadius,
      vehicle_type: ride.vehicle_type,
      is_emergency: isEmergency,
    };

    return this.driverMatchingService.findAvailableDrivers(query);
  }

  /**
   * Update driver's average rating
   */
  private async updateDriverRating(driverId: string): Promise<void> {
    const rides = await this.rideModel.find({
      driver_id: new Types.ObjectId(driverId),
      user_rating: { $exists: true, $ne: null },
    });

    if (rides.length > 0) {
      // Note: driver rating calculation would be implemented here when User schema is updated
      await this.userModel.findByIdAndUpdate(driverId, {
        // Note: driver_rating and total_rides fields don't exist in current User schema
        // This would need to be added to the User entity for proper functionality
        updated_at: new Date(),
      });
    }
  }
}
