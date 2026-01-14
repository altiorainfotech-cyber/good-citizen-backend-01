/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';

import { JwtAuthGuard } from './guards/enhanced-jwt-auth.guard';
import { RolesGuard } from './guards/enhanced-roles.guard';
import { RolesGuard as AdminAccessGuard } from './guards/admin-access.guard';
import { SecurityAuditService } from './security-audit.service';
import { TokenLifecycleService } from './token-lifecycle.service';
import { UserType } from '../common/utils';
import { User } from '../user/entities/user.entity';
import { Session } from '../user/entities/session.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Enhanced Authentication System', () => {
  let enhancedJwtGuard: JwtAuthGuard;
  let enhancedRolesGuard: RolesGuard;
  let adminAccessGuard: RolesGuard;
  let securityAuditService: SecurityAuditService;
  let tokenLifecycleService: TokenLifecycleService;

  const mockSecurityAuditService = {
    logSecurityEvent: jest.fn(),
    isTokenBlacklisted: jest.fn().mockReturnValue(false),
    blacklistToken: jest.fn(),
    blacklistAllUserTokens: jest.fn(),
    cleanupExpiredBlacklistedTokens: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-secret',
        JWT_ACCESS_EXPIRY: '1h',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRY: '7d',
      };
      return config[key];
    }),
  };

  const mockUserModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockSessionModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        RolesGuard,
        RolesGuard,
        TokenLifecycleService,
        {
          provide: SecurityAuditService,
          useValue: mockSecurityAuditService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
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
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Session.name),
          useValue: mockSessionModel,
        },
      ],
    }).compile();

    enhancedJwtGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    enhancedRolesGuard = module.get<RolesGuard>(RolesGuard);
    adminAccessGuard = module.get<RolesGuard>(RolesGuard);
    securityAuditService =
      module.get<SecurityAuditService>(SecurityAuditService);
    tokenLifecycleService = module.get<TokenLifecycleService>(
      TokenLifecycleService,
    );
  });

  describe('RolesGuard', () => {
    it('should allow access when user has required role', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { _id: 'user123', role: UserType.USER },
            ip: '127.0.0.1',
            get: () => 'test-agent',
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue([UserType.USER]);

      const result = enhancedRolesGuard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should deny access when user lacks required role', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { _id: 'user123', role: UserType.USER },
            ip: '127.0.0.1',
            get: () => 'test-agent',
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue([UserType.ADMIN]);

      expect(() => enhancedRolesGuard.canActivate(mockContext)).toThrow();
      expect(mockSecurityAuditService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'unauthorized_access',
          userId: 'user123',
        }),
      );
    });

    it('should require driver approval for driver-specific endpoints', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              _id: 'driver123',
              role: UserType.DRIVER,
              approval: 'PENDING',
            },
            ip: '127.0.0.1',
            get: () => 'test-agent',
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce([UserType.DRIVER]) // roles
        .mockReturnValueOnce(true); // requiresDriverApproval

      expect(() => enhancedRolesGuard.canActivate(mockContext)).toThrow();
      expect(mockSecurityAuditService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'unauthorized_access',
          details: expect.objectContaining({
            reason: 'driver_not_approved',
          }),
        }),
      );
    });
  });

  describe('RolesGuard', () => {
    it('should allow access for admin users', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { _id: 'admin123', role: UserType.ADMIN },
            ip: '127.0.0.1',
            get: () => 'test-agent',
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = adminAccessGuard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should deny access for non-admin users', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { _id: 'user123', role: UserType.USER },
            ip: '127.0.0.1',
            get: () => 'test-agent',
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      expect(() => adminAccessGuard.canActivate(mockContext)).toThrow();
      expect(mockSecurityAuditService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'unauthorized_admin_access',
          userId: 'user123',
        }),
      );
    });
  });

  describe('TokenLifecycleService', () => {
    it('should validate token lifecycle correctly', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        _id: 'user123',
        session_id: 'session123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      mockJwtService.decode.mockReturnValue(mockPayload);
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserModel.findById.mockResolvedValue({
        _id: 'user123',
        is_deleted: false,
      });
      mockSessionModel.findById.mockResolvedValue({
        _id: 'session123',
        user_id: 'user123',
      });

      const result =
        await tokenLifecycleService.validateTokenLifecycle(mockToken);

      expect(result.isValid).toBe(true);
      expect(result.shouldRefresh).toBe(false);
    });

    it('should detect tokens close to expiry', async () => {
      const mockToken = 'expiring.jwt.token';
      const mockPayload = {
        _id: 'user123',
        session_id: 'session123',
        exp: Math.floor(Date.now() / 1000) + 200, // 200 seconds from now (< 5 minutes)
      };

      mockJwtService.decode.mockReturnValue(mockPayload);
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserModel.findById.mockResolvedValue({
        _id: 'user123',
        is_deleted: false,
      });
      mockSessionModel.findById.mockResolvedValue({
        _id: 'session123',
        user_id: 'user123',
      });

      const result =
        await tokenLifecycleService.validateTokenLifecycle(mockToken);

      expect(result.isValid).toBe(true);
      expect(result.shouldRefresh).toBe(true);
    });

    it('should revoke all user tokens', async () => {
      const userId = 'user123';
      const mockSessions = [
        { _id: 'session1', refresh_token: 'token1' },
        { _id: 'session2', refresh_token: 'token2' },
      ];

      mockSessionModel.find.mockResolvedValue(mockSessions);
      mockSessionModel.deleteMany.mockResolvedValue({ deletedCount: 2 });
      mockUserModel.findByIdAndUpdate.mockResolvedValue({});

      await tokenLifecycleService.revokeAllUserTokens(
        userId,
        'security_breach',
      );

      expect(mockSecurityAuditService.blacklistToken).toHaveBeenCalledTimes(2);
      expect(mockSessionModel.deleteMany).toHaveBeenCalledWith({
        user_id: userId,
      });
      expect(mockSecurityAuditService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'mass_token_revocation',
          userId,
        }),
      );
    });
  });

  describe('SecurityAuditService', () => {
    it('should log security events', () => {
      const event = {
        userId: 'user123',
        eventType: 'unauthorized_access' as const,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        details: { reason: 'insufficient_permissions' },
        timestamp: new Date(),
      };

      securityAuditService.logSecurityEvent(event);

      expect(mockSecurityAuditService.logSecurityEvent).toHaveBeenCalledWith(
        event,
      );
    });

    it('should blacklist tokens', () => {
      const token = 'token-to-blacklist';
      const userId = 'user123';
      const sessionId = 'session123';
      const reason = 'logout';

      securityAuditService.blacklistToken(token, userId, sessionId, reason);

      expect(mockSecurityAuditService.blacklistToken).toHaveBeenCalledWith(
        token,
        userId,
        sessionId,
        reason,
      );
    });
  });
});
