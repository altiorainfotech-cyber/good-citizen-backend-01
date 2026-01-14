import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import moment from 'moment';

class Point {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type!: string;

  @Prop({ type: [Number], required: true, index: '2dsphere' })
  coordinates!: number[]; // [longitude, latitude]
}

@Schema({ versionKey: false })
export class UserLocation {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({
    type: Point,
    required: true,
  })
  coordinates!: Point;

  @Prop({ type: Number, required: true })
  accuracy!: number;

  @Prop({ type: Date, default: () => new Date() })
  timestamp!: Date;

  @Prop({ 
    type: String, 
    enum: ['gps', 'network', 'manual'], 
    required: true 
  })
  source!: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ default: moment().utc().valueOf() })
  created_at!: number;

  @Prop({ default: moment().utc().valueOf() })
  updated_at!: number;
}

export type UserLocationDocument = HydratedDocument<UserLocation>;
export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);

// Create geospatial index for location queries
UserLocationSchema.index({ 'coordinates': '2dsphere' });
// Create compound index for user-specific queries
UserLocationSchema.index({ userId: 1, timestamp: -1 });
// Create index for active locations
UserLocationSchema.index({ userId: 1, isActive: 1 });