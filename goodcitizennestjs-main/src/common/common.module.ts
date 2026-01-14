import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationTemplateSeeder } from './notification-template.seeder';
import { NotificationQueueService } from './notification-queue.service';
import { CommonService } from './common.service';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { PerformanceService } from './performance.service';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { ErrorTrackingService } from './error-tracking.service';
import { ErrorHandlingService } from './error-handling.service';
import { MetricsMiddleware } from './metrics.middleware';
import { FrontendIntegrationService } from './frontend-integration.service';
import { WebSocketEventCompatibilityService } from './websocket-event-compatibility.service';
import { ValidationModule } from './validation/validation.module';
import { ResilienceModule } from './resilience/resilience.module';
import { RateLimitingMiddleware } from './middleware/rate-limiting.middleware';
import {
  Notification,
  NotificationSchema,
} from '../entities/notification.entity';
import {
  NotificationTemplate,
  NotificationTemplateSchema,
} from '../entities/notification-template.entity';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from '../user/entities/notification-preference.entity';
import {
  LoyaltyPoint,
  LoyaltyPointSchema,
} from '../user/entities/loyalty-point.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { Session, SessionSchema } from '../user/entities/session.entity';
import { Ride, RideSchema } from '../ride/entities/ride.entity';
import {
  DriverRide,
  DriverRideSchema,
} from '../driver/entities/driver-ride.entity';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'default-secret',
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRY || '1h' },
    }),
    ValidationModule,
    ResilienceModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      {
        name: NotificationPreference.name,
        schema: NotificationPreferenceSchema,
      },
      { name: LoyaltyPoint.name, schema: LoyaltyPointSchema },
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Ride.name, schema: RideSchema },
      { name: DriverRide.name, schema: DriverRideSchema },
    ]),
  ],
  controllers: [
    NotificationController,
    PrivacyController,
    MonitoringController,
  ],
  providers: [
    NotificationService,
    NotificationTemplateSeeder,
    NotificationQueueService,
    CommonService,
    PrivacyService,
    PerformanceService,
    MonitoringService,
    ErrorTrackingService,
    ErrorHandlingService,
    MetricsMiddleware,
    FrontendIntegrationService,
    WebSocketEventCompatibilityService,
    RateLimitingMiddleware,
  ],
  exports: [
    NotificationService,
    NotificationQueueService,
    CommonService,
    PrivacyService,
    PerformanceService,
    MonitoringService,
    ErrorTrackingService,
    ErrorHandlingService,
    MetricsMiddleware,
    FrontendIntegrationService,
    WebSocketEventCompatibilityService,
    ValidationModule,
    ResilienceModule,
    RateLimitingMiddleware,
  ],
})
export class CommonModule {}
