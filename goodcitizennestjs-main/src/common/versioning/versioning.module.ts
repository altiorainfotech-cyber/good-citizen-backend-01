/* eslint-disable @typescript-eslint/require-await */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VersionInterceptor } from './version.interceptor';
import { SessionCompatibilityService } from './session-compatibility.service';
import { EnumMappingService } from './enum-mapping.service';
import { User, UserSchema } from '../../user/entities/user.entity';
import { Session, SessionSchema } from '../../user/entities/session.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret =
          configService.get<string>('jwt.accessSecret') ||
          configService.get<string>('JWT_ACCESS_SECRET');

        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is required but not configured');
        }

        return {
          secret,
          signOptions: { expiresIn: '24h' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    VersionInterceptor,
    SessionCompatibilityService,
    EnumMappingService,
  ],
  exports: [
    VersionInterceptor,
    SessionCompatibilityService,
    EnumMappingService,
  ],
})
export class VersioningModule {}
