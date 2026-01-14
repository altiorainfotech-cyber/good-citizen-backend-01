import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Ride, RideDocument } from '../ride/entities/ride.entity';
import { LocationDto } from '../ride/dto/create-ride.dto';
import {
  DriverMatchQuery,
  DriverMatchResult,
  RideOfferDto,
  DriverResponseDto,
} from './dto/driver-matching.dto';
import { RideStatus, DriverApproval } from '../common/utils';
import { WebSocketService } from '../web-socket/web-socket.service';
import { PerformanceService } from '../common/performance.service';

@Injectable()
export class DriverMatchingService {
  private readonly logger = new Logger(DriverMatchingService.name);
  private readonly INITIAL_RADIUS_KM = 2;
  private readonly MAX_RADIUS_KM = 10;
  private readonly RADIUS_EXPANSION_STEP = 2.5;
  private readonly MAX_DRIVERS_PER_OFFER = 3;
  private readonly OFFER_TIMEOUT_SECONDS = 30;
  private readonly AVERAGE_SPEED_KMH = 30;

  // Store pending ride offers with emergency support
  private pendingOffers = new Map<
    string,
    {
      rideId: string;
      driverIds: string[];
      timeout: NodeJS.Timeout;
      retryCount: number;
      isEmergency?: boolean;
    }
  >();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    private webSocketService: WebSocketService,
    private performanceService: PerformanceService,
  ) {}

  /**
   * Find available drivers within specified radius using optimized MongoDB geospatial queries
   * Enhanced with emergency ride prioritization and performance caching
   */
  async findAvailableDrivers(
    query: DriverMatchQuery,
  ): Promise<DriverMatchResult[]> {
    try {
      const {
        location,
        radius_km,
        vehicle_type,
        exclude_driver_ids = [],
        is_emergency = false,
      } = query;

      // Validate GPS coordinates
      this.validateGPSCoordinates(location.latitude, location.longitude);

      // Use performance service for optimized driver matching with caching
      const drivers = await this.performanceService.findNearbyDrivers(
        location.latitude,
        location.longitude,
        radius_km,
        vehicle_type,
        is_emergency ? 30 : 20, // Higher limit for emergency rides
      );

      // Filter out excluded drivers
      const filteredDrivers = drivers.filter(
        (driver) => !exclude_driver_ids.includes(driver._id.toString()),
      );

      // Check for busy drivers with emergency flexibility
      let busyDrivers: Types.ObjectId[] = [];
      if (is_emergency) {
        // Only exclude drivers in critical states for emergency rides
        busyDrivers = await this.rideModel.distinct('driver_id', {
          status: {
            $in: [
              RideStatus.IN_PROGRESS, // Only exclude drivers actively in rides
              RideStatus.DRIVER_ARRIVED, // And those who have arrived at pickup
            ],
          },
          driver_id: { $ne: null },
        });
      } else {
        // Regular rides exclude all busy drivers
        busyDrivers = await this.rideModel.distinct('driver_id', {
          status: {
            $in: [
              RideStatus.DRIVER_ASSIGNED,
              RideStatus.DRIVER_ARRIVING,
              RideStatus.DRIVER_ARRIVED,
              RideStatus.IN_PROGRESS,
            ],
          },
          driver_id: { $ne: null },
        });
      }

      // Filter out busy drivers
      const availableDrivers = filteredDrivers.filter(
        (driver) =>
          !busyDrivers.some(
            (busyId) => busyId.toString() === driver._id.toString(),
          ),
      );

      // Calculate distances and format results
      const results: DriverMatchResult[] = availableDrivers.map((driver) => {
        const distance = this.calculateDistance(location, {
          latitude: driver.latitude,
          longitude: driver.longitude,
        });

        const estimatedArrival = this.calculateEstimatedArrival(
          distance,
          is_emergency,
        );

        return {
          driver_id: driver._id.toString(),
          distance_km: Math.round(distance * 100) / 100, // Round to 2 decimal places
          estimated_arrival_minutes: estimatedArrival,
          rating: driver.driver_rating || 4.5,
          availability_status: 'AVAILABLE' as const,
          driver_name: `${driver.first_name} ${driver.last_name}`,
          vehicle_info: driver.vehicle_type || 'Vehicle',
          phone_number: driver.phone_number || '',
          current_location: {
            latitude: driver.latitude,
            longitude: driver.longitude,
          },
          is_emergency_capable: true, // All drivers can handle emergency rides for now
        };
      });

      // Enhanced sorting for emergency rides
      if (is_emergency) {
        results.sort((a, b) => {
          // For emergency rides, prioritize by distance more heavily
          const distanceDiff = a.distance_km - b.distance_km;
          if (Math.abs(distanceDiff) < 0.5) {
            return b.rating - a.rating; // Higher rating first if distances are very similar
          }
          return distanceDiff; // Closer distance first
        });
      } else {
        // Regular sorting for non-emergency rides
        results.sort((a, b) => {
          if (Math.abs(a.distance_km - b.distance_km) < 0.1) {
            return b.rating - a.rating; // Higher rating first if distances are similar
          }
          return a.distance_km - b.distance_km; // Closer distance first
        });
      }

      this.logger.log(
        `Found ${results.length} available drivers within ${radius_km}km${is_emergency ? ' (emergency)' : ''}`,
      );
      return results;
    } catch (error) {
      this.logger.error('Error finding available drivers:', error);
      throw error;
    }
  }

  /**
   * Assign driver to ride with exclusivity handling
   */
  async assignDriver(rideId: string, driverId: string): Promise<void> {
    try {
      // Verify driver is still available
      const driver = await this.userModel.findById(driverId);
      if (
        !driver ||
        !driver.is_online ||
        driver.approval !== DriverApproval.APPROVED
      ) {
        throw new BadRequestException('Driver is not available');
      }

      // Check if driver is already assigned to another active ride
      const existingRide = await this.rideModel.findOne({
        driver_id: new Types.ObjectId(driverId),
        status: {
          $in: [
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
          ],
        },
      });

      if (existingRide) {
        throw new BadRequestException(
          'Driver is already assigned to another ride',
        );
      }

      // Assign driver to ride
      const updatedRide = await this.rideModel.findByIdAndUpdate(
        rideId,
        {
          driver_id: new Types.ObjectId(driverId),
          status: RideStatus.DRIVER_ASSIGNED,
          driver_assigned_at: new Date(),
          updated_at: new Date(),
        },
        { new: true },
      );

      if (!updatedRide) {
        throw new BadRequestException('Ride not found');
      }

      // Mark driver as busy (offline for new requests)
      await this.userModel.findByIdAndUpdate(driverId, {
        is_online: false, // Driver becomes unavailable for new rides
        updated_at: new Date(),
      });

      // Cancel any pending offers for this ride
      this.cancelPendingOffers(rideId);

      this.logger.log(`Driver ${driverId} assigned to ride ${rideId}`);
    } catch (error) {
      this.logger.error('Error assigning driver:', error);
      throw error;
    }
  }

  /**
   * Distribute ride offers to multiple drivers with radius expansion logic
   * Enhanced with emergency ride prioritization
   */
  async distributeRideOffers(
    rideId: string,
    maxRetries: number = 3,
  ): Promise<boolean> {
    try {
      const ride = await this.rideModel.findById(rideId);
      if (!ride) {
        throw new BadRequestException('Ride not found');
      }

      if (ride.status !== RideStatus.REQUESTED) {
        this.logger.warn(
          `Cannot distribute offers for ride ${rideId} with status ${ride.status}`,
        );
        return false;
      }

      const isEmergency = ride.vehicle_type === 'EMERGENCY';
      let currentRadius = isEmergency
        ? this.INITIAL_RADIUS_KM * 1.5
        : this.INITIAL_RADIUS_KM; // Start with larger radius for emergency
      let retryCount = 0;
      let excludeDriverIds: string[] = [];

      // Emergency rides get more aggressive retry logic
      const emergencyMaxRetries = isEmergency ? maxRetries + 2 : maxRetries;
      const emergencyMaxRadius = isEmergency
        ? this.MAX_RADIUS_KM * 1.5
        : this.MAX_RADIUS_KM;

      this.logger.log(
        `${isEmergency ? 'EMERGENCY' : 'Regular'} ride ${rideId}: Starting driver matching`,
      );

      while (
        retryCount < emergencyMaxRetries &&
        currentRadius <= emergencyMaxRadius
      ) {
        this.logger.log(
          `Attempt ${retryCount + 1}: Searching for drivers within ${currentRadius}km${isEmergency ? ' (EMERGENCY)' : ''}`,
        );

        // Find available drivers with emergency prioritization
        const query: DriverMatchQuery = {
          location: ride.pickup_location,
          radius_km: currentRadius,
          vehicle_type: ride.vehicle_type,
          exclude_driver_ids: excludeDriverIds,
          is_emergency: isEmergency,
        };

        const availableDrivers = await this.findAvailableDrivers(query);

        if (availableDrivers.length > 0) {
          // For emergency rides, send offers to more drivers simultaneously
          const maxDriversForOffer = isEmergency
            ? this.MAX_DRIVERS_PER_OFFER + 2
            : this.MAX_DRIVERS_PER_OFFER;
          const selectedDrivers = availableDrivers.slice(0, maxDriversForOffer);
          const driverIds = selectedDrivers.map((d) => d.driver_id);

          // Send ride offers with emergency priority
          const offerSent = await this.sendRideOffers(
            rideId,
            selectedDrivers,
            isEmergency,
          );

          if (offerSent) {
            // Store pending offer with shorter timeout for emergency rides
            this.storePendingOffer(rideId, driverIds, retryCount, isEmergency);
            return true;
          }
        }

        // No drivers found or offers failed, expand radius and retry
        excludeDriverIds = [
          ...excludeDriverIds,
          ...availableDrivers.map((d) => d.driver_id),
        ];

        // Emergency rides expand radius more aggressively
        const radiusExpansion = isEmergency
          ? this.RADIUS_EXPANSION_STEP * 1.5
          : this.RADIUS_EXPANSION_STEP;
        currentRadius += radiusExpansion;
        retryCount++;

        this.logger.log(
          `No drivers accepted. Expanding radius to ${currentRadius}km${isEmergency ? ' (EMERGENCY)' : ''}`,
        );
      }

      this.logger.warn(
        `No drivers found for ${isEmergency ? 'EMERGENCY' : 'regular'} ride ${rideId} after ${retryCount} attempts`,
      );

      // For emergency rides, try one more time with even more relaxed criteria
      if (isEmergency && retryCount >= emergencyMaxRetries) {
        this.logger.log(
          `Emergency ride ${rideId}: Attempting final search with maximum flexibility`,
        );
        return await this.emergencyFallbackSearch(rideId);
      }

      return false;
    } catch (error) {
      this.logger.error('Error distributing ride offers:', error);
      throw error;
    }
  }

  /**
   * Handle driver response to ride offer
   */
  async handleDriverResponse(response: DriverResponseDto): Promise<boolean> {
    try {
      const { driver_id, ride_id, accepted, rejection_reason } = response;

      // Check if offer is still pending
      const pendingOffer = this.pendingOffers.get(ride_id);
      if (!pendingOffer) {
        this.logger.warn(`No pending offer found for ride ${ride_id}`);
        return false;
      }

      // Check if driver was part of the offer
      if (!pendingOffer.driverIds.includes(driver_id)) {
        this.logger.warn(
          `Driver ${driver_id} was not part of offer for ride ${ride_id}`,
        );
        return false;
      }

      if (accepted) {
        // Driver accepted - assign them to the ride
        await this.assignDriver(ride_id, driver_id);

        // Notify other drivers that ride is no longer available
        const otherDrivers = pendingOffer.driverIds.filter(
          (id) => id !== driver_id,
        );
        await this.notifyRideTaken(ride_id, otherDrivers);

        return true;
      } else {
        // Driver rejected - remove them from pending offer
        pendingOffer.driverIds = pendingOffer.driverIds.filter(
          (id) => id !== driver_id,
        );

        this.logger.log(
          `Driver ${driver_id} rejected ride ${ride_id}: ${rejection_reason || 'No reason provided'}`,
        );

        // If no drivers left, the timeout will handle retry
        if (pendingOffer.driverIds.length === 0) {
          this.cancelPendingOffers(ride_id);
        }

        return false;
      }
    } catch (error) {
      this.logger.error('Error handling driver response:', error);
      throw error;
    }
  }

  /**
   * Emergency fallback search with maximum flexibility
   */
  private async emergencyFallbackSearch(rideId: string): Promise<boolean> {
    try {
      const ride = await this.rideModel.findById(rideId);
      if (!ride) {
        return false;
      }

      this.logger.log(`Emergency fallback search for ride ${rideId}`);

      // Ultra-wide search with maximum radius
      const query: DriverMatchQuery = {
        location: ride.pickup_location,
        radius_km: this.MAX_RADIUS_KM * 2, // Double the normal max radius
        vehicle_type: ride.vehicle_type,
        exclude_driver_ids: [],
        is_emergency: true,
      };

      // Include drivers who might be in less critical states
      const semiAvailableDrivers = await this.userModel
        .find({
          role: 'DRIVER',
          approval: DriverApproval.APPROVED,
          is_online: true,
          is_deleted: false,
          location: {
            $nearSphere: {
              $geometry: {
                type: 'Point',
                coordinates: [
                  ride.pickup_location.longitude,
                  ride.pickup_location.latitude,
                ],
              },
              $maxDistance: query.radius_km * 1000,
            },
          },
        })
        .select(
          '_id first_name last_name phone_number location latitude longitude',
        )
        .limit(10)
        .lean();

      if (semiAvailableDrivers.length > 0) {
        const driverResults: DriverMatchResult[] = semiAvailableDrivers.map(
          (driver) => {
            const distance = this.calculateDistance(ride.pickup_location, {
              latitude: driver.latitude,
              longitude: driver.longitude,
            });

            return {
              driver_id: driver._id.toString(),
              distance_km: Math.round(distance * 100) / 100,
              estimated_arrival_minutes: this.calculateEstimatedArrival(
                distance,
                true,
              ),
              rating: 4.5,
              availability_status: 'AVAILABLE' as const,
              driver_name: `${driver.first_name} ${driver.last_name}`,
              vehicle_info: 'Emergency Vehicle',
              phone_number: driver.phone_number || '',
              current_location: {
                latitude: driver.latitude,
                longitude: driver.longitude,
              },
              is_emergency_capable: true,
            };
          },
        );

        // Send emergency offers to all found drivers
        const offerSent = await this.sendRideOffers(
          rideId,
          driverResults,
          true,
        );
        if (offerSent) {
          this.storePendingOffer(
            rideId,
            driverResults.map((d) => d.driver_id),
            0,
            true,
          );
          return true;
        }
      }

      this.logger.warn(`Emergency fallback search failed for ride ${rideId}`);
      return false;
    } catch (error) {
      this.logger.error('Error in emergency fallback search:', error);
      return false;
    }
  }

  /**
   * Send ride offers to selected drivers via WebSocket
   * Enhanced with emergency priority messaging
   */
  private async sendRideOffers(
    rideId: string,
    drivers: DriverMatchResult[],
    isEmergency: boolean = false,
  ): Promise<boolean> {
    try {
      const ride = await this.rideModel.findById(rideId);
      if (!ride) {
        return false;
      }

      const rideOffer: Partial<RideOfferDto> = {
        ride_id: rideId,
        pickup_location: ride.pickup_location,
        destination_location: ride.destination_location,
        estimated_fare: ride.estimated_fare,
        estimated_duration: ride.duration_minutes || 0,
        distance_km: ride.distance_km || 0,
        vehicle_type: ride.vehicle_type,
        is_emergency: isEmergency,
        priority: isEmergency ? 'HIGH' : 'NORMAL',
      };

      if (ride.emergency_details) {
        rideOffer.emergency_details = ride.emergency_details;
      }

      // Emergency rides get special messaging
      if (isEmergency) {
        rideOffer.emergency_message =
          'URGENT: Emergency ride request - immediate response required';
        rideOffer.response_timeout = 15; // Shorter timeout for emergency rides
      }

      // Send offers to all selected drivers
      const offerPromises = drivers.map(async (driver) => {
        try {
          // Send via WebSocket if driver is connected
          await this.webSocketService.sendToUser(
            driver.driver_id,
            'ride_offer',
            {
              ...rideOffer,
              estimated_arrival_minutes: driver.estimated_arrival_minutes,
              distance_to_pickup: driver.distance_km,
            },
          );

          this.logger.log(
            `${isEmergency ? 'EMERGENCY ' : ''}Ride offer sent to driver ${driver.driver_id}`,
          );
          return true;
        } catch (error) {
          this.logger.error(
            `Failed to send ${isEmergency ? 'emergency ' : ''}offer to driver ${driver.driver_id}:`,
            error,
          );
          return false;
        }
      });

      const results = await Promise.all(offerPromises);
      const successCount = results.filter(Boolean).length;

      this.logger.log(
        `Sent ${successCount}/${drivers.length} ${isEmergency ? 'emergency ' : ''}ride offers for ride ${rideId}`,
      );
      return successCount > 0;
    } catch (error) {
      this.logger.error('Error sending ride offers:', error);
      return false;
    }
  }

  /**
   * Store pending offer with timeout for retry logic
   * Enhanced with emergency ride shorter timeouts
   */
  private storePendingOffer(
    rideId: string,
    driverIds: string[],
    retryCount: number,
    isEmergency: boolean = false,
  ): void {
    // Cancel existing timeout if any
    this.cancelPendingOffers(rideId);

    // Emergency rides get shorter timeout for faster response
    const timeoutSeconds = isEmergency
      ? this.OFFER_TIMEOUT_SECONDS * 0.5
      : this.OFFER_TIMEOUT_SECONDS;

    // Create timeout for retry
    const timeout = setTimeout(async () => {
      this.logger.log(
        `${isEmergency ? 'Emergency ' : ''}Ride offer timeout for ride ${rideId}, attempting retry`,
      );
      this.pendingOffers.delete(rideId);

      // Retry with expanded radius
      await this.distributeRideOffers(rideId, 3);
    }, timeoutSeconds * 1000);

    // Store pending offer
    this.pendingOffers.set(rideId, {
      rideId,
      driverIds,
      timeout,
      retryCount,
      isEmergency,
    });
  }

  /**
   * Cancel pending offers for a ride
   */
  private cancelPendingOffers(rideId: string): void {
    const pendingOffer = this.pendingOffers.get(rideId);
    if (pendingOffer) {
      clearTimeout(pendingOffer.timeout);
      this.pendingOffers.delete(rideId);
    }
  }

  /**
   * Notify drivers that ride has been taken by another driver
   */
  private async notifyRideTaken(
    rideId: string,
    driverIds: string[],
  ): Promise<void> {
    const notifications = driverIds.map(async (driverId) => {
      try {
        await this.webSocketService.sendToUser(driverId, 'ride_taken', {
          ride_id: rideId,
          message: 'This ride has been accepted by another driver',
        });
      } catch (error) {
        this.logger.error(
          `Failed to notify driver ${driverId} about ride taken:`,
          error,
        );
      }
    });

    await Promise.all(notifications);
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

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate estimated arrival time based on distance
   * Enhanced with emergency vehicle speed considerations
   */
  private calculateEstimatedArrival(
    distanceKm: number,
    isEmergency: boolean = false,
  ): number {
    // Emergency vehicles can travel faster due to priority traffic handling
    const averageSpeed = isEmergency
      ? this.AVERAGE_SPEED_KMH * 1.3
      : this.AVERAGE_SPEED_KMH;
    return Math.round((distanceKm / averageSpeed) * 60); // Convert to minutes
  }

  /**
   * Validate GPS coordinates are within Earth bounds
   */
  private validateGPSCoordinates(latitude: number, longitude: number): void {
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException(
        `Invalid latitude: ${latitude}. Must be between -90 and 90`,
      );
    }
    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException(
        `Invalid longitude: ${longitude}. Must be between -180 and 180`,
      );
    }
  }

  /**
   * Get statistics about driver matching performance
   */
  async getMatchingStats(): Promise<any> {
    const pendingOffersCount = this.pendingOffers.size;

    // Get active rides waiting for drivers
    const waitingRides = await this.rideModel.countDocuments({
      status: RideStatus.REQUESTED,
    });

    // Get available drivers count
    const availableDrivers = await this.userModel.countDocuments({
      role: 'DRIVER',
      approval: DriverApproval.APPROVED,
      is_online: true,
      is_deleted: false,
    });

    return {
      pending_offers: pendingOffersCount,
      rides_waiting_for_drivers: waitingRides,
      available_drivers: availableDrivers,
      average_matching_radius: this.INITIAL_RADIUS_KM,
      max_matching_radius: this.MAX_RADIUS_KM,
    };
  }
}
