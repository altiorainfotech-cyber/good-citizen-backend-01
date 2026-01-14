import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/entities/user.entity';

@Schema({ versionKey: false })
export class DriverEarnings {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  driver_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DriverRide', required: true })
  ride_id!: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0 })
  base_fare!: number;

  @Prop({ type: Number, default: 0 })
  distance_fare!: number;

  @Prop({ type: Number, default: 0 })
  time_fare!: number;

  @Prop({ type: Number, default: 0 })
  surge_multiplier!: number;

  @Prop({ type: Number, default: 0 })
  platform_fee!: number;

  @Prop({ type: Number, required: true })
  total_fare!: number;

  @Prop({ type: Number, required: true })
  driver_earnings!: number; // After platform fee deduction

  @Prop({
    type: String,
    enum: ['PENDING', 'PAID', 'CANCELLED'],
    default: 'PENDING',
  })
  payment_status!: string;

  @Prop({ type: Date, default: Date.now })
  earned_at!: Date;

  @Prop({ type: Date })
  paid_at!: Date;

  @Prop({ type: String })
  payment_method!: string; // 'bank_transfer', 'wallet', etc.

  @Prop({ type: String })
  transaction_id!: string;

  @Prop({ type: Date, default: Date.now })
  created_at!: Date;

  @Prop({ type: Date, default: Date.now })
  updated_at!: Date;
}

export type DriverEarningsDocument = HydratedDocument<DriverEarnings>;
export const DriverEarningsSchema =
  SchemaFactory.createForClass(DriverEarnings);

// Indexes for efficient queries
DriverEarningsSchema.index({ driver_id: 1, earned_at: -1 });
DriverEarningsSchema.index({ payment_status: 1 });
DriverEarningsSchema.index({ ride_id: 1 });
