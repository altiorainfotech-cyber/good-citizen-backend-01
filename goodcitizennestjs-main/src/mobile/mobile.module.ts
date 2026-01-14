import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { MobilePlatformService } from './mobile-platform.service';
import { NavigationService } from './navigation.service';
import { User, UserSchema } from '../user/entities/user.entity';
import { Session, SessionSchema } from '../user/entities/session.entity';
import { NotificationService } from '../common/notification.service';
import {
  Notification,
  NotificationSchema,
} from '../entities/notification.entity';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from '../user/entities/notification-preference.entity';
import {
  LoyaltyPoint,
  LoyaltyPointSchema,
} from '../user/entities/loyalty-point.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Notification.name, schema: NotificationSchema },
      {
        name: NotificationPreference.name,
        schema: NotificationPreferenceSchema,
      },
      { name: LoyaltyPoint.name, schema: LoyaltyPointSchema },
    ]),
  ],
  controllers: [MobileController],
  providers: [
    MobileService,
    MobilePlatformService,
    NavigationService,
    NotificationService,
  ],
  exports: [MobileService, MobilePlatformService, NavigationService],
})
export class MobileModule {}
