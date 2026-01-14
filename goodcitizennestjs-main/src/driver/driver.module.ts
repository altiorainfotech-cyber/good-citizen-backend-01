import { Module } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { DriverMatchingService } from './driver-matching.service';
import { DriverMatchingController } from './driver-matching.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { rideModelDefinitions } from './entities';
import { modelDefinitions } from '../user/entities';
import { commonModelDefinitions } from '../entities';
import { rideModelDefinitions as mainRideModelDefinitions } from '../ride/entities';
import { WebSocketService } from '../web-socket/web-socket.service';
import { JwtModule } from '@nestjs/jwt';
import { CommonService } from '../common/common.service';
import { NotificationService } from '../common/notification.service';
import { HttpModule } from '@nestjs/axios';
import { LocationService } from '../web-socket/location.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    JwtModule,
    HttpModule,
    CommonModule,
    MongooseModule.forFeature([
      ...rideModelDefinitions,
      ...modelDefinitions,
      ...commonModelDefinitions,
      ...mainRideModelDefinitions,
    ]),
  ],
  controllers: [DriverController, DriverMatchingController],
  providers: [
    DriverService,
    DriverMatchingService,
    WebSocketService,
    CommonService,
    NotificationService,
    LocationService,
  ],
  exports: [DriverMatchingService], // Export for use in other modules
})
export class DriverModule {}
