/* eslint-disable @typescript-eslint/no-unused-vars */

import { Module } from '@nestjs/common';
import { WebSocketService } from './web-socket.service';
import { SocketGateway } from './web-socket.gateway';
import { UserModule } from '../user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { modelDefinitions } from '../user/entities';
import { JwtModule } from '@nestjs/jwt';
import { CommonService } from '../common/common.service';
import { WebSocketController } from './web-socket.controller';
import { NotificationService } from '../common/notification.service';
import { commonModelDefinitions } from '../entities';
import { rideModelDefinitions } from '../driver/entities';
import { LocationService } from './location.service';
import { HttpModule, HttpService } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { RealTimeUpdatesService } from './real-time-updates.service';
import { RealTimeSchedulerService } from './real-time-scheduler.service';
import { exploreModelDefinitions } from '../explore/entities';
import { detailModelDefinitions } from '../detail/entities';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    JwtModule,
    HttpModule,
    CommonModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      ...modelDefinitions,
      ...commonModelDefinitions,
      ...rideModelDefinitions,
      ...exploreModelDefinitions,
      ...detailModelDefinitions,
    ]),
  ],
  controllers: [WebSocketController],
  providers: [
    SocketGateway,
    WebSocketService,
    CommonService,
    NotificationService,
    LocationService,
    RealTimeUpdatesService,
    RealTimeSchedulerService,
  ],
  exports: [
    SocketGateway,
    RealTimeUpdatesService,
    RealTimeSchedulerService,
  ],
})
export class WebSocketModule {}
