import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/entities/user.entity';
import { RideStatus } from '../../common/utils';

@Schema({ versionKey: false })
export class Ride {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  driver_id?: Types.ObjectId;

  // Locations
  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String },
    },
    required: true,
  })
  pickup_location!: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String },
    },
    required: true,
  })
  destination_location!: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Ride details
  @Prop({ enum: RideStatus, default: RideStatus.REQUESTED })
  status!: RideStatus;

  @Prop({ enum: ['REGULAR', 'EMERGENCY'], default: 'REGULAR' })
  vehicle_type!: 'REGULAR' | 'EMERGENCY';

  @Prop()
  emergency_details?: string;

  // Pricing
  @Prop({ required: true })
  estimated_fare!: number;

  @Prop()
  final_fare?: number;

  @Prop()
  distance_km?: number;

  @Prop()
  duration_minutes?: number;

  // Timestamps
  @Prop({ default: Date.now })
  requested_at!: Date;

  @Prop()
  driver_assigned_at?: Date;

  @Prop()
  driver_arrived_at?: Date;

  @Prop()
  ride_started_at?: Date;

  @Prop()
  ride_completed_at?: Date;

  @Prop()
  cancelled_at?: Date;

  // Rating
  @Prop({ min: 1, max: 5 })
  user_rating?: number;

  @Prop()
  user_feedback?: string;

  // Emergency-specific
  @Prop()
  last_notification?: Date;

  @Prop({ default: Date.now })
  created_at!: Date;

  @Prop({ default: Date.now })
  updated_at!: Date;
}

export type RideDocument = HydratedDocument<Ride>;
export const RideSchema = SchemaFactory.createForClass(Ride);

// Indexes
RideSchema.index({ user_id: 1, created_at: -1 });
RideSchema.index({ driver_id: 1, status: 1 });
RideSchema.index({ status: 1, vehicle_type: 1 });
