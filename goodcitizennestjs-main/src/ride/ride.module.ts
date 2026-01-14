import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RideController } from './ride.controller';
import { RideService } from './ride.service';
import { RideStateMachineService } from './ride-state-machine.service';
import { rideModelDefinitions } from './entities';
import { modelDefinitions } from '../user/entities';
import { DriverModule } from '../driver/driver.module';
import { CommonModule } from '../common/common.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      ...rideModelDefinitions,
      ...modelDefinitions, // For User model
    ]),
    DriverModule, // Import DriverModule to access DriverMatchingService
    CommonModule, // Import CommonModule for FrontendIntegrationService
    forwardRef(() => UserModule), // Import UserModule to access RewardsService (forwardRef to avoid circular dependency)
  ],
  controllers: [RideController],
  providers: [RideService, RideStateMachineService],
  exports: [RideService, RideStateMachineService],
})
export class RideModule {}
