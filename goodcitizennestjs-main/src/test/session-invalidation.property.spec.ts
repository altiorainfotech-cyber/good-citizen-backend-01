/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/require-await */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import * as fc from 'fast-check';

import { AuthService } from '../authentication/auth.service';
import { SecurityAuditService } from '../authentication/security-audit.service';
import { Auth0Service } from '../authentication/auth0.service';
import { User } from '../user/entities/user.entity';
import { Session } from '../user/entities/session.entity';

describe('Session Invalidation Property Tests', () => {
  let authService: AuthService;
  let securityAuditService: SecurityAuditService;

  // Mock models
  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_ACCESS_SECRET':
          return 'test-access-secret';
        case 'JWT_REFRESH_SECRET':
          return 'test-refresh-secret';
        case 'JWT_ACCESS_EXPIRY':
          return '1d';
        case 'JWT_REFRESH_EXPIRY':
          return '7d';
        case 'ENCRYPTION_KEY':
          return 'test-encryption-key';
        default:
          return 'test-value';
      }
    }),
  };

  const mockAuth0Service = {
    handleAuth0Logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SecurityAuditService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Session.name),
          useValue: mockSessionModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Auth0Service,
          useValue: mockAuth0Service,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    securityAuditService =
      module.get<SecurityAuditService>(SecurityAuditService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  /**
   * Property 4: Session Invalidation
   * For any user session, after logout is called, subsequent API requests using
   * that session's access token should be rejected with unauthorized status.
   * Validates: Requirements 1.6
   */
  describe('Property 4: Session Invalidation', () => {
    it('should invalidate tokens after logout for all valid sessions', async () => {
      // Feature: ride-hailing-backend-integration, Property 4: Session Invalidation

      const sessionArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        user_id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        refresh_token: fc.string({ minLength: 20, maxLength: 100 }),
        role: fc.constantFrom('USER', 'DRIVER', 'ADMIN'),
        device_type: fc.constantFrom('WEB', 'IOS', 'ANDROID'),
        created_at: fc.date(),
        updated_at: fc.date(),
      });

      const userArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        first_name: fc.string({ minLength: 1, maxLength: 50 }),
        last_name: fc.string({ minLength: 1, maxLength: 50 }),
        email: fc.emailAddress(),
        role: fc.constantFrom('USER', 'DRIVER', 'ADMIN'),
        is_deleted: fc.constant(false),
      });

      const tokenArbitrary = fc.record({
        access_token: fc.string({ minLength: 50, maxLength: 200 }),
        refresh_token: fc.string({ minLength: 50, maxLength: 200 }),
      });

      const testScenarioArbitrary = fc.record({
        session: sessionArbitrary,
        user: userArbitrary,
        tokens: tokenArbitrary,
      });

      await fc.assert(
        fc.asyncProperty(testScenarioArbitrary, async (scenario) => {
          const { session, user, tokens } = scenario;

          // Ensure user and session IDs match
          const modifiedUser = { ...user, _id: session.user_id };
          const modifiedSession = {
            ...session,
            refresh_token: tokens.refresh_token,
          };

          // Mock session lookup for logout
          mockSessionModel.findById.mockResolvedValue(modifiedSession);

          // Mock user lookup
          mockUserModel.findById.mockResolvedValue(modifiedUser);

          // Mock session deletion
          mockSessionModel.findByIdAndDelete.mockResolvedValue(modifiedSession);

          // Mock user update
          mockUserModel.findByIdAndUpdate.mockResolvedValue(modifiedUser);

          // Step 1: Logout the session
          await authService.logout(session._id.toString());

          // Verify that the session was deleted
          expect(mockSessionModel.findByIdAndDelete).toHaveBeenCalledWith(
            session._id.toString(),
          );

          // Verify that user online status was updated
          expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
            modifiedUser._id,
            expect.objectContaining({
              is_online: false,
              socket_id: null,
            }),
          );

          // Step 2: Verify token is blacklisted
          const isBlacklisted = securityAuditService.isTokenBlacklisted(
            tokens.refresh_token,
          );
          expect(isBlacklisted).toBe(true);

          // Step 3: Try to validate the token after logout
          mockJwtService.verify.mockImplementation((token) => {
            if (token === tokens.access_token) {
              return {
                _id: modifiedUser._id,
                session_id: session._id,
                email: modifiedUser.email,
                role: modifiedUser.role,
              };
            }
            throw new Error('Invalid token');
          });

          // Mock session not found (because it was deleted)
          mockSessionModel.findById.mockResolvedValue(null);

          // Attempt to validate token should fail
          await expect(
            authService.validateToken(tokens.access_token),
          ).rejects.toThrow('Session not found');
        }),
        { numRuns: 20 },
      );
    });

    it('should invalidate all user tokens when logging out all sessions', async () => {
      // Feature: ride-hailing-backend-integration, Property 4: Session Invalidation

      const userArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        role: fc.constantFrom('USER', 'DRIVER', 'ADMIN'),
        is_deleted: fc.constant(false),
      });

      const sessionsArbitrary = fc.array(
        fc.record({
          _id: fc
            .hexaString({ minLength: 24, maxLength: 24 })
            .map((s) => new Types.ObjectId(s)),
          refresh_token: fc.string({ minLength: 50, maxLength: 200 }),
          device_type: fc.constantFrom('WEB', 'IOS', 'ANDROID'),
        }),
        { minLength: 1, maxLength: 5 },
      );

      const testScenarioArbitrary = fc.record({
        user: userArbitrary,
        sessions: sessionsArbitrary,
      });

      await fc.assert(
        fc.asyncProperty(testScenarioArbitrary, async (scenario) => {
          const { user, sessions } = scenario;

          // Add user_id to all sessions
          const userSessions = sessions.map((session) => ({
            ...session,
            user_id: user._id,
          }));

          // Mock session queries
          mockSessionModel.find.mockResolvedValue(userSessions);
          mockSessionModel.deleteMany.mockResolvedValue({
            deletedCount: userSessions.length,
          });

          // Mock user lookup and update
          mockUserModel.findById.mockResolvedValue(user);
          mockUserModel.findByIdAndUpdate.mockResolvedValue(user);

          // Execute logout all sessions
          await authService.logoutAllSessions(user._id.toString());

          // Verify all sessions were deleted
          expect(mockSessionModel.deleteMany).toHaveBeenCalledWith({
            user_id: user._id.toString(),
          });

          // Verify user status was updated
          expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
            user._id.toString(),
            expect.objectContaining({
              is_online: false,
              socket_id: null,
            }),
          );

          // Verify all refresh tokens are blacklisted
          for (const session of userSessions) {
            const isBlacklisted = securityAuditService.isTokenBlacklisted(
              session.refresh_token,
            );
            expect(isBlacklisted).toBe(true);
          }
        }),
        { numRuns: 20 },
      );
    });

    it('should handle token blacklisting correctly for all token types', async () => {
      // Feature: ride-hailing-backend-integration, Property 4: Session Invalidation

      const tokenDataArbitrary = fc.record({
        token: fc.string({ minLength: 50, maxLength: 200 }),
        userId: fc.hexaString({ minLength: 24, maxLength: 24 }),
        sessionId: fc.hexaString({ minLength: 24, maxLength: 24 }),
        reason: fc.constantFrom(
          'logout',
          'security_breach',
          'user_requested',
          'expired',
        ),
      });

      await fc.assert(
        fc.asyncProperty(tokenDataArbitrary, async (tokenData) => {
          const { token, userId, sessionId, reason } = tokenData;

          // Initially token should not be blacklisted
          expect(securityAuditService.isTokenBlacklisted(token)).toBe(false);

          // Blacklist the token
          securityAuditService.blacklistToken(token, userId, sessionId, reason);

          // Token should now be blacklisted
          expect(securityAuditService.isTokenBlacklisted(token)).toBe(true);

          // Verify blacklisted tokens count increased
          const count = securityAuditService.getBlacklistedTokensCount();
          expect(count).toBeGreaterThan(0);

          // Different token should not be blacklisted
          const differentToken = token + '_different';
          expect(securityAuditService.isTokenBlacklisted(differentToken)).toBe(
            false,
          );
        }),
        { numRuns: 20 },
      );
    });

    it('should handle session cleanup on expired tokens', async () => {
      // Feature: ride-hailing-backend-integration, Property 4: Session Invalidation

      const expiredSessionArbitrary = fc.record({
        _id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        user_id: fc
          .hexaString({ minLength: 24, maxLength: 24 })
          .map((s) => new Types.ObjectId(s)),
        refresh_token: fc.string({ minLength: 50, maxLength: 200 }),
        updated_at: fc.date({
          min: new Date('2020-01-01'),
          max: new Date('2023-01-01'),
        }), // Old dates
      });

      await fc.assert(
        fc.asyncProperty(expiredSessionArbitrary, async (expiredSession) => {
          // Mock finding expired sessions
          mockSessionModel.find.mockResolvedValue([expiredSession]);
          mockSessionModel.deleteMany.mockResolvedValue({ deletedCount: 1 });

          // Execute cleanup
          await authService.cleanupExpiredSessions();

          // Verify expired sessions were found and deleted
          expect(mockSessionModel.find).toHaveBeenCalledWith({
            updated_at: { $lt: expect.any(Number) },
          });

          expect(mockSessionModel.deleteMany).toHaveBeenCalledWith({
            _id: { $in: [expiredSession._id] },
          });
        }),
        { numRuns: 20 },
      );
    });

    it('should maintain security audit trail for all session operations', async () => {
      // Feature: ride-hailing-backend-integration, Property 4: Session Invalidation

      const auditEventArbitrary = fc.record({
        userId: fc.hexaString({ minLength: 24, maxLength: 24 }),
        sessionId: fc.hexaString({ minLength: 24, maxLength: 24 }),
        eventType: fc.constantFrom(
          'login',
          'logout',
          'token_refresh',
          'invalid_token',
          'suspicious_activity',
        ),
        ipAddress: fc.ipV4(),
        userAgent: fc.string({ minLength: 10, maxLength: 100 }),
        details: fc.record({
          reason: fc.string({ minLength: 5, maxLength: 50 }),
          success: fc.boolean(),
        }),
      });

      await fc.assert(
        fc.asyncProperty(auditEventArbitrary, async (eventData) => {
          const {
            userId,
            sessionId,
            eventType,
            ipAddress,
            userAgent,
            details,
          } = eventData;

          // Spy on console.log to verify audit logging
          const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

          // Log security event
          securityAuditService.logSecurityEvent({
            userId: userId,
            sessionId: sessionId,
            eventType: eventType as any,
            ipAddress: ipAddress,
            userAgent: userAgent,
            details: details,
            timestamp: new Date(),
          });

          // Verify audit log was created
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Security Audit:'),
          );

          // Verify log contains expected data
          const logCall = consoleSpy.mock.calls.find((call) =>
            call[0].includes('Security Audit:'),
          );

          if (logCall) {
            const logData = JSON.parse(
              logCall[0].replace('Security Audit: ', ''),
            );
            expect(logData.userId).toBe(userId);
            expect(logData.sessionId).toBe(sessionId);
            expect(logData.eventType).toBe(eventType);
            expect(logData.ipAddress).toBe(ipAddress);
            expect(logData.userAgent).toBe(userAgent);
          }

          consoleSpy.mockRestore();
        }),
        { numRuns: 20 },
      );
    });
  });
});
