/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as fc from 'fast-check';

import { WebSocketService, AuthenticationResult } from './web-socket.service';
import { CommonService } from '../common/common.service';
import { NotificationService } from '../common/notification.service';
import { User } from '../user/entities/user.entity';
import { Session } from '../user/entities/session.entity';
import { UserType } from '../common/utils';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let commonService: CommonService;
  let userModel: any;
  let sessionModel: any;

  const mockUser = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    role: UserType.USER,
    is_deleted: false,
    is_online: false,
    socket_id: null,
    last_seen: new Date(),
  };

  const mockSession = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    user_id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    role: UserType.USER,
    socket_id: null,
    last_activity: new Date(),
    updated_at: Date.now(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
          },
        },
        {
          provide: getModelToken(Session.name),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            updateMany: jest.fn(),
            find: jest.fn(),
            deleteMany: jest.fn(),
            findByIdAndDelete: jest.fn(),
          },
        },
        {
          provide: CommonService,
          useValue: {
            decodeToken: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            send_notification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebSocketService>(WebSocketService);
    commonService = module.get<CommonService>(CommonService);
    userModel = module.get(getModelToken(User.name));
    sessionModel = module.get(getModelToken(Session.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Property 12: WebSocket Authentication
   * Validates: Requirements 8.1, 8.2, 8.3
   * Feature: ride-hailing-backend-integration, Property 12: WebSocket Authentication
   */
  describe('Property 12: WebSocket Authentication', () => {
    it('should reject connections with invalid or expired JWT tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null), // No token
            fc.constant(''), // Empty token
            fc.constant('   '), // Whitespace token
            fc.string({ minLength: 1, maxLength: 10 }), // Invalid short token
            fc.string().filter((s) => !s.includes('.')), // Token without JWT structure
            fc.constant('Bearer '), // Bearer with no token
            fc.constant('invalid.jwt.token'), // Malformed JWT
          ),
          async (invalidToken) => {
            // Mock token decode to throw error for invalid tokens
            jest
              .spyOn(commonService, 'decodeToken')
              .mockRejectedValue(new Error('Invalid or expired token'));

            const result = await service.authenticateConnection(
              invalidToken || '',
              'socket123',
            );

            // Verify authentication fails for invalid tokens
            expect(result.success).toBe(false);
            expect(result.user).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should successfully authenticate connections with valid JWT tokens and active sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid JWT-like tokens and socket IDs
          fc.record({
            token: fc.string({ minLength: 20 }).map((s) => `valid.jwt.${s}`),
            socketId: fc.string({ minLength: 5, maxLength: 20 }),
            userId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            sessionId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
          }),
          async ({ token, socketId, userId, sessionId }) => {
            // Mock successful token decode
            const mockDecoded = {
              _id: userId,
              session_id: sessionId,
              email: 'test@example.com',
              role: UserType.USER,
            };
            jest
              .spyOn(commonService, 'decodeToken')
              .mockResolvedValue(mockDecoded);

            // Mock active session
            const mockActiveSession = {
              ...mockSession,
              _id: new Types.ObjectId(sessionId),
              user_id: new Types.ObjectId(userId),
              updated_at: Date.now(), // Recent activity
            };
            sessionModel.findById.mockResolvedValue(mockActiveSession);

            // Mock user exists and is active
            const mockActiveUser = {
              ...mockUser,
              _id: new Types.ObjectId(userId),
              is_deleted: false,
            };
            userModel.findById.mockResolvedValue(mockActiveUser);

            // Mock session update
            sessionModel.findByIdAndUpdate.mockResolvedValue(mockActiveSession);

            const result = await service.authenticateConnection(
              token,
              socketId,
            );

            // Verify successful authentication
            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            if (result.user) {
              expect(result.user._id.toString()).toBe(userId);
            }
            expect(result.sessionId).toBe(sessionId);
            expect(result.error).toBeUndefined();

            // Verify session was updated with socket info
            expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
              new Types.ObjectId(sessionId),
              expect.objectContaining({
                socket_id: socketId,
                last_activity: expect.any(Date),
                updated_at: expect.any(Number),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject connections when session does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            token: fc.string({ minLength: 20 }).map((s) => `valid.jwt.${s}`),
            socketId: fc.string({ minLength: 5, maxLength: 20 }),
            userId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            sessionId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
          }),
          async ({ token, socketId, userId, sessionId }) => {
            // Mock successful token decode
            const mockDecoded = {
              _id: userId,
              session_id: sessionId,
              email: 'test@example.com',
              role: UserType.USER,
            };
            jest
              .spyOn(commonService, 'decodeToken')
              .mockResolvedValue(mockDecoded);

            // Mock session not found
            sessionModel.findById.mockResolvedValue(null);

            const result = await service.authenticateConnection(
              token,
              socketId,
            );

            // Verify authentication fails when session doesn't exist
            expect(result.success).toBe(false);
            expect(result.user).toBeUndefined();
            expect(result.error).toBe('Session not found or expired');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject connections when user is deleted or not found', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            token: fc.string({ minLength: 20 }).map((s) => `valid.jwt.${s}`),
            socketId: fc.string({ minLength: 5, maxLength: 20 }),
            userId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            sessionId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            userExists: fc.boolean(),
            userDeleted: fc.boolean(),
          }),
          async ({
            token,
            socketId,
            userId,
            sessionId,
            userExists,
            userDeleted,
          }) => {
            // Mock successful token decode
            const mockDecoded = {
              _id: userId,
              session_id: sessionId,
              email: 'test@example.com',
              role: UserType.USER,
            };
            jest
              .spyOn(commonService, 'decodeToken')
              .mockResolvedValue(mockDecoded);

            // Mock active session
            const mockActiveSession = {
              ...mockSession,
              _id: new Types.ObjectId(sessionId),
              user_id: new Types.ObjectId(userId),
              updated_at: Date.now(),
            };
            sessionModel.findById.mockResolvedValue(mockActiveSession);

            // Mock user state
            if (!userExists) {
              userModel.findById.mockResolvedValue(null);
            } else {
              const mockUserState = {
                ...mockUser,
                _id: new Types.ObjectId(userId),
                is_deleted: userDeleted,
              };
              userModel.findById.mockResolvedValue(mockUserState);
            }

            const result = await service.authenticateConnection(
              token,
              socketId,
            );

            // Verify authentication fails for deleted or non-existent users
            if (!userExists || userDeleted) {
              expect(result.success).toBe(false);
              expect(result.user).toBeUndefined();
              expect(result.error).toBe('User not found or deactivated');
            } else {
              expect(result.success).toBe(true);
              expect(result.user).toBeDefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject connections with expired sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            token: fc.string({ minLength: 20 }).map((s) => `valid.jwt.${s}`),
            socketId: fc.string({ minLength: 5, maxLength: 20 }),
            userId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            sessionId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            daysOld: fc.integer({ min: 8, max: 30 }), // Sessions older than 7 days
          }),
          async ({ token, socketId, userId, sessionId, daysOld }) => {
            // Mock successful token decode
            const mockDecoded = {
              _id: userId,
              session_id: sessionId,
              email: 'test@example.com',
              role: UserType.USER,
            };
            jest
              .spyOn(commonService, 'decodeToken')
              .mockResolvedValue(mockDecoded);

            // Mock expired session (older than 7 days)
            const expiredDate = new Date(
              Date.now() - daysOld * 24 * 60 * 60 * 1000,
            );
            const mockExpiredSession = {
              ...mockSession,
              _id: new Types.ObjectId(sessionId),
              user_id: new Types.ObjectId(userId),
              updated_at: expiredDate.getTime(),
            };
            sessionModel.findById.mockResolvedValue(mockExpiredSession);

            // Mock session deletion
            sessionModel.findByIdAndDelete.mockResolvedValue(
              mockExpiredSession,
            );

            const result = await service.authenticateConnection(
              token,
              socketId,
            );

            // Verify authentication fails for expired sessions
            expect(result.success).toBe(false);
            expect(result.user).toBeUndefined();
            expect(result.error).toBe('Session expired');

            // Verify expired session was cleaned up
            expect(sessionModel.findByIdAndDelete).toHaveBeenCalledWith(
              new Types.ObjectId(sessionId),
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle Bearer token format correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseToken: fc
              .string({ minLength: 20 })
              .map((s) => `valid.jwt.${s}`),
            socketId: fc.string({ minLength: 5, maxLength: 20 }),
            userId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            sessionId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            useBearer: fc.boolean(),
            extraSpaces: fc.integer({ min: 0, max: 5 }),
          }),
          async ({
            baseToken,
            socketId,
            userId,
            sessionId,
            useBearer,
            extraSpaces,
          }) => {
            // Create token with or without Bearer prefix and extra spaces
            const spaces = ' '.repeat(extraSpaces);
            const token = useBearer
              ? `Bearer ${spaces}${baseToken}`
              : baseToken;

            // Calculate expected clean token
            const expectedCleanToken = useBearer
              ? baseToken.trim()
              : baseToken.trim();

            // Reset mocks for this specific test
            jest.clearAllMocks();

            // Mock successful token decode for the clean token
            const mockDecoded = {
              _id: userId,
              session_id: sessionId,
              email: 'test@example.com',
              role: UserType.USER,
            };
            jest
              .spyOn(commonService, 'decodeToken')
              .mockResolvedValue(mockDecoded);

            // Mock active session and user
            const mockActiveSession = {
              ...mockSession,
              _id: new Types.ObjectId(sessionId),
              user_id: new Types.ObjectId(userId),
              updated_at: Date.now(),
            };
            sessionModel.findById.mockResolvedValue(mockActiveSession);

            const mockActiveUser = {
              ...mockUser,
              _id: new Types.ObjectId(userId),
              is_deleted: false,
            };
            userModel.findById.mockResolvedValue(mockActiveUser);
            sessionModel.findByIdAndUpdate.mockResolvedValue(mockActiveSession);

            const result = await service.authenticateConnection(
              token,
              socketId,
            );

            // Verify authentication succeeds regardless of Bearer prefix and spaces
            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.sessionId).toBe(sessionId);

            // Verify the clean token (without Bearer prefix and trimmed) was used for decoding
            expect(commonService.decodeToken).toHaveBeenLastCalledWith(
              expectedCleanToken,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain consistent authentication state across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            token: fc.string({ minLength: 20 }).map((s) => `valid.jwt.${s}`),
            socketIds: fc.array(fc.string({ minLength: 5, maxLength: 20 }), {
              minLength: 2,
              maxLength: 5,
            }),
            userId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
            sessionId: fc.constantFrom(
              ...Array.from({ length: 10 }, () =>
                new Types.ObjectId().toString(),
              ),
            ),
          }),
          async ({ token, socketIds, userId, sessionId }) => {
            // Reset mocks for this specific test
            jest.clearAllMocks();

            // Mock successful token decode
            const mockDecoded = {
              _id: userId,
              session_id: sessionId,
              email: 'test@example.com',
              role: UserType.USER,
            };
            jest
              .spyOn(commonService, 'decodeToken')
              .mockResolvedValue(mockDecoded);

            // Mock active session and user
            const mockActiveSession = {
              ...mockSession,
              _id: new Types.ObjectId(sessionId),
              user_id: new Types.ObjectId(userId),
              updated_at: Date.now(),
            };
            sessionModel.findById.mockResolvedValue(mockActiveSession);

            const mockActiveUser = {
              ...mockUser,
              _id: new Types.ObjectId(userId),
              is_deleted: false,
            };
            userModel.findById.mockResolvedValue(mockActiveUser);
            sessionModel.findByIdAndUpdate.mockResolvedValue(mockActiveSession);

            // Test multiple authentication calls with different socket IDs
            const results: AuthenticationResult[] = [];
            for (const socketId of socketIds) {
              const result = await service.authenticateConnection(
                token,
                socketId,
              );
              results.push(result);
            }

            // Verify all authentication attempts succeed consistently
            for (const result of results) {
              expect(result.success).toBe(true);
              expect(result.user).toBeDefined();
              if (result.user) {
                expect(result.user._id.toString()).toBe(userId);
              }
              expect(result.sessionId).toBe(sessionId);
              expect(result.error).toBeUndefined();
            }

            // Verify session was updated for each socket connection
            expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledTimes(
              socketIds.length,
            );
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
