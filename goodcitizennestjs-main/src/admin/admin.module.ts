import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { rideModelDefinitions } from '../driver/entities';
import { modelDefinitions } from '../user/entities';
import { commonModelDefinitions } from '../entities';
import { CommonService } from '../common/common.service';
import { AdminModelDefinitions } from './entities';
import { Ride, RideSchema } from '../ride/entities/ride.entity';

@Module({
  imports: [
    JwtModule,
    HttpModule,
    MongooseModule.forFeature([
      ...AdminModelDefinitions,
      ...rideModelDefinitions,
      ...modelDefinitions,
      ...commonModelDefinitions,
      { name: Ride.name, schema: RideSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, CommonService],
})
export class AdminModule {}
