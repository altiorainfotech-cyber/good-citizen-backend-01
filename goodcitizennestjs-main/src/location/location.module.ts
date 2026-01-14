import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { LocationManagerService } from './location-manager.service';
import { LocationController } from './location.controller';
import { modelDefinitions } from './entities';
import { AuthModule } from '../authentication/auth.module';

@Module({
  imports: [
    JwtModule,
    AuthModule,
    MongooseModule.forFeature(modelDefinitions),
  ],
  controllers: [LocationController],
  providers: [LocationManagerService],
  exports: [LocationManagerService, MongooseModule],
})
export class LocationModule {}