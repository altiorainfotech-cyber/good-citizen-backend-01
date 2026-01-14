/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import moment from 'moment';

import { User, UserDocument } from '../user/entities/user.entity';
import { Session, SessionDocument } from '../user/entities/session.entity';
import { Auth0Service, Auth0UserProfile } from './auth0.service';
import { Auth0AuthDto, DriverSignupDto, DriverLoginDto } from './dto/auth.dto';
import { UserType, Device_TYPE } from '../common/utils';
import { SecurityAuditService } from './security-audit.service';

export interface AuthResponse {
  user: UserDto;
  access_token: string;
  refresh_token: string;
  session_id: string;
  auth_provider?: 'auth0' | 'local';
}

export interface UserDto {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: string;
  loyalty_points: number;
  is_email_verified: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auth0Service: Auth0Service,
    private securityAuditService: SecurityAuditService,
  ) {}

  /**
   * Authenticate user with Auth0 (Google/Apple)
   */
  async authenticateWithAuth0(authDto: Auth0AuthDto): Promise<AuthResponse> {
    try {
      let auth0Profile: Auth0UserProfile;

      // Handle different Auth0 authentication flows
      if (authDto.idToken) {
        // Direct ID token validation (Apple Sign-In)
        auth0Profile = await this.auth0Service.validateIdToken(authDto.idToken);
      } else if (authDto.authorizationCode) {
        // Authorization code flow
        const tokenResponse = await this.auth0Service.exchangeAuth0Token(
          authDto.authorizationCode,
          authDto.provider,
        );
        auth0Profile = await this.auth0Service.validateIdToken(
          tokenResponse.id_token,
        );
      } else {
        throw new BadRequestException(
          'Either idToken or authorizationCode is required',
        );
      }

      // Sync user profile with internal database
      const user = await this.syncUserProfile(auth0Profile);

      // Create session and generate tokens
      const session = await this.createSession(
        user._id,
        UserType.USER,
        Device_TYPE.ANDROID,
      );
      const tokens = await this.generateTokens(user, session._id);

      // Update session with refresh token
      await this.sessionModel.findByIdAndUpdate(session._id, {
        refresh_token: tokens.refresh_token,
      });

      return {
        user: this.formatUserDto(user),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        session_id: session._id.toString(),
        auth_provider: 'auth0',
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Auth0 authentication failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Register driver with email/password
   */
  async registerDriver(signupDto: DriverSignupDto): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: signupDto.email },
          {
            phone_number: signupDto.phone_number,
            country_code: signupDto.country_code,
          },
        ],
        is_deleted: false,
      });

      if (existingUser) {
        throw new ConflictException(
          'User already exists with this email or phone number',
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(signupDto.password, 12);

      // Create new driver user
      const newUser = new this.userModel({
        first_name: signupDto.first_name,
        last_name: signupDto.last_name,
        email: signupDto.email,
        phone_number: signupDto.phone_number,
        country_code: signupDto.country_code,
        password: hashedPassword,
        role: UserType.DRIVER,
        approval: 'PENDING', // Drivers need approval
        vehicle_type: signupDto.vehicle_type,
        vehicle_plate: signupDto.license_plate,
        driver_rating: 0,
        total_rides: 0,
        total_earnings: 0,
        acceptance_rate: 0,
        loyalty_point: 0,
        is_email_verified: false,
        created_at: moment().utc().valueOf(),
        updated_at: moment().utc().valueOf(),
      });

      const savedUser = await newUser.save();

      // Create session
      const session = await this.createSession(
        savedUser._id,
        UserType.DRIVER,
        Device_TYPE.ANDROID,
      );
      const tokens = await this.generateTokens(savedUser, session._id);

      // Update session with refresh token
      await this.sessionModel.findByIdAndUpdate(session._id, {
        refresh_token: tokens.refresh_token,
      });

      return {
        user: this.formatUserDto(savedUser),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        session_id: session._id.toString(),
        auth_provider: 'local',
      };
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        `Driver registration failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Login driver with email/password
   */
  async loginDriver(loginDto: DriverLoginDto): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await this.userModel.findOne({
        email: loginDto.email,
        role: UserType.DRIVER,
        is_deleted: false,
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        loginDto.password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Create session
      const session = await this.createSession(
        user._id,
        UserType.DRIVER,
        Device_TYPE.ANDROID,
      );
      const tokens = await this.generateTokens(user, session._id);

      // Update session with refresh token
      await this.sessionModel.findByIdAndUpdate(session._id, {
        refresh_token: tokens.refresh_token,
      });

      return {
        user: this.formatUserDto(user),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        session_id: session._id.toString(),
        auth_provider: 'local',
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        `Driver login failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<User> {
    try {
      // Check if token is blacklisted
      if (this.securityAuditService.isTokenBlacklisted(token)) {
        this.securityAuditService.logSecurityEvent({
          userId: 'unknown',
          eventType: 'invalid_token',
          details: { reason: 'token_blacklisted' },
          timestamp: new Date(),
        });
        throw new UnauthorizedException('Token has been invalidated');
      }

      const payload = this.jwtService.verify(token, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'default-secret',
      });

      const user = await this.userModel.findById(
        payload._id,
        {},
        { lean: true },
      );
      if (!user || user.is_deleted) {
        this.securityAuditService.logSecurityEvent({
          userId: payload._id || 'unknown',
          sessionId: payload.session_id,
          eventType: 'invalid_token',
          details: { reason: 'user_not_found_or_deleted' },
          timestamp: new Date(),
        });
        throw new UnauthorizedException('User not found');
      }

      const session = await this.sessionModel.findById(
        payload.session_id,
        {},
        { lean: true },
      );
      if (!session) {
        this.securityAuditService.logSecurityEvent({
          userId: payload._id,
          sessionId: payload.session_id,
          eventType: 'invalid_token',
          details: { reason: 'session_not_found' },
          timestamp: new Date(),
        });
        throw new UnauthorizedException('Session not found');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.securityAuditService.logSecurityEvent({
        userId: 'unknown',
        eventType: 'invalid_token',
        details: {
          reason: 'token_validation_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      });
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Refresh access token with token rotation
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'default-refresh-secret',
      });

      const session = await this.sessionModel.findById(payload.session_id);
      if (!session || session.refresh_token !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.userModel.findById(session.user_id);
      if (!user || user.is_deleted) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens (token rotation)
      const tokens = await this.generateTokens(user, session._id);

      // Update session with new refresh token and timestamp
      await this.sessionModel.findByIdAndUpdate(session._id, {
        refresh_token: tokens.refresh_token,
        updated_at: moment().utc().valueOf(),
      });

      return tokens;
    } catch (error: any) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionModel.findById(sessionId);
      if (session) {
        // Blacklist the refresh token
        if (session.refresh_token) {
          this.securityAuditService.blacklistToken(
            session.refresh_token,
            session.user_id.toString(),
            sessionId,
            'user_logout',
          );
        }

        // For Auth0 users, also handle Auth0 logout
        const user = await this.userModel.findById(session.user_id);
        if (user && user.role === UserType.USER) {
          await this.auth0Service.handleAuth0Logout(user._id.toString());
        }

        // Delete session to invalidate all tokens
        await this.sessionModel.findByIdAndDelete(sessionId);

        // Update user online status
        if (user) {
          await this.userModel.findByIdAndUpdate(user._id, {
            is_online: false,
            socket_id: null,
            updated_at: moment().utc().valueOf(),
          });

          // Log successful logout
          this.securityAuditService.logSecurityEvent({
            userId: user._id.toString(),
            sessionId: sessionId,
            eventType: 'logout',
            details: { reason: 'user_initiated' },
            timestamp: new Date(),
          });
        }
      }
    } catch (error: any) {
      console.error('Logout error:', error.message || 'Unknown error');
    }
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAllSessions(userId: string): Promise<void> {
    try {
      // Blacklist all refresh tokens for the user
      await this.securityAuditService.blacklistAllUserTokens(
        userId,
        'logout_all_sessions',
      );

      // Delete all sessions for the user
      await this.sessionModel.deleteMany({ user_id: userId });

      // Update user online status
      await this.userModel.findByIdAndUpdate(userId, {
        is_online: false,
        socket_id: null,
        updated_at: moment().utc().valueOf(),
      });

      // Handle Auth0 logout if needed
      const user = await this.userModel.findById(userId);
      if (user && user.role === UserType.USER) {
        await this.auth0Service.handleAuth0Logout(userId);
      }

      // Log the mass logout event
      this.securityAuditService.logSecurityEvent({
        userId: userId,
        eventType: 'logout',
        details: { reason: 'logout_all_sessions', massLogout: true },
        timestamp: new Date(),
      });
    } catch (error: any) {
      console.error(
        'Logout all sessions error:',
        error.message || 'Unknown error',
      );
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredThreshold = moment().subtract(7, 'days').utc().valueOf();

      // Find and delete expired sessions
      const expiredSessions = await this.sessionModel.find({
        updated_at: { $lt: expiredThreshold },
      });

      if (expiredSessions.length > 0) {
        const sessionIds = expiredSessions.map((session) => session._id);
        await this.sessionModel.deleteMany({ _id: { $in: sessionIds } });
// console.log removed
      }
    } catch (error: any) {
      console.error('Session cleanup error:', error.message || 'Unknown error');
    }
  }

  /**
   * Sync Auth0 user profile with internal database
   */
  private async syncUserProfile(
    auth0Profile: Auth0UserProfile,
  ): Promise<UserDocument> {
    try {
      // Try to find existing user by Auth0 sub or email
      let user = await this.userModel.findOne({
        $or: [{ email: auth0Profile.email }, { auth0_sub: auth0Profile.sub }],
        is_deleted: false,
      });

      if (user) {
        // Update existing user profile
        user.first_name =
          auth0Profile.given_name ||
          auth0Profile.name?.split(' ')[0] ||
          user.first_name;
        user.last_name =
          auth0Profile.family_name ||
          auth0Profile.name?.split(' ').slice(1).join(' ') ||
          user.last_name;
        user.email = auth0Profile.email || user.email;
        user.is_email_verified =
          auth0Profile.email_verified || user.is_email_verified;
        user.updated_at = moment().utc().valueOf();

        // Add auth0_sub field if not exists
        if (!user['auth0_sub']) {
          user['auth0_sub'] = auth0Profile.sub;
        }

        await user.save();
      } else {
        // Create new user
        const newUser = new this.userModel({
          first_name:
            auth0Profile.given_name || auth0Profile.name?.split(' ')[0] || '',
          last_name:
            auth0Profile.family_name ||
            auth0Profile.name?.split(' ').slice(1).join(' ') ||
            '',
          email: auth0Profile.email,
          password: '', // No password for Auth0 users
          role: UserType.USER,
          auth0_sub: auth0Profile.sub,
          loyalty_point: 0,
          is_email_verified: auth0Profile.email_verified || false,
          created_at: moment().utc().valueOf(),
          updated_at: moment().utc().valueOf(),
        });

        user = await newUser.save();
      }

      return user;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to sync user profile: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Create new session
   */
  private async createSession(
    userId: Types.ObjectId,
    role: string,
    deviceType: string,
  ): Promise<SessionDocument> {
    const session = new this.sessionModel({
      user_id: userId,
      role: role,
      device_type: deviceType,
      created_at: moment().utc().valueOf(),
      updated_at: moment().utc().valueOf(),
    });

    return await session.save();
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(
    user: UserDocument,
    sessionId: Types.ObjectId,
  ): Promise<TokenPair> {
    const payload = {
      _id: user._id,
      email: user.email,
      role: user.role,
      session_id: sessionId,
    };

    const access_token = this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') || 'default-secret',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY') || '1d',
    });

    const refresh_token = this.jwtService.sign(
      { session_id: sessionId },
      {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'default-refresh-secret',
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d',
      },
    );

    return { access_token, refresh_token };
  }

  /**
   * Format user data for response
   */
  private formatUserDto(user: UserDocument): UserDto {
    return {
      _id: user._id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      loyalty_points: user.loyalty_point || 0,
      is_email_verified: user.is_email_verified,
    };
  }
}
