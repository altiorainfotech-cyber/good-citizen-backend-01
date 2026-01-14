/* eslint-disable @typescript-eslint/require-await */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as fc from 'fast-check';
import { RideStateMachineService } from './ride-state-machine.service';
import { Ride } from './entities/ride.entity';
import { RideStatus } from '../common/utils';
import { BadRequestException } from '@nestjs/common';

describe('RideStateMachineService', () => {
  let service: RideStateMachineService;

  const mockRideModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RideStateMachineService,
        {
          provide: getModelToken(Ride.name),
          useValue: mockRideModel,
        },
      ],
    }).compile();

    service = module.get<RideStateMachineService>(RideStateMachineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 7: Ride Status State Machine
   * Validates: Requirements 5.1, 5.7
   * Feature: ride-hailing-backend-integration, Property 7: Ride Status State Machine
   */
  describe('Property 7: Ride Status State Machine', () => {
    it('should only allow valid status transitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate all possible status combinations
          fc.constantFrom(
            RideStatus.REQUESTED,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
            RideStatus.COMPLETED,
            RideStatus.CANCELLED,
          ),
          fc.constantFrom(
            RideStatus.REQUESTED,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
            RideStatus.COMPLETED,
            RideStatus.CANCELLED,
          ),
          async (fromStatus, toStatus) => {
            // Define the valid transitions according to the state machine
            const validTransitions: Record<RideStatus, RideStatus[]> = {
              [RideStatus.REQUESTED]: [
                RideStatus.DRIVER_ASSIGNED,
                RideStatus.CANCELLED,
              ],
              [RideStatus.DRIVER_ASSIGNED]: [
                RideStatus.DRIVER_ARRIVING,
                RideStatus.CANCELLED,
              ],
              [RideStatus.DRIVER_ARRIVING]: [
                RideStatus.DRIVER_ARRIVED,
                RideStatus.CANCELLED,
              ],
              [RideStatus.DRIVER_ARRIVED]: [
                RideStatus.IN_PROGRESS,
                RideStatus.CANCELLED,
              ],
              [RideStatus.IN_PROGRESS]: [
                RideStatus.COMPLETED,
                RideStatus.CANCELLED,
              ],
              [RideStatus.COMPLETED]: [], // Terminal state
              [RideStatus.CANCELLED]: [], // Terminal state
            };

            const isValidTransition =
              validTransitions[fromStatus]?.includes(toStatus) || false;
            const serviceResult = service.isValidTransition(
              fromStatus,
              toStatus,
            );

            // The service should match our expected valid transitions
            expect(serviceResult).toBe(isValidTransition);

            // If it's the same status, it should not be a valid transition
            if (fromStatus === toStatus) {
              expect(serviceResult).toBe(false);
            }

            // Terminal states should not allow any transitions
            if (
              fromStatus === RideStatus.COMPLETED ||
              fromStatus === RideStatus.CANCELLED
            ) {
              expect(serviceResult).toBe(false);
            }

            // All statuses should be able to transition to CANCELLED (except terminal states)
            if (
              toStatus === RideStatus.CANCELLED &&
              fromStatus !== RideStatus.COMPLETED &&
              fromStatus !== RideStatus.CANCELLED
            ) {
              expect(serviceResult).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should enforce sequential status progression', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 24, maxLength: 24 })
            .map((s) => s.replace(/[^0-9a-f]/g, '0')),
          async () => {
            // Test the normal flow: REQUESTED -> DRIVER_ASSIGNED -> DRIVER_ARRIVING -> DRIVER_ARRIVED -> IN_PROGRESS -> COMPLETED
            const normalFlow = [
              RideStatus.REQUESTED,
              RideStatus.DRIVER_ASSIGNED,
              RideStatus.DRIVER_ARRIVING,
              RideStatus.DRIVER_ARRIVED,
              RideStatus.IN_PROGRESS,
              RideStatus.COMPLETED,
            ];

            for (let i = 0; i < normalFlow.length - 1; i++) {
              const currentStatus = normalFlow[i]!;
              const nextStatus = normalFlow[i + 1]!;

              // This should be a valid transition
              expect(service.isValidTransition(currentStatus, nextStatus)).toBe(
                true,
              );

              // Skipping states should not be valid (except to CANCELLED)
              if (i < normalFlow.length - 2) {
                const skipStatus = normalFlow[i + 2]!;
                if (skipStatus !== RideStatus.CANCELLED) {
                  expect(
                    service.isValidTransition(currentStatus, skipStatus),
                  ).toBe(false);
                }
              }
            }

            // Any status (except terminal) should be able to go to CANCELLED
            for (const status of normalFlow.slice(0, -1)) {
              // Exclude COMPLETED
              expect(
                service.isValidTransition(status, RideStatus.CANCELLED),
              ).toBe(true);
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle terminal states correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(RideStatus.COMPLETED, RideStatus.CANCELLED),
          fc.constantFrom(
            RideStatus.REQUESTED,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
            RideStatus.COMPLETED,
            RideStatus.CANCELLED,
          ),
          async (terminalStatus, targetStatus) => {
            // Terminal states should not allow any transitions
            expect(
              service.isValidTransition(terminalStatus, targetStatus),
            ).toBe(false);

            // Terminal states should be identified as terminal
            expect(service.isTerminalStatus(terminalStatus)).toBe(true);

            // Terminal states should have no valid next states
            expect(service.getValidNextStates(terminalStatus)).toEqual([]);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should reject invalid transitions when attempting to transition ride status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 24, maxLength: 24 })
            .map((s) => s.replace(/[^0-9a-f]/g, '0')),
          fc.constantFrom(
            RideStatus.REQUESTED,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
            RideStatus.COMPLETED,
            RideStatus.CANCELLED,
          ),
          fc.constantFrom(
            RideStatus.REQUESTED,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
            RideStatus.COMPLETED,
            RideStatus.CANCELLED,
          ),
          async (rideId, currentStatus, targetStatus) => {
            // Mock ride with current status
            const mockRide = {
              _id: new Types.ObjectId(rideId),
              status: currentStatus,
            };

            mockRideModel.findById.mockResolvedValue(mockRide);

            const isValidTransition = service.isValidTransition(
              currentStatus,
              targetStatus,
            );

            if (isValidTransition) {
              // Valid transitions should succeed
              mockRideModel.findByIdAndUpdate.mockResolvedValue({
                ...mockRide,
                status: targetStatus,
              });

              const result = await service.transitionRideStatus(
                rideId,
                targetStatus,
              );
              expect(result.fromStatus).toBe(currentStatus);
              expect(result.toStatus).toBe(targetStatus);
              expect(result.rideId).toBe(rideId);
            } else {
              // Invalid transitions should throw BadRequestException
              await expect(
                service.transitionRideStatus(rideId, targetStatus),
              ).rejects.toThrow(BadRequestException);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain state machine invariants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            RideStatus.REQUESTED,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVING,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
          ),
          async (status) => {
            // Non-terminal states should have at least one valid next state
            const validNextStates = service.getValidNextStates(status);
            expect(validNextStates.length).toBeGreaterThan(0);

            // All non-terminal states should be able to transition to CANCELLED
            expect(validNextStates).toContain(RideStatus.CANCELLED);

            // Status should not be terminal
            expect(service.isTerminalStatus(status)).toBe(false);

            // Should have a human-readable description
            const description = service.getStatusDescription(status);
            expect(typeof description).toBe('string');
            expect(description.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
