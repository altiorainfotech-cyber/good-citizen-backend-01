import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { EmergencyService } from './emergency.service';
import { EmergencyNotificationService } from './emergency-notification.service';
import { EmergencyWebSocketService } from './emergency-websocket.service';
import { CommonService } from '../common/common.service';
import { NotificationService } from '../common/notification.service';
import { WebSocketModule } from '../web-socket/web-socket.module';
import { AuthModule } from '../authentication/auth.module';
import { commonModelDefinitions } from '../entities';
import { exploreModelDefinitions } from './entities';
import { ExploreDataSeeder } from './seeders/explore-data.seeder';
import { EmergencyContactsSeeder } from './seeders/emergency-contacts.seeder';
import { HealthcareFacilitySeeder } from './seeders/healthcare-facility.seeder';
import { User, UserSchema } from '../user/entities/user.entity';
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
    JwtModule,
    forwardRef(() => WebSocketModule),
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      ...commonModelDefinitions,
      ...exploreModelDefinitions,
      { name: User.name, schema: UserSchema },
      {
        name: NotificationPreference.name,
        schema: NotificationPreferenceSchema,
      },
      { name: LoyaltyPoint.name, schema: LoyaltyPointSchema },
    ]),
  ],
  controllers: [ExploreController],
  providers: [
    ExploreService,
    EmergencyService,
    EmergencyNotificationService,
    EmergencyWebSocketService,
    CommonService,
    NotificationService,
    ExploreDataSeeder,
    EmergencyContactsSeeder,
    HealthcareFacilitySeeder,
  ],
  exports: [
    MongooseModule,
    ExploreService,
    EmergencyService,
    EmergencyNotificationService,
    EmergencyWebSocketService,
    ExploreDataSeeder,
    EmergencyContactsSeeder,
    HealthcareFacilitySeeder,
  ],
})
export class ExploreModule {}
