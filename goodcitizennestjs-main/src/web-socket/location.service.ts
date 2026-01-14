/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationService } from '../common/notification.service';
import { PerformanceService } from '../common/performance.service';
import { Session, SessionDocument } from '../user/entities/session.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { LatLong } from './dto/web-socket.dto';
import * as turf from '@turf/turf';
import {
  DriverRide,
  DriverRideDocument,
} from '../driver/entities/driver-ride.entity';
import { locationNow } from '../common/utils';

@Injectable()
export class LocationService {
  private updateOption = { new: true, lean: true, sort: { _id: -1 } } as const;
  private readonly DESTINATION_DISTANCE = 500; // meters
  private readonly BEARING_DISTANCE = 65; // meters

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
    private notificationService: NotificationService,
    private performanceService: PerformanceService,
  ) {}

  async save_coordinates(user: any, payload: LatLong) {
    try {
      const { lat, long } = payload;

      if (!user || !user._id) {
        throw new Error('Invalid user data');
      }

      // Validate and parse coordinates
      const latitude = parseFloat(lat);
      const longitude = parseFloat(long);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid coordinate format');
      }

      // Validate coordinate bounds (Earth's surface)
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error('Coordinates out of valid Earth bounds');
      }

      const query = { _id: new Types.ObjectId(user._id) };

      // Create GeoJSON Point for MongoDB geospatial indexing
      const location = {
        type: 'Point',
        coordinates: [longitude, latitude], // MongoDB format: [long, lat]
      };

      // Calculate bearing and speed if we have previous location
      let bearing = 0;
      let speed = 0;
      let distanceMoved = 0;

      if (
        user.pre_location &&
        Array.isArray(user.pre_location.coordinates) &&
        user.pre_location.coordinates.length === 2 &&
        user.last_location_update
      ) {
        const [prevLong, prevLat] = user.pre_location.coordinates;
        const prevTime = new Date(user.last_location_update);
        const currentTime = new Date();

        // Calculate distance moved using Haversine formula
        distanceMoved = this.calculateDistance(
          prevLat,
          prevLong,
          latitude,
          longitude,
        );

        // Calculate time difference in hours
        const timeDiffHours =
          (currentTime.getTime() - prevTime.getTime()) / (1000 * 60 * 60);

        // Calculate speed in km/h (only if significant movement and reasonable time)
        if (distanceMoved > 0.001 && timeDiffHours > 0 && timeDiffHours < 1) {
          // Min 1m movement, max 1h gap
          speed = distanceMoved / timeDiffHours;
        }

        // Calculate bearing if movement is significant (min 5 meters)
        if (distanceMoved > 0.005) {
          bearing = this.calculateBearing(
            prevLat,
            prevLong,
            latitude,
            longitude,
          );
        } else {
          // Keep previous bearing if movement is too small
          bearing = user.current_bearing || 0;
        }
      }

      const update = {
        $set: {
          pre_location: user?.location || {
            type: 'Point',
            coordinates: [
              parseFloat(user.longitude || 0),
              parseFloat(user.latitude || 0),
            ],
          },
          location,
          latitude: latitude,
          longitude: longitude,
          current_bearing: bearing,
          current_speed: speed,
          last_location_update: new Date(),
          location_accuracy: payload.accuracy || null, // GPS accuracy if provided
          altitude: payload.altitude || null, // Altitude if provided
        },
      };

      const updatedUser = await this.userModel.findByIdAndUpdate(
        query,
        update,
        this.updateOption,
      );

      if (!updatedUser) {
        throw new Error('Failed to update user location');
      }

      // Store location history for tracking (optional - for analytics)
      if (distanceMoved > 0.01) {
        // Only store if moved more than 10 meters
        await this.storeLocationHistory(user._id, {
          location,
          timestamp: new Date(),
          bearing,
          speed,
          accuracy: payload.accuracy,
        });
      }

      console.log(
        `Location updated for user ${user._id}: ${latitude}, ${longitude}, bearing: ${bearing}°, speed: ${speed.toFixed(2)} km/h`,
      );

      return updatedUser;
    } catch (error) {
      console.error('Error in save_coordinates:', error);
      throw new Error('Location update failed');
    }
  }

  async findUsersAhead(
    driver: UserDocument,
    ride: DriverRideDocument,
    radiusInKm: number,
  ) {
    try {
// console.log removed
      // Use performance service for optimized emergency path clearing
      const usersInPath =
        await this.performanceService.findUsersInEmergencyPath(
          {
            latitude: driver.latitude,
            longitude: driver.longitude,
          },
          driver.current_bearing || 0,
          radiusInKm,
          120, // 120-degree cone for emergency path
        );
// console.log removed
      if (!usersInPath.length) return;

      // Check rate limiting for this ride
      const lastNotification = ride.last_notification;
      const now = new Date();
      const timeSinceLastNotification = lastNotification
        ? (now.getTime() - lastNotification.getTime()) / 1000
        : Infinity;

      if (timeSinceLastNotification < 30) {
// console.log removed
        return;
      }

      // Send notifications to users in path
      const notificationPromises = usersInPath.map(async (user: any) => {
        const distance =
          this.calculateDistance(
            driver.latitude,
            driver.longitude,
            user.latitude,
            user.longitude,
          ) * 1000; // Convert to meters

        return this.sendEmergencyNotification(user, driver, ride, {
          distance,
          estimatedArrival: this.calculateArrivalTime(
            distance,
            driver.current_speed || 30,
          ),
          priority: distance < 200 ? 'HIGH' : 'NORMAL',
        });
      });

      // Execute all notification checks
      const notificationResults = await Promise.all(notificationPromises);
      const successfulNotifications = notificationResults.filter(
        (result) => result === true,
      ).length;
// console.log removed
      // Update ride with last notification timestamp for rate limiting
      await this.driverRideModel.updateOne(
        { _id: ride._id },
        { last_notification: new Date() },
      );
    } catch (error) {
      console.error('Error in findUsersAhead:', error);
      throw error;
    }
  }

  async isUSerAhead(user: locationNow, from: locationNow, buffer: any) {
    try {
// console.log removed
// console.log removed
// console.log removed
      const userPoint = turf.point([user.long, user.lat]);
      const distanceInKm = turf.distance(
        turf.point([from.long, from.lat]),
        userPoint,
        { units: 'kilometers' },
      );
      const distanceInMeters = distanceInKm * 1000;
      const bearing = turf.bearing(
        turf.point([from.long, from.lat]),
        userPoint,
      );
      const isInsideCorridor = turf.booleanPointInPolygon(userPoint, buffer);
      const isInDistance = distanceInMeters <= this.DESTINATION_DISTANCE;
      const isBearing = bearing <= this.BEARING_DISTANCE;
      const shouldAlert = isInDistance && isBearing && isInsideCorridor;
      return {
        coordinates: user,
        distanceInMeters,
        bearing,
        isInsideCorridor,
        shouldAlert,
      };
    } catch (error) {
// console.log removed
      throw error;
    }
  }

  /**
   * Send emergency notification to a specific user with enhanced messaging
   */
  private async sendEmergencyNotification(
    user: any,
    driver: UserDocument,
    ride: DriverRideDocument,
    alertData: {
      distance: number;
      estimatedArrival: number;
      priority?: string;
    },
  ): Promise<boolean> {
    try {
      const notificationToken: any = await this.sessionModel
        .findOne({ user_id: user._id })
        .lean();

      if (!notificationToken || !notificationToken.fcm_token) {
// console.log removed
        return false;
      }

      // Enhanced emergency messaging based on distance and priority
      let message: string;
      let title: string;

      if (alertData.distance < 100) {
        title = '🚨 URGENT: Emergency Vehicle';
        message = `Emergency vehicle is very close (${Math.round(alertData.distance)}m)! Please clear the path immediately!`;
      } else if (alertData.distance < 300) {
        title = '🚨 Emergency Vehicle Alert';
        message = `Emergency vehicle approaching in ${alertData.estimatedArrival}s (${Math.round(alertData.distance)}m away). Please move aside.`;
      } else {
        title = '🚨 Emergency Vehicle Ahead';
        message = `Emergency vehicle coming your way. ETA: ${alertData.estimatedArrival}s. Please prepare to give way.`;
      }

      // Add priority indicator
      if (alertData.priority === 'HIGH') {
        message = `⚡ ${message}`;
      }

      await this.notificationService.send_notification(
        notificationToken,
        message,
        title,
        driver._id,
        ride._id.toString(),
      );

      console.log(
        `Emergency notification sent to user ${user._id} (${alertData.priority || 'NORMAL'} priority)`,
      );
      return true;
    } catch (error) {
      console.error(
        `Failed to send emergency notification to user ${user._id}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Broadcast emergency alert with rate limiting and cone-based detection
   */
  async broadcastEmergencyAlert(
    driverId: string,
    rideId: string,
    location: { latitude: number; longitude: number },
    bearing: number,
    speed: number = 30,
  ): Promise<{ notified: number; skipped: number; reason?: string }> {
    try {
      // Check if this is an emergency ride
      const ride = await this.driverRideModel.findById(rideId);
      if (!ride) {
        return { notified: 0, skipped: 0, reason: 'Ride not found' };
      }

      // Rate limiting check
      const lastNotification = ride.last_notification;
      const now = new Date();
      const timeSinceLastNotification = lastNotification
        ? (now.getTime() - lastNotification.getTime()) / 1000
        : Infinity;

      if (timeSinceLastNotification < 30) {
        return {
          notified: 0,
          skipped: 1,
          reason: `Rate limited: ${timeSinceLastNotification.toFixed(1)}s since last notification`,
        };
      }

      // Get driver information
      const driver = await this.userModel.findById(driverId);
      if (!driver) {
        return { notified: 0, skipped: 0, reason: 'Driver not found' };
      }

      // Dynamic radius based on speed (faster = larger radius)
      const baseRadius = 0.5; // 500m base radius
      const speedMultiplier = Math.min(speed / 30, 2); // Max 2x multiplier
      const alertRadius = baseRadius * speedMultiplier;

      // Find users in cone ahead of emergency vehicle
      const coneAngle = 120; // degrees (60 degrees on each side)
      const maxDistance = alertRadius * 1000; // Convert to meters

      const query = {
        _id: { $ne: new Types.ObjectId(driverId) },
        role: 'USER',
        is_online: true,
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [location.longitude, location.latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      };

      const users = await this.userModel.find(
        query,
        {
          _id: 1,
          latitude: 1,
          longitude: 1,
          socket_id: 1,
        },
        { lean: true },
      );

      let notifiedCount = 0;
      let skippedCount = 0;

      // Filter users in cone and send notifications
      for (const user of users) {
        const bearingToUser = this.calculateBearing(
          location.latitude,
          location.longitude,
          user.latitude,
          user.longitude,
        );

        const bearingDifference = Math.abs(bearingToUser - bearing);
        const normalizedBearingDiff =
          bearingDifference > 180 ? 360 - bearingDifference : bearingDifference;
        const isInCone = normalizedBearingDiff <= coneAngle / 2;

        if (isInCone) {
          const distance =
            this.calculateDistance(
              location.latitude,
              location.longitude,
              user.latitude,
              user.longitude,
            ) * 1000; // Convert to meters

          const success = await this.sendEmergencyNotification(
            user,
            driver,
            ride,
            {
              distance,
              estimatedArrival: this.calculateArrivalTime(distance, speed),
              priority: distance < 200 ? 'HIGH' : 'NORMAL',
            },
          );

          if (success) {
            notifiedCount++;
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }

      // Update last notification timestamp
      await this.driverRideModel.updateOne(
        { _id: rideId },
        { last_notification: now },
      );
// console.log removed
      return { notified: notifiedCount, skipped: skippedCount };
    } catch (error) {
      console.error('Error broadcasting emergency alert:', error);
      return { notified: 0, skipped: 0, reason: 'Broadcast failed' };
    }
  }
  private calculateArrivalTime(
    distanceMeters: number,
    speedKmh: number,
  ): number {
    if (speedKmh <= 0) speedKmh = 30; // Default speed if not available

    const speedMs = speedKmh / 3.6; // Convert km/h to m/s
    const timeSeconds = distanceMeters / speedMs;

    return Math.round(timeSeconds);
  }

  /**
   * Enhanced location broadcasting for real-time tracking
   */
  async broadcastLocationUpdate(
    userId: string,
    _location: { latitude: number; longitude: number },
    _additionalData?: any,
  ): Promise<void> {
    try {
      // Find all relevant connections that should receive this location update
      const relevantConnections = await this.findRelevantConnections(userId);

      // Broadcast to relevant users (passengers, drivers, admin)
      for (const connection of relevantConnections) {
        try {
          // This would integrate with the WebSocket gateway to send real-time updates
// console.log removed
          // In a real implementation, this would emit WebSocket events:
          // this.webSocketGateway.sendToUser(connection.userId, 'location_update', locationUpdate);
        } catch (error) {
          console.error(`Failed to broadcast to ${connection.userId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error broadcasting location update:', error);
    }
  }

  /**
   * Find connections that should receive location updates
   */
  private async findRelevantConnections(
    userId: string,
  ): Promise<Array<{ userId: string; type: string }>> {
    try {
      const connections: Array<{ userId: string; type: string }> = [];

      // Find active rides where this user is involved
      const activeRides = await this.driverRideModel
        .find({
          $or: [{ user_id: userId }, { driver_id: userId }],
          status: {
            $in: [
              'driver_assigned',
              'driver_arriving',
              'driver_arrived',
              'in_progress',
            ],
          },
        })
        .lean();

      for (const ride of activeRides) {
        // If user is passenger, notify driver
        if (ride.user_id?.toString() === userId && ride.driver_id) {
          connections.push({
            userId: ride.driver_id.toString(),
            type: 'driver',
          });
        }

        // If user is driver, notify passenger
        if (ride.driver_id?.toString() === userId && ride.user_id) {
          connections.push({
            userId: ride.user_id.toString(),
            type: 'passenger',
          });
        }
      }

      return connections;
    } catch (error) {
      console.error('Error finding relevant connections:', error);
      return [];
    }
  }

  /**
   * Store location history for analytics and tracking
   */
  private async storeLocationHistory(
    userId: string,
    locationData: any,
  ): Promise<void> {
    try {
      // This could be implemented with a separate LocationHistory collection
      // For now, we'll just log it for future implementation
// console.log removed
      // Future implementation:
      // await this.locationHistoryModel.create({
      //   user_id: userId,
      //   ...locationData
      // });
    } catch (error) {
      console.error('Error storing location history:', error);
      // Don't throw error as this is not critical for main functionality
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const toDeg = (rad: number) => rad * (180 / Math.PI);

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  }
}
