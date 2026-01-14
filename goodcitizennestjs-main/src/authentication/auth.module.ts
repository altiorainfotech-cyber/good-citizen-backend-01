/* eslint-disable @typescript-eslint/require-await */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { SecurityController } from './security.controller';
import { AuthService } from './auth.service';
import { Auth0Service } from './auth0.service';
import { Auth0ConfigService } from './auth0.config';
import { SecurityAuditService } from './security-audit.service';

import { User, UserSchema } from '../user/entities/user.entity';
import { Session, SessionSchema } from '../user/entities/session.entity';

import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret =
          configService.get<string>('jwt.accessSecret') ||
          configService.get<string>('JWT_ACCESS_SECRET');
        const expiresIn =
          configService.get<string>('jwt.accessExpiry') ||
          configService.get<string>('JWT_ACCESS_EXPIRY');

        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is required but not configured');
        }

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn || '1h', // Default to 1 hour if not configured
          },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AuthController, SecurityController],
  providers: [
    AuthService,
    Auth0Service,
    Auth0ConfigService,
    SecurityAuditService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    Auth0Service,
    Auth0ConfigService,
    SecurityAuditService,
    JwtAuthGuard,
    RolesGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
