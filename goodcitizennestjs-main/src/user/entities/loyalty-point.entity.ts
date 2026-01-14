import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import moment from 'moment';
import { User } from './user.entity';
import { DriverRide } from '../../driver/entities/driver-ride.entity';

@Schema({ versionKey: false })
export class LoyaltyPoint {
  @Prop({ type: Types.ObjectId, ref: User.name })
  user_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: DriverRide.name })
  ride_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  driver_id!: Types.ObjectId;

  @Prop({ default: 0 })
  loyalty_point!: number;

  @Prop({
    type: String,
    enum: ['AMBULANCE', 'FIRE', 'POLICE'],
    default: 'AMBULANCE',
  })
  emergency_type!: string;

  @Prop({ type: Number, default: 0 })
  time_saved_seconds!: number;

  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
  })
  location!: {
    latitude: number;
    longitude: number;
  };

  @Prop({
    type: {
      base_points: { type: Number, default: 5 },
      emergency_multiplier: { type: Number, default: 1.0 },
      time_multiplier: { type: Number, default: 1.0 },
      total_multiplier: { type: Number, default: 1.0 },
    },
  })
  calculation_details!: {
    base_points: number;
    emergency_multiplier: number;
    time_multiplier: number;
    total_multiplier: number;
  };

  @Prop({ default: moment().utc().valueOf() })
  created_at!: number;

  @Prop({ default: moment().utc().valueOf() })
  updated_at!: number;
}

export type LoyaltyPointDocument = HydratedDocument<LoyaltyPoint>;
export const LoyaltyPointSchema = SchemaFactory.createForClass(LoyaltyPoint);
