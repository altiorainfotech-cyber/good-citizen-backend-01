/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/require-await */

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ride, RideDocument } from './entities/ride.entity';
import { RideStatus } from '../common/utils';

export interface StatusTransitionEvent {
  rideId: string;
  fromStatus: RideStatus;
  toStatus: RideStatus;
  driverId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: any;
}

@Injectable()
export class RideStateMachineService {
  constructor(@InjectModel(Ride.name) private rideModel: Model<RideDocument>) {}

  /**
   * Valid status transitions according to the state machine
   */
  private readonly validTransitions: Record<RideStatus, RideStatus[]> = {
    [RideStatus.REQUESTED]: [RideStatus.DRIVER_ASSIGNED, RideStatus.CANCELLED],
    [RideStatus.DRIVER_ASSIGNED]: [
      RideStatus.DRIVER_ARRIVING,
      RideStatus.CANCELLED,
    ],
    [RideStatus.DRIVER_ARRIVING]: [
      RideStatus.DRIVER_ARRIVED,
      RideStatus.CANCELLED,
    ],
    [RideStatus.DRIVER_ARRIVED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
    [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
    [RideStatus.COMPLETED]: [], // Terminal state
    [RideStatus.CANCELLED]: [], // Terminal state
  };

  /**
   * Validate if a status transition is allowed
   */
  isValidTransition(currentStatus: RideStatus, newStatus: RideStatus): boolean {
    return this.validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Get all possible next states for a given status
   */
  getValidNextStates(currentStatus: RideStatus): RideStatus[] {
    return this.validTransitions[currentStatus] || [];
  }

  /**
   * Check if a status is terminal (no further transitions allowed)
   */
  isTerminalStatus(status: RideStatus): boolean {
    return this.validTransitions[status]?.length === 0;
  }

  /**
   * Transition ride to new status with validation and side effects
   */
  async transitionRideStatus(
    rideId: string,
    newStatus: RideStatus,
    options: {
      driverId?: string;
      userId?: string;
      metadata?: any;
    } = {},
  ): Promise<StatusTransitionEvent> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new BadRequestException('Ride not found');
    }

    const currentStatus = ride.status;

    // Validate transition
    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      updated_at: new Date(),
    };

    // Set appropriate timestamps and fields based on new status
    switch (newStatus) {
      case RideStatus.DRIVER_ASSIGNED:
        updateData.driver_assigned_at = new Date();
        if (options.driverId) {
          updateData.driver_id = new Types.ObjectId(options.driverId);
        }
        break;
      case RideStatus.DRIVER_ARRIVING:
        // Driver is on the way
        break;
      case RideStatus.DRIVER_ARRIVED:
        updateData.driver_arrived_at = new Date();
        break;
      case RideStatus.IN_PROGRESS:
        updateData.ride_started_at = new Date();
        break;
      case RideStatus.COMPLETED:
        updateData.ride_completed_at = new Date();
        break;
      case RideStatus.CANCELLED:
        updateData.cancelled_at = new Date();
        break;
    }

    // Update the ride
    await this.rideModel.findByIdAndUpdate(rideId, updateData);

    // Create transition event
    const transitionEvent: StatusTransitionEvent = {
      rideId,
      fromStatus: currentStatus,
      toStatus: newStatus,
      timestamp: new Date(),
      ...(options.driverId && { driverId: options.driverId }),
      ...(options.userId && { userId: options.userId }),
      ...(options.metadata && { metadata: options.metadata }),
    };

    // Handle side effects
    await this.handleStatusTransitionSideEffects(transitionEvent);

    return transitionEvent;
  }

  /**
   * Handle side effects of status transitions
   */
  private async handleStatusTransitionSideEffects(
    event: StatusTransitionEvent,
  ): Promise<void> {
    switch (event.toStatus) {
      case RideStatus.DRIVER_ASSIGNED:
        await this.handleDriverAssigned(event);
        break;
      case RideStatus.DRIVER_ARRIVED:
        await this.handleDriverArrived(event);
        break;
      case RideStatus.IN_PROGRESS:
        await this.handleRideStarted(event);
        break;
      case RideStatus.COMPLETED:
        await this.handleRideCompleted(event);
        break;
      case RideStatus.CANCELLED:
        await this.handleRideCancelled(event);
        break;
    }
  }

