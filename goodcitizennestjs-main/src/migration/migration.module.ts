import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { User, UserSchema } from '../user/entities/user.entity';
import { Session, SessionSchema } from '../user/entities/session.entity';
import { Ride, RideSchema } from '../ride/entities/ride.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Ride.name, schema: RideSchema },
    ]),
  ],
  controllers: [MigrationController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
