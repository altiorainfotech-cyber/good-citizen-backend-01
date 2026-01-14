import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UsersController } from './users.controller';
import { LoyaltyPointsService } from './loyalty-points.service';
import { LoyaltyPointsController } from './loyalty-points.controller';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { EnhancedRewardsController } from './enhanced-rewards.controller';
import { AchievementService } from './achievement.service';
import { CommunityStatsService } from './community-stats.service';
import { ImpactCalculatorService } from './impact-calculator.service';
import { ImpactController } from './impact.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { modelDefinitions } from './entities';
import { JwtModule } from '@nestjs/jwt';
import { CommonService } from '../common/common.service';
import { commonModelDefinitions } from '../entities';
import {
  DriverRide,
  DriverRideSchema,
} from '../driver/entities/driver-ride.entity';
import { Ride, RideSchema } from '../ride/entities/ride.entity';
import { AuthModule } from '../authentication/auth.module';

@Module({
  imports: [
    JwtModule,
    AuthModule,
    MongooseModule.forFeature([
      ...modelDefinitions,
      ...commonModelDefinitions,
      { name: DriverRide.name, schema: DriverRideSchema },
      { name: Ride.name, schema: RideSchema },
    ]),
  ],
  controllers: [
    UserController,
    UsersController,
    LoyaltyPointsController,
    RewardsController,
    EnhancedRewardsController,
    ImpactController,
  ],
  providers: [
    UserService,
    LoyaltyPointsService,
    RewardsService,
    AchievementService,
    CommunityStatsService,
    ImpactCalculatorService,
    CommonService,
  ],
  exports: [
    MongooseModule,
    LoyaltyPointsService,
    RewardsService,
    AchievementService,
    CommunityStatsService,
    ImpactCalculatorService,
  ],
})
export class UserModule {}