  /**
   * Handle driver assignment side effects
   */
  private async handleDriverAssigned(
    event: StatusTransitionEvent,
  ): Promise<void> {
    // TODO: Send notification to user about driver assignment
    // TODO: Send notification to driver about ride assignment
    // TODO: Update driver availability status
// console.log removed
  }

  /**
   * Handle driver arrival side effects
   */
  private async handleDriverArrived(
    event: StatusTransitionEvent,
  ): Promise<void> {
    // TODO: Send notification to user that driver has arrived
    // TODO: Enable ride start functionality
// console.log removed
  }

  /**
   * Handle ride start side effects
   */
  private async handleRideStarted(event: StatusTransitionEvent): Promise<void> {
    // TODO: Start tracking ride progress
    // TODO: Send notifications about ride start
// console.log removed
  }

  /**
   * Handle ride completion side effects
   */
  private async handleRideCompleted(
    event: StatusTransitionEvent,
  ): Promise<void> {
    // TODO: Calculate final fare
    // TODO: Process payment
    // TODO: Send completion notifications
    // TODO: Update driver availability
    // TODO: Request rating from user
// console.log removed
  }

  /**
   * Handle ride cancellation side effects
   */
  private async handleRideCancelled(
    event: StatusTransitionEvent,
  ): Promise<void> {
    // TODO: Handle cancellation fees if applicable
    // TODO: Make driver available again
    // TODO: Send cancellation notifications
    // TODO: Update ride statistics
// console.log removed
  }

  /**
   * Get ride status history (for audit trail)
   */
  async getRideStatusHistory(rideId: string): Promise<any[]> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new BadRequestException('Ride not found');
    }

    // Build status history from timestamps
    const history: any[] = [];

    if (ride.requested_at) {
      history.push({
        status: RideStatus.REQUESTED,
        timestamp: ride.requested_at,
      });
    }

    if (ride.driver_assigned_at) {
      history.push({
        status: RideStatus.DRIVER_ASSIGNED,
        timestamp: ride.driver_assigned_at,
      });
    }

    if (ride.driver_arrived_at) {
      history.push({
        status: RideStatus.DRIVER_ARRIVED,
        timestamp: ride.driver_arrived_at,
      });
    }

    if (ride.ride_started_at) {
      history.push({
        status: RideStatus.IN_PROGRESS,
        timestamp: ride.ride_started_at,
      });
    }

    if (ride.ride_completed_at) {
      history.push({
        status: RideStatus.COMPLETED,
        timestamp: ride.ride_completed_at,
      });
    }

    if (ride.cancelled_at) {
      history.push({
        status: RideStatus.CANCELLED,
        timestamp: ride.cancelled_at,
      });
    }

    return history.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  /**
   * Validate ride can be cancelled
   */
  canCancelRide(currentStatus: RideStatus): boolean {
    return this.isValidTransition(currentStatus, RideStatus.CANCELLED);
  }

  /**
   * Get human-readable status description
   */
  getStatusDescription(status: RideStatus): string {
    const descriptions: Record<RideStatus, string> = {
      [RideStatus.REQUESTED]: 'Looking for a driver',
      [RideStatus.DRIVER_ASSIGNED]: 'Driver assigned',
      [RideStatus.DRIVER_ARRIVING]: 'Driver is on the way',
      [RideStatus.DRIVER_ARRIVED]: 'Driver has arrived',
      [RideStatus.IN_PROGRESS]: 'Ride in progress',
      [RideStatus.COMPLETED]: 'Ride completed',
      [RideStatus.CANCELLED]: 'Ride cancelled',
    };

    return descriptions[status] || 'Unknown status';
  }

  /**
   * Get estimated time for status transition (in minutes)
   */
  getEstimatedTransitionTime(
    fromStatus: RideStatus,
    toStatus: RideStatus,
  ): number | null {
    const estimatedTimes: Record<string, number> = {
      [`${RideStatus.REQUESTED}-${RideStatus.DRIVER_ASSIGNED}`]: 3, // 3 minutes to find driver
      [`${RideStatus.DRIVER_ASSIGNED}-${RideStatus.DRIVER_ARRIVING}`]: 1, // 1 minute to start driving
      [`${RideStatus.DRIVER_ARRIVING}-${RideStatus.DRIVER_ARRIVED}`]: 10, // 10 minutes average arrival
      [`${RideStatus.DRIVER_ARRIVED}-${RideStatus.IN_PROGRESS}`]: 2, // 2 minutes to start ride
    };

    const key = `${fromStatus}-${toStatus}`;
    return estimatedTimes[key] || null;
  }
}
