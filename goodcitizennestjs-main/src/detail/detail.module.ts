import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { DetailController } from './detail.controller';
import { RouteService } from './route.service';
import { FacilityDetailService } from './facility-detail.service';
import { PaymentMethodService } from './payment-method.service';
import { PaymentMethodSeeder } from './seeders/payment-method.seeder';
import { CommonService } from '../common/common.service';
import { WebSocketModule } from '../web-socket/web-socket.module';
import { commonModelDefinitions } from '../entities';
import { detailModelDefinitions } from './entities';

@Module({
  imports: [
    JwtModule,
    forwardRef(() => WebSocketModule),
    MongooseModule.forFeature([
      ...commonModelDefinitions,
      ...detailModelDefinitions,
    ]),
  ],
  controllers: [DetailController],
  providers: [
    RouteService,
    FacilityDetailService,
    PaymentMethodService,
    PaymentMethodSeeder,
    CommonService,
  ],
  exports: [
    MongooseModule,
    RouteService,
    FacilityDetailService,
    PaymentMethodService,
    PaymentMethodSeeder,
  ],
})
export class DetailModule {}
