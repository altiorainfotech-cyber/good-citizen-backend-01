import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
