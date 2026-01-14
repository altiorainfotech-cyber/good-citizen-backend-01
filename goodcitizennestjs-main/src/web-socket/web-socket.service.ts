/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Session, SessionDocument } from '../user/entities/session.entity';
import { CommonService } from '../common/common.service';
import { LatLong } from './dto/web-socket.dto';
import { NotificationService } from '../common/notification.service';

export interface AuthenticationResult {
  success: boolean;
  user?: UserDocument;
  sessionId?: string;
  error?: string;
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private option = { lean: true, sort: { _id: -1 } } as const;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private commonService: CommonService,
    private notificationService: NotificationService,
  ) {}
  /**
   * Enhanced WebSocket authentication with comprehensive validation
   */
  async authenticateConnection(
    token: string,
    socketId: string,
  ): Promise<AuthenticationResult> {
    try {
      if (!token) {
        return { success: false, error: 'No authentication token provided' };
      }

      // Clean token (remove Bearer prefix if present)
      const cleanToken = token.toLowerCase().startsWith('bearer ')
        ? token.slice(7).trim()
        : token.trim();

      if (!cleanToken) {
        return { success: false, error: 'Empty authentication token' };
      }

      // Decode and validate JWT token
      let decoded;
      try {
        decoded = await this.commonService.decodeToken(cleanToken);
      } catch (error: any) {
        this.logger.warn(`Token decode failed: ${error.message}`);
        return { success: false, error: 'Invalid or expired token' };
      }

      if (!decoded || !decoded.session_id || !decoded._id) {
        return { success: false, error: 'Invalid token payload' };
      }

      // Validate session exists and is active
      const session = await this.sessionModel.findById(
        new Types.ObjectId(decoded.session_id),
        {},
        { lean: true },
      );

      if (!session) {
        return { success: false, error: 'Session not found or expired' };
      }

      // Check if session is still valid (not expired)
      const sessionAge = Date.now() - new Date(session.updated_at).getTime();
      const maxSessionAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (sessionAge > maxSessionAge) {
        // Clean up expired session
        await this.sessionModel.findByIdAndDelete(session._id);
        return { success: false, error: 'Session expired' };
      }

      // Get user data
      const user = await this.userModel.findById(
        new Types.ObjectId(decoded._id),
        {},
        { lean: true },
      );

      if (!user || user.is_deleted) {
        return { success: false, error: 'User not found or deactivated' };
      }

      // Update session with socket connection info
      await this.sessionModel.findByIdAndUpdate(session._id, {
        socket_id: socketId,
        last_activity: new Date(),
        updated_at: Date.now(),
      });

      this.logger.log(
        `User ${user._id} authenticated successfully for WebSocket`,
      );

      return {
        success: true,
        user: user as UserDocument,
        sessionId: session._id.toString(),
      };
    } catch (error: any) {
      this.logger.error(`WebSocket authentication error: ${error.message}`);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Enhanced disconnect handling with proper cleanup
   */
  async handleDisconnect(userId: string, socketId?: string): Promise<void> {
    try {
      if (!userId) {
        this.logger.warn('Disconnect called without userId');
        return;
      }

      this.logger.log(
        `Handling disconnect for user ${userId}, socket: ${socketId}`,
      );

      // Update user online status
      const userUpdate = {
        is_online: false,
        socket_id: null,
        last_seen: new Date(),
      };

      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        userUpdate,
      );

      // Update session to remove socket connection
      if (socketId) {
        await this.sessionModel.updateMany(
          {
            user_id: new Types.ObjectId(userId),
            socket_id: socketId,
          },
          {
            socket_id: null,
            last_activity: new Date(),
            updated_at: Date.now(),
          },
        );
      }

      this.logger.log(`User ${userId} disconnect cleanup completed`);
    } catch (error: any) {
      this.logger.error(
        `Disconnect cleanup error for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Enhanced location saving with validation and timestamps
   */
  async save_coordinates(user: any, payload: LatLong): Promise<any> {
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

      // Validate coordinate bounds
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

      // Calculate bearing only if we have valid previous coordinates
      let driverBearing = 0;
      if (
        user.pre_location &&
        Array.isArray(user.pre_location.coordinates) &&
        user.pre_location.coordinates.length === 2
      ) {
        const [prevLong, prevLat] = user.pre_location.coordinates;

        // Only calculate bearing if movement is significant enough (to avoid erratic values)
        const distanceMoved = this.calculateDistance(
          prevLat,
          prevLong,
          latitude,
          longitude,
        );

        if (distanceMoved > 0.005) {
          // Minimum 5 meters movement to calculate bearing
          driverBearing = await this.calculateBearing(
            prevLat,
            prevLong,
            latitude,
            longitude,
          );
        } else {
          // Keep previous bearing if movement is too small
          driverBearing = user.current_bearing || 0;
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
          current_bearing: driverBearing,
          current_speed: 0, // Speed tracking for future use
          last_location_update: new Date(),
        },
      };

      const updatedUser = await this.userModel.findByIdAndUpdate(
        query,
        update,
        {
          new: true,
          lean: true,
        },
      );

      if (!updatedUser) {
        throw new Error('Failed to update user location');
      }

      this.logger.debug(
        `Location updated for user ${user._id}: ${latitude}, ${longitude}`,
      );

      return { driver: updatedUser, driverBearing };
    } catch (error: any) {
      this.logger.error(
        `Error in save_coordinates for user ${user?._id}: ${error.message}`,
      );
      throw new Error(`Location update failed: ${error.message}`);
    }
  }

  calculateDistance(
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

  async findUsersAhead(
    driver_id: string,
    ride_id: string | Types.ObjectId,
    lat: number,
    long: number,
    bearing: number, // Driver's movement angle
    radiusInKm: number,
  ) {
    try {
      // Query: Get users within the radius, excluding the driver
      const query = {
        _id: { $ne: new Types.ObjectId(driver_id) },
        role: 'USER',
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [long, lat],
            },
            $maxDistance: radiusInKm * 1000, // Convert km to meters
          },
        },
      };

      const projection = {
        _id: 1,
        socket_id: 1,
        latitude: 1,
        longitude: 1,
        pre_location: 1,
      };

      // Fetch users in range
      const users = await this.userModel.find(query, projection, this.option);
// console.log removed
      const usersToNotify: any = users.map(async (user) => {
        // 1. Calculate bearing FROM driver TO user (this tells us direction to the user)
        const bearingToUser = await this.calculateBearing(
          lat, // driver latitude
          long, // driver longitude
          user.latitude, // user latitude
          user.longitude, // user longitude
        );

        // 2. Determine if user is ahead of driver by comparing bearingToUser with driver's bearing
        // If user is in the general direction the driver is moving, they're ahead
        const angleDiffToUser = await this.getAngleDifference(
          bearingToUser,
          bearing,
        );
        const isUserAhead = angleDiffToUser <= 90; // User is within a 90° cone ahead of driver

        // 3. If we have user's previous coordinates, determine if they're moving in same direction
        let userBearing;
        let isMovingSameDirection = false;

        if (user.pre_location && Array.isArray(user.pre_location.coordinates)) {
          const [prevLong, prevLat] = user.pre_location.coordinates;

          // Only calculate if there's meaningful movement and coordinates are valid
          if (prevLat !== undefined && prevLong !== undefined) {
            // 5 meters minimum to avoid GPS jitter
            userBearing = await this.calculateBearing(
              prevLat,
              prevLong,
              user.latitude,
              user.longitude,
            );

            // Compare user's movement direction with driver's direction
            const directionDifference = await this.getAngleDifference(
              userBearing,
              bearing,
            );
            isMovingSameDirection = directionDifference <= 135; // Within 45° of driver's direction
// console.log removed
// console.log removed
// console.log removed
// console.log removed
// console.log removed
          }
        }
// console.log removed
// console.log removed
// console.log removed
// console.log removed
        // Get user's token
        const token = await this.sessionModel
          .findOne({ user_id: user._id })
          .lean();

        // 4. Decision logic for notification
        if (isUserAhead && isMovingSameDirection) {
          // Regular notification - user must be ahead
          // Prioritize users moving in same direction, but notify all ahead users
        }

        return token;
        // return shouldNotify ? token : null;
      });

      // Filter out null values
      const validTokens = usersToNotify
        .filter((token: any) => token?.fcm_token !== null)
        .map((token: any) => ({
          fcm_token: token?.fcm_token,
          user_id: token?.user_id,
        }));
// console.log removed
      if (validTokens.length > 0) {
        const message = 'An ambulance is coming. Please move aside';
        const title = 'Emergency Vehicle Alert';
        await this.notificationService.send_notification(
          validTokens,
          message,
          title,
          driver_id,
          ride_id,
        );

        // Award loyalty points to users who received emergency notifications
        await this.awardLoyaltyPointsForEmergencyAssist(
          validTokens,
          driver_id,
          ride_id,
          lat,
          long,
        );
      }
    } catch (error) {
      console.error('Error in findUsersAhead:', error);
      throw error;
    }
  }

  // Revised calculateBearing with debug logging
  async calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const toDeg = (rad: number) => rad * (180 / Math.PI);

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    const bearing = (toDeg(θ) + 360) % 360;

    console.log(
      `Bearing from (${lat1},${lon1}) to (${lat2},${lon2}): ${bearing}°`,
    );
    return bearing;
  }

  // Get the smallest angle difference (accounting for 360-degree wraparound)
  async getAngleDifference(angle1: number, angle2: number) {
    const diff = Math.abs(angle1 - angle2) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  /**
   * Send message to specific user via WebSocket
   * This method integrates with the WebSocket gateway
   */
  async sendToUser(
    userId: string,
    event: string,
    _data: any,
  ): Promise<boolean> {
    try {
      // Find active session with socket connection
      const session = await this.sessionModel.findOne(
        {
          user_id: new Types.ObjectId(userId),
          socket_id: { $ne: null },
        },
        {},
        { lean: true },
      );

      if (session && (session as any).socket_id) {
        this.logger.debug(`Message queued for user ${userId}, event: ${event}`);
        // In a real implementation, this would integrate with the gateway
        // For now, we'll log the message that would be sent
        return true;
      } else {
        this.logger.debug(`User ${userId} not connected, message not sent`);
        return false;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send message to user ${userId}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get user connection status
   */
  async getUserConnectionStatus(userId: string): Promise<{
    isOnline: boolean;
    lastSeen?: Date;
    socketId?: string;
  }> {
    try {
      const user = await this.userModel.findById(
        userId,
        {
          is_online: 1,
          last_seen: 1,
          socket_id: 1,
        },
        { lean: true },
      );

      if (!user) {
        return { isOnline: false };
      }

      return {
        isOnline: user.is_online || false,
        lastSeen: (user as any).last_seen,
        socketId: (user as any).socket_id,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get connection status for user ${userId}: ${error.message}`,
      );
      return { isOnline: false };
    }
  }

  /**
   * Award loyalty points to users for emergency assistance
   */
  private async awardLoyaltyPointsForEmergencyAssist(
    notifiedUsers: Array<{ fcm_token: string; user_id: Types.ObjectId }>,
    driverId: string,
    rideId: string | Types.ObjectId,
    driverLat: number,
    driverLong: number,
  ): Promise<void> {
    try {
      // Award points to each user who received the emergency notification
      for (const userToken of notifiedUsers) {
        try {
          // Get user location to calculate response time
          const user = await this.userModel.findById(userToken.user_id).lean();
          if (!user) continue;

          // Calculate estimated time saved (simplified calculation)
          const distance = this.calculateDistance(
            driverLat,
            driverLong,
            user.latitude,
            user.longitude,
          );

          // Estimate time saved based on distance (closer users save more time)
          // Assume emergency vehicle travels at 60 km/h, regular traffic at 30 km/h
          const emergencySpeed = 60; // km/h
          const regularSpeed = 30; // km/h
          const timeSavedHours =
            distance * (1 / regularSpeed - 1 / emergencySpeed);
          const timeSavedSeconds = Math.max(
            5,
            Math.round(timeSavedHours * 3600),
          ); // Minimum 5 seconds

          // TODO: Implement loyalty points service
          // await this.loyaltyPointsService.awardEmergencyAssistPoints({
          //   user_id: userToken.user_id.toString(),
          //   driver_id: driverId,
          //   ride_id: rideId.toString(),
          //   emergency_type: 'AMBULANCE', // Default to ambulance for now
          //   time_saved_seconds: timeSavedSeconds,
          //   location: {
          //     latitude: user.latitude,
          //     longitude: user.longitude
          //   },
          //   timestamp: new Date()
          // });

          this.logger.debug(
            `Emergency assist completed for user ${userToken.user_id} (loyalty points disabled)`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to process emergency assist for user ${userToken.user_id}: ${error.message}`,
          );
          // Continue with other users even if one fails
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error in awardLoyaltyPointsForEmergencyAssist: ${error.message}`,
      );
    }
  }

  /**
   * Clean up expired sessions and update user status
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      // Find sessions that haven't been active recently
      const expiredSessions = await this.sessionModel.find(
        {
          last_activity: { $lt: expiredThreshold },
        },
        { user_id: 1 },
        { lean: true },
      );

      if (expiredSessions.length > 0) {
        const userIds = expiredSessions.map((session) => session.user_id);

        // Update users to offline status
        await this.userModel.updateMany(
          { _id: { $in: userIds } },
          {
            is_online: false,
            socket_id: null,
            last_seen: new Date(),
          },
        );

        // Remove expired sessions
        await this.sessionModel.deleteMany({
          last_activity: { $lt: expiredThreshold },
        });

        this.logger.log(
          `Cleaned up ${expiredSessions.length} expired sessions`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Session cleanup error: ${error.message}`);
    }
  }
}
