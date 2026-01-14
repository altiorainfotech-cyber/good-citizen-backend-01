/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

export interface EmergencyWebSocketUpdate {
  type:
    | 'emergency_request_created'
    | 'emergency_status_update'
    | 'ambulance_availability_update'
    | 'emergency_assignment';
  data: any;
  targetUsers?: string[] | undefined; // Specific user IDs to notify
  targetRoles?: string[]; // Specific roles to notify (e.g., 'DRIVER', 'ADMIN')
  location?:
    | {
        latitude: number;
        longitude: number;
        radius?: number; // in kilometers
      }
    | undefined;
}

@Injectable()
export class EmergencyWebSocketService {
  private readonly logger = new Logger(EmergencyWebSocketService.name);
  private server: Server;

  /**
   * Set the WebSocket server instance
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Broadcast emergency update to relevant users
   */
  async broadcastEmergencyUpdate(
    update: EmergencyWebSocketUpdate,
  ): Promise<void> {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.logger.log(`Broadcasting emergency update: ${update.type}`);

      // Broadcast to specific users if specified
      if (update.targetUsers && update.targetUsers.length > 0) {
        for (const userId of update.targetUsers) {
          const userRoom = `user_${userId}`;
          this.server.to(userRoom).emit('emergency_update', {
            type: update.type,
            data: update.data,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Broadcast to specific roles if specified
      if (update.targetRoles && update.targetRoles.length > 0) {
        for (const role of update.targetRoles) {
          const roleRoom = `role_${role.toLowerCase()}`;
          this.server.to(roleRoom).emit('emergency_update', {
            type: update.type,
            data: update.data,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Broadcast to location-based users if location is specified
      if (update.location) {
        // This would require implementing location-based rooms
        // For now, we'll broadcast to all connected users
        this.server.emit('emergency_location_update', {
          type: update.type,
          data: update.data,
          location: update.location,
          timestamp: new Date().toISOString(),
        });
      }

      // If no specific targeting, broadcast to admin room
      if (!update.targetUsers && !update.targetRoles && !update.location) {
        this.server.to('admin_room').emit('emergency_update', {
          type: update.type,
          data: update.data,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to broadcast emergency update: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send emergency request creation update
   */
  async notifyEmergencyRequestCreated(emergencyRequest: any): Promise<void> {
    await this.broadcastEmergencyUpdate({
      type: 'emergency_request_created',
      data: {
        id: emergencyRequest.id,
        emergencyType: emergencyRequest.emergencyType,
        priority: emergencyRequest.priority,
        location: emergencyRequest.location,
        address: emergencyRequest.address,
        status: emergencyRequest.status,
        createdAt: emergencyRequest.createdAt,
      },
      targetUsers: [emergencyRequest.userId],
      targetRoles: ['ADMIN'],
      location: {
        latitude: emergencyRequest.location.latitude,
        longitude: emergencyRequest.location.longitude,
        radius: 20, // 20km radius for nearby drivers
      },
    });
  }

  /**
   * Send emergency status update
   */
  async notifyEmergencyStatusUpdate(
    emergencyRequestId: string,
    oldStatus: string,
    newStatus: string,
    data: any,
  ): Promise<void> {
    await this.broadcastEmergencyUpdate({
      type: 'emergency_status_update',
      data: {
        emergencyRequestId,
        oldStatus,
        newStatus,
        ...data,
      },
      targetUsers: data.userId ? [data.userId] : undefined,
      targetRoles: ['ADMIN'],
      location: undefined,
    });
  }

  /**
   * Send ambulance availability update
   */
  async notifyAmbulanceAvailabilityUpdate(
    providerId: string,
    availability: boolean,
    location?: { latitude: number; longitude: number },
  ): Promise<void> {
    await this.broadcastEmergencyUpdate({
      type: 'ambulance_availability_update',
      data: {
        providerId,
        availability,
        location,
        timestamp: new Date().toISOString(),
      },
      targetUsers: undefined,
      targetRoles: ['ADMIN'],
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            radius: 50, // 50km radius for ambulance updates
          }
        : undefined,
    });
  }

  /**
   * Send emergency assignment notification
   */
  async notifyEmergencyAssignment(
    emergencyRequestId: string,
    providerId: string,
    userId: string,
  ): Promise<void> {
    await this.broadcastEmergencyUpdate({
      type: 'emergency_assignment',
      data: {
        emergencyRequestId,
        providerId,
        assignedAt: new Date().toISOString(),
      },
      targetUsers: [userId, providerId],
      targetRoles: ['ADMIN'],
    });
  }

  /**
   * Send real-time location update for emergency responders
   */
  async sendEmergencyResponderLocation(
    emergencyRequestId: string,
    providerId: string,
    location: { latitude: number; longitude: number },
    userId: string,
  ): Promise<void> {
    if (!this.server) return;

    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('emergency_responder_location', {
      emergencyRequestId,
      providerId,
      location,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send emergency alert to nearby users
   */
  async sendEmergencyAlert(
    location: { latitude: number; longitude: number },
    emergencyType: string,
    message: string,
  ): Promise<void> {
    if (!this.server) return;

    // Broadcast emergency alert to all connected users
    // In a real implementation, this would be filtered by location
    this.server.emit('emergency_alert', {
      emergencyType,
      message,
      location,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Join user to emergency-related rooms based on their role and location
   */
  async joinEmergencyRooms(socket: any, user: any): Promise<void> {
    try {
      // Join role-based room
      if (user.role) {
        const roleRoom = `role_${user.role.toLowerCase()}`;
        await socket.join(roleRoom);
        this.logger.debug(`User ${user._id} joined role room: ${roleRoom}`);
      }

      // Join admin room if user is admin
      if (user.role === 'ADMIN') {
        await socket.join('admin_room');
        this.logger.debug(`Admin user ${user._id} joined admin room`);
      }

      // Join driver room if user is driver
      if (user.role === 'DRIVER') {
        await socket.join('driver_room');
        this.logger.debug(`Driver user ${user._id} joined driver room`);
      }

      // Join location-based rooms if user has location
      if (user.latitude && user.longitude) {
        // This would implement location-based room joining
        // For now, we'll just log it
        this.logger.debug(
          `User ${user._id} location: ${user.latitude}, ${user.longitude}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to join emergency rooms for user ${user._id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Leave emergency-related rooms
   */
  async leaveEmergencyRooms(socket: any, user: any): Promise<void> {
    try {
      if (user.role) {
        const roleRoom = `role_${user.role.toLowerCase()}`;
        socket.leave(roleRoom);
      }

      if (user.role === 'ADMIN') {
        socket.leave('admin_room');
      }

      if (user.role === 'DRIVER') {
        socket.leave('driver_room');
      }
    } catch (error) {
      this.logger.error(
        `Failed to leave emergency rooms for user ${user._id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
