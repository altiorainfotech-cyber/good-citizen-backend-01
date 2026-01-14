/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebSocketService } from './web-socket.service';
import { DriverLatLong, LatLong } from './dto/web-socket.dto';
import { Model, Types } from 'mongoose';
import { UnauthorizedException, Logger } from '@nestjs/common';
import { LocationService } from './location.service';
import { InjectModel } from '@nestjs/mongoose';
import {
  DriverRide,
  DriverRideDocument,
} from 'src/driver/entities/driver-ride.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { WebSocketEventCompatibilityService } from '../common/websocket-event-compatibility.service';

interface CustomSocket extends Socket {
  user: UserDocument;
  userId: string;
  sessionId: string;
  isAuthenticated: boolean;
}

interface UserRoom {
  userId: string;
  socketId: string;
  joinedAt: Date;
  lastActivity: Date;
}

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private activeUsers = new Map<string, CustomSocket>();
  private userRooms = new Map<string, UserRoom>();
  private connectionAttempts = new Map<string, number>();

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly locationService: LocationService,
    private readonly eventCompatibility: WebSocketEventCompatibilityService,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async handleConnection(socket: CustomSocket, ...args: any[]) {
    const clientIp = socket.handshake.address;
    this.logger.log(
      `New connection attempt from ${clientIp}, socket: ${socket.id}`,
    );

    try {
      // Enhanced token extraction with multiple sources
      const token = this.extractToken(socket);
      if (!token) {
        this.logger.warn(
          `Connection rejected - no token provided, socket: ${socket.id}`,
        );
        const errorEvent = this.eventCompatibility.formatErrorEvent(
          'AUTH_REQUIRED',
          'Authentication token required',
        );
        socket.emit(errorEvent.event, errorEvent.data);
        socket.disconnect(true);
        return;
      }

      // Track connection attempts for rate limiting
      const attempts = this.connectionAttempts.get(clientIp) || 0;
      if (attempts > 10) {
        this.logger.warn(
          `Connection rejected - too many attempts from ${clientIp}`,
        );
        const errorEvent = this.eventCompatibility.formatErrorEvent(
          'RATE_LIMIT',
          'Too many connection attempts',
        );
        socket.emit(errorEvent.event, errorEvent.data);
        socket.disconnect(true);
        return;
      }

      // Authenticate and get user data
      const authResult = await this.webSocketService.authenticateConnection(
        token,
        socket.id,
      );
      if (!authResult.success || !authResult.user) {
        this.connectionAttempts.set(clientIp, attempts + 1);
        this.logger.warn(
          `Authentication failed for socket: ${socket.id}, reason: ${authResult.error}`,
        );
        const errorEvent = this.eventCompatibility.formatErrorEvent(
          'AUTH_FAILED',
          authResult.error || 'Authentication failed',
        );
        socket.emit(errorEvent.event, errorEvent.data);
        socket.disconnect(true);
        return;
      }

      // Set socket properties
      socket.user = authResult.user;
      socket.userId = authResult.user._id.toString();
      socket.sessionId = authResult.sessionId || '';
      socket.isAuthenticated = true;

      // Join user to their personal room
      const userRoom = `user_${socket.userId}`;
      await socket.join(userRoom);

      // Store active connection
      this.activeUsers.set(socket.userId, socket);
      this.userRooms.set(socket.userId, {
        userId: socket.userId,
        socketId: socket.id,
        joinedAt: new Date(),
        lastActivity: new Date(),
      });

      // Update user online status
      await this.userModel.findByIdAndUpdate(socket.userId, {
        is_online: true,
        socket_id: socket.id,
        last_seen: new Date(),
      });

      // Reset connection attempts on successful auth
      this.connectionAttempts.delete(clientIp);

      this.logger.log(
        `User ${socket.userId} connected successfully, socket: ${socket.id}`,
      );

      // Send connection confirmation using compatibility service
      const connectionEvent = this.eventCompatibility.formatConnectionEvent(
        socket.userId,
        authResult.user.role === 'DRIVER' ? 'ambulance_driver' : 'user',
      );
      socket.emit(connectionEvent.event, connectionEvent.data);
    } catch (error: any) {
      this.logger.error(
        `Connection error for socket ${socket.id}:`,
        error.message,
      );
      const errorEvent = this.eventCompatibility.formatErrorEvent(
        'CONNECTION_ERROR',
        'Connection failed',
      );
      socket.emit(errorEvent.event, errorEvent.data);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: CustomSocket) {
    const userId = socket.userId;
    const socketId = socket.id;

    this.logger.log(
      `Client disconnecting: ${socketId}, user: ${userId || 'unknown'}`,
    );

    try {
      if (userId && socket.isAuthenticated) {
        // Clean up user session
        await this.webSocketService.handleDisconnect(userId, socketId);

        // Remove from active connections
        this.activeUsers.delete(userId);
        this.userRooms.delete(userId);

        // Update user offline status
        await this.userModel.findByIdAndUpdate(userId, {
          is_online: false,
          socket_id: null,
          last_seen: new Date(),
        });

        // Leave user room
        const userRoom = `user_${userId}`;
        socket.leave(userRoom);

        this.logger.log(`User ${userId} disconnected and cleaned up`);

        // Notify other services about user going offline using compatibility service
        const statusEvent = this.eventCompatibility.formatUserStatusEvent(
          userId,
          'offline',
          socket.user.role === 'DRIVER' ? 'ambulance_driver' : 'user',
        );
        this.server.to(`admin_room`).emit(statusEvent.event, statusEvent.data);
      }
    } catch (error: any) {
      this.logger.error(
        `Disconnect cleanup error for socket ${socketId}:`,
        error.message,
      );
    }
  }

  @SubscribeMessage('save_location')
  async save_lat_long(socket: CustomSocket, payload: LatLong) {
    try {
      if (!socket.isAuthenticated || !socket.user) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for location updates',
        });
        return;
      }

      // Update last activity
      const userRoom = this.userRooms.get(socket.userId);
      if (userRoom) {
        userRoom.lastActivity = new Date();
      }

      this.logger.debug(`Location update from user ${socket.userId}`);

      // Validate location data
      const lat = parseFloat(payload.lat);
      const long = parseFloat(payload.long);

      if (
        isNaN(lat) ||
        isNaN(long) ||
        lat < -90 ||
        lat > 90 ||
        long < -180 ||
        long > 180
      ) {
        socket.emit('error', {
          code: 'INVALID_LOCATION',
          message: 'Invalid GPS coordinates',
        });
        return;
      }

      await this.webSocketService.save_coordinates(socket.user, payload);

      // Acknowledge successful location update using compatibility service
      const locationEvent = this.eventCompatibility.formatLocationUpdateEvent(
        socket.userId,
        { lat: parseFloat(payload.lat), long: parseFloat(payload.long) },
      );
      socket.emit(locationEvent.event, locationEvent.data);
    } catch (error: any) {
      this.logger.error(
        `Location save error for user ${socket.userId}:`,
        error.message,
      );
      socket.emit('error', {
        code: 'LOCATION_SAVE_FAILED',
        message: 'Failed to save location',
      });
    }
  }

  // @SubscribeMessage("driver_location")
  // async driver_location(socket: CustomSocket, payload: DriverLatLong) {
  //   try {
  //     let user = socket.user;
  //     console.log("driver_location",user)
  //     let { driver, driverBearing } = await this.webSocketService.save_coordinates(user, payload);
  //     await this.webSocketService.findUsersAhead(driver._id, payload.ride_id, driver?.latitude,
  //       driver?.longitude, driverBearing, 5,false);
  //   } catch (error) {
  //     throw error
  //   }
  // }

  @SubscribeMessage('driver_location')
  async driver_location(socket: CustomSocket, payload: DriverLatLong) {
    try {
      if (!socket.isAuthenticated || !socket.user) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for driver location updates',
        });
        return;
      }

      // Verify user is a driver
      if (socket.user.role !== 'DRIVER') {
        socket.emit('error', {
          code: 'FORBIDDEN',
          message: 'Only drivers can send driver location updates',
        });
        return;
      }

      // Update last activity
      const userRoom = this.userRooms.get(socket.userId);
      if (userRoom) {
        userRoom.lastActivity = new Date();
      }

      this.logger.debug(
        `Driver location update from ${socket.userId}, ride: ${payload.ride_id}`,
      );

      // Validate location data
      const lat = parseFloat(payload.lat);
      const long = parseFloat(payload.long);

      if (
        isNaN(lat) ||
        isNaN(long) ||
        lat < -90 ||
        lat > 90 ||
        long < -180 ||
        long > 180
      ) {
        socket.emit('error', {
          code: 'INVALID_LOCATION',
          message: 'Invalid GPS coordinates',
        });
        return;
      }

      // Validate ride ID
      if (!payload.ride_id || !Types.ObjectId.isValid(payload.ride_id)) {
        socket.emit('error', {
          code: 'INVALID_RIDE_ID',
          message: 'Valid ride ID required',
        });
        return;
      }

      const driver = await this.locationService.save_coordinates(
        socket.user,
        payload,
      );
      if (!driver) {
        socket.emit('error', {
          code: 'LOCATION_SAVE_FAILED',
          message: 'Failed to save driver location',
        });
        return;
      }

      const ride: any = await this.driverRideModel
        .findById({ _id: payload.ride_id })
        .lean();
      if (!ride) {
        socket.emit('error', {
          code: 'RIDE_NOT_FOUND',
          message: 'Ride not found',
        });
        return;
      }

      // Rate limiting for emergency notifications (1 minute minimum)
      const currentDate = Date.now();
      const lastNotification = ride.last_notification
        ? new Date(ride.last_notification).getTime()
        : 0;
      const diffInMinutes = (currentDate - lastNotification) / (1000 * 60);

      if (diffInMinutes > 1) {
        await this.locationService.findUsersAhead(driver, ride, 5);
      }

      // Broadcast driver location to relevant users (passenger, admin) using compatibility service
      if (ride.user_id) {
        const driverLocationEvent =
          this.eventCompatibility.formatDriverLocationEvent(
            socket.userId,
            payload.ride_id,
            { lat: parseFloat(payload.lat), long: parseFloat(payload.long) },
            socket.user,
          );
        this.server
          .to(`user_${ride.user_id}`)
          .emit(driverLocationEvent.event, driverLocationEvent.data);
      }

      // Acknowledge successful location update using compatibility service
      const ackEvent = this.eventCompatibility.formatAcknowledgmentEvent(
        'driver_location',
        payload.ride_id,
        {
          coordinates: { lat: payload.lat, long: payload.long },
          rideId: payload.ride_id,
        },
      );
      socket.emit(ackEvent.event, ackEvent.data);
    } catch (error: any) {
      this.logger.error(
        `Driver location error for user ${socket.userId}:`,
        error.message,
      );
      socket.emit('error', {
        code: 'DRIVER_LOCATION_FAILED',
        message: 'Failed to process driver location',
      });
    }
  }

  /**
   * Extract authentication token from various sources
   */
  private extractToken(socket: CustomSocket): string | null {
    // Try header first (Authorization: Bearer <token>)
    let token = socket.handshake.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
      return token.substring(7);
    }

    // Try custom token header
    token = socket.handshake.headers.token as string;
    if (token) {
      return token;
    }

    // Try query parameter
    token = socket.handshake.query.token as string;
    if (token) {
      return token;
    }

    // Try auth query parameter
    token = socket.handshake.auth?.token;
    if (token) {
      return token;
    }

    return null;
  }

  /**
   * Send message to specific user
   */
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    try {
      const userRoom = `user_${userId}`;
      const sockets = await this.server.in(userRoom).fetchSockets();

      if (sockets.length > 0) {
        this.server.to(userRoom).emit(event, data);
        this.logger.debug(`Message sent to user ${userId}, event: ${event}`);
        return true;
      } else {
        this.logger.debug(`User ${userId} not connected, message queued`);
        // Could implement message queuing here for offline users
        return false;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send message to user ${userId}:`,
        error.message,
      );
      return false;
    }
  }

  /**
   * Broadcast message to all connected users
   */
  async broadcastToAll(
    event: string,
    data: any,
    excludeUserId?: string,
  ): Promise<void> {
    try {
      if (excludeUserId) {
        const excludeSocket = this.activeUsers.get(excludeUserId);
        if (excludeSocket) {
          excludeSocket.broadcast.emit(event, data);
        } else {
          this.server.emit(event, data);
        }
      } else {
        this.server.emit(event, data);
      }
      this.logger.debug(`Broadcast message sent, event: ${event}`);
    } catch (error: any) {
      this.logger.error(`Failed to broadcast message:`, error.message);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.activeUsers.size;
  }

  /**
   * Get user connection info
   */
  getUserConnectionInfo(userId: string): UserRoom | null {
    return this.userRooms.get(userId) || null;
  }

  /**
   * Cleanup inactive connections
   */
  async cleanupInactiveConnections(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [userId, room] of this.userRooms.entries()) {
      const timeSinceActivity = now.getTime() - room.lastActivity.getTime();

      if (timeSinceActivity > inactiveThreshold) {
        const socket = this.activeUsers.get(userId);
        if (socket) {
          this.logger.log(`Disconnecting inactive user: ${userId}`);
          socket.disconnect(true);
        }
      }
    }
  }

  /**
   * Handle ride status updates
   */
  @SubscribeMessage('ride_status_update')
  async handleRideStatusUpdate(
    socket: CustomSocket,
    payload: { rideId: string; status: string; data?: any },
  ) {
    try {
      if (!socket.isAuthenticated || !socket.user) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Validate ride ID
      if (!payload.rideId || !Types.ObjectId.isValid(payload.rideId)) {
        socket.emit('error', {
          code: 'INVALID_RIDE_ID',
          message: 'Valid ride ID required',
        });
        return;
      }

      // Find the ride and broadcast to relevant users using compatibility service
      const ride = await this.driverRideModel.findById(payload.rideId).lean();
      if (ride) {
        const statusChangeEvent =
          this.eventCompatibility.formatRideStatusChangeEvent(
            payload.rideId,
            payload.status,
            ride,
            socket.user,
          );

        // Broadcast to passenger
        if (ride.user_id) {
          this.server
            .to(`user_${ride.user_id}`)
            .emit(statusChangeEvent.event, statusChangeEvent.data);
        }

        // Broadcast to driver if update came from passenger
        if (ride.driver_id && socket.userId !== ride.driver_id.toString()) {
          this.server
            .to(`user_${ride.driver_id}`)
            .emit(statusChangeEvent.event, statusChangeEvent.data);
        }
      }

      // Send acknowledgment using compatibility service
      const ackEvent = this.eventCompatibility.formatAcknowledgmentEvent(
        'ride_status_update',
        payload.rideId,
      );
      socket.emit(ackEvent.event, ackEvent.data);
    } catch (error: any) {
      this.logger.error(`Ride status update error:`, error.message);
      socket.emit('error', {
        code: 'RIDE_STATUS_UPDATE_FAILED',
        message: 'Failed to update ride status',
      });
    }
  }

  /**
   * Handle emergency service availability updates
   */
  @SubscribeMessage('subscribe_emergency_updates')
  async handleSubscribeEmergencyUpdates(
    socket: CustomSocket,
    payload: { location: { latitude: number; longitude: number }; radius?: number },
  ) {
    try {
      if (!socket.isAuthenticated || !socket.user) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const { location, radius = 10 } = payload;

      // Validate location data
      if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        socket.emit('error', {
          code: 'INVALID_LOCATION',
          message: 'Valid location coordinates required',
        });
        return;
      }

      // Join user to emergency updates room for their area
      const emergencyRoom = `emergency_updates_${Math.floor(location.latitude * 100)}_${Math.floor(location.longitude * 100)}`;
      await socket.join(emergencyRoom);

      this.logger.debug(`User ${socket.userId} subscribed to emergency updates for area: ${emergencyRoom}`);

      // Send acknowledgment
      socket.emit('emergency_subscription_confirmed', {
        location,
        radius,
        room: emergencyRoom,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Emergency subscription error:`, error.message);
      socket.emit('error', {
        code: 'EMERGENCY_SUBSCRIPTION_FAILED',
        message: 'Failed to subscribe to emergency updates',
      });
    }
  }

  /**
   * Handle impact calculation completion notifications
   */
  @SubscribeMessage('subscribe_impact_updates')
  async handleSubscribeImpactUpdates(
    socket: CustomSocket,
    payload: { userId?: string },
  ) {
    try {
      if (!socket.isAuthenticated || !socket.user) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const targetUserId = payload.userId || socket.userId;

      // Users can only subscribe to their own impact updates
      if (targetUserId !== socket.userId) {
        socket.emit('error', {
          code: 'FORBIDDEN',
          message: 'Can only subscribe to your own impact updates',
        });
        return;
      }

      // Join user to their impact updates room
      const impactRoom = `impact_updates_${targetUserId}`;
      await socket.join(impactRoom);

      this.logger.debug(`User ${socket.userId} subscribed to impact updates`);

      // Send acknowledgment
      socket.emit('impact_subscription_confirmed', {
        userId: targetUserId,
        room: impactRoom,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Impact subscription error:`, error.message);
      socket.emit('error', {
        code: 'IMPACT_SUBSCRIPTION_FAILED',
        message: 'Failed to subscribe to impact updates',
      });
    }
  }

  /**
   * Handle rewards updates subscription
   */
  @SubscribeMessage('subscribe_rewards_updates')
  async handleSubscribeRewardsUpdates(
    socket: CustomSocket,
    payload: { userId?: string },
  ) {
    try {
      if (!socket.isAuthenticated || !socket.user) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const targetUserId = payload.userId || socket.userId;

      // Users can only subscribe to their own rewards updates
      if (targetUserId !== socket.userId) {
        socket.emit('error', {
          code: 'FORBIDDEN',
          message: 'Can only subscribe to your own rewards updates',
        });
        return;
      }

      // Join user to their rewards updates room
      const rewardsRoom = `rewards_updates_${targetUserId}`;
      await socket.join(rewardsRoom);

      this.logger.debug(`User ${socket.userId} subscribed to rewards updates`);

      // Send acknowledgment
      socket.emit('rewards_subscription_confirmed', {
        userId: targetUserId,
        room: rewardsRoom,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Rewards subscription error:`, error.message);
      socket.emit('error', {
        code: 'REWARDS_SUBSCRIPTION_FAILED',
        message: 'Failed to subscribe to rewards updates',
      });
    }
  }

  /**
   * Broadcast emergency service availability update to subscribed users
   */
  async broadcastEmergencyServiceUpdate(
    location: { latitude: number; longitude: number },
    serviceData: {
      serviceId: string;
      serviceType: 'hospital' | 'ambulance' | 'blood_bank';
      status: 'available' | 'busy' | 'offline';
      availability?: any;
    },
  ): Promise<void> {
    try {
      const emergencyRoom = `emergency_updates_${Math.floor(location.latitude * 100)}_${Math.floor(location.longitude * 100)}`;
      
      const updateEvent = this.eventCompatibility.formatEmergencyServiceStatusEvent(
        serviceData.serviceId,
        serviceData.status,
        { lat: location.latitude, long: location.longitude },
        serviceData.availability?.estimatedWaitTime,
      );

      this.server.to(emergencyRoom).emit(updateEvent.event, updateEvent.data);

      this.logger.debug(`Broadcasted emergency service update to room: ${emergencyRoom}`);
    } catch (error: any) {
      this.logger.error(`Error broadcasting emergency service update:`, error.message);
    }
  }

  /**
   * Broadcast impact calculation completion to user
   */
  async broadcastImpactUpdate(
    userId: string,
    impactData: {
      assistId: string;
      metrics: {
        timeSaved: number;
        livesAffected: number;
        responseTimeImprovement: number;
        communityContribution: number;
      };
    },
  ): Promise<void> {
    try {
      const impactRoom = `impact_updates_${userId}`;
      
      const updateEvent = {
        event: 'impact_calculation_complete',
        data: {
          assistId: impactData.assistId,
          metrics: impactData.metrics,
          timestamp: new Date().toISOString(),
        },
      };

      this.server.to(impactRoom).emit(updateEvent.event, updateEvent.data);

      this.logger.debug(`Broadcasted impact update to user: ${userId}`);
    } catch (error: any) {
      this.logger.error(`Error broadcasting impact update:`, error.message);
    }
  }

  /**
   * Broadcast rewards update to user
   */
  async broadcastRewardsUpdate(
    userId: string,
    rewardsData: {
      action: string;
      points: number;
      type: 'ride_completion' | 'emergency_assist' | 'achievement';
      description?: string;
    },
  ): Promise<void> {
    try {
      const rewardsRoom = `rewards_updates_${userId}`;
      
      const updateEvent = {
        event: 'rewards_update',
        data: {
          action: rewardsData.action,
          points: rewardsData.points,
          type: rewardsData.type,
          description: rewardsData.description,
          timestamp: new Date().toISOString(),
        },
      };

      this.server.to(rewardsRoom).emit(updateEvent.event, updateEvent.data);

      this.logger.debug(`Broadcasted rewards update to user: ${userId}`);
    } catch (error: any) {
      this.logger.error(`Error broadcasting rewards update:`, error.message);
    }
  }
}
