import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import moment from 'moment';
import { DIRECTION, DriverApproval, UserType } from '../../common/utils';

class Point {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type!: string;

  @Prop({ type: [Number], required: true, default: [0, 0] }) // Ensure coordinates are always an array
  coordinates!: number[];
}

@Schema({ versionKey: false })
export class User {
  @Prop({ type: String, default: null })
  first_name!: string;

  @Prop({ type: String, default: null })
  last_name!: string;

  @Prop({ type: String })
  email!: string;

  @Prop({ type: String })
  country_code!: string;

  @Prop({ type: String })
  phone_number!: string;

  @Prop({ required: true, type: String })
  password!: string;

  @Prop({ type: String, default: null })
  auth0_sub!: string; // Auth0 user identifier

  @Prop({
    required: true,
    type: String,
    enum: UserType,
    default: UserType.USER,
  })
  role!: string;

  @Prop({ type: String })
  otp!: string;

  @Prop({ type: String })
  otp_expire_at!: Date;

  @Prop({ type: Boolean, default: false })
  is_deleted!: boolean;

  @Prop({ type: Boolean, default: false })
  is_online!: boolean;

  @Prop({ type: Boolean, default: false })
  is_email_verified!: boolean;

  @Prop({ type: String, default: null, enum: DriverApproval })
  approval!: string; //approval from admin

  // Driver-specific fields
  @Prop({ type: String, default: null })
  vehicle_type!: string;

  @Prop({ type: String, default: null })
  vehicle_plate!: string;

  @Prop({ type: Number, default: 0 })
  driver_rating!: number;

  @Prop({ type: Number, default: 0 })
  total_rides!: number;

  @Prop({ type: Number, default: 0 })
  total_earnings!: number;

  @Prop({ type: Number, default: 0 })
  acceptance_rate!: number;

  // Document upload fields
  @Prop({ type: String, default: null })
  aadhar_front!: string;

  @Prop({ type: String, default: null })
  aadhar_back!: string;

  @Prop({ type: String, default: null })
  dl_front!: string;

  @Prop({ type: String, default: null })
  dl_back!: string;

  @Prop({ type: String, default: null })
  profile_image!: string;

  @Prop({ type: Date, default: null })
  documents_uploaded_at!: Date;

  @Prop({ type: Date, default: null })
  approved_at!: Date;

  @Prop({ type: String, default: null })
  rejection_reason!: string;

  @Prop({
    type: Point,
    required: true,
    default: { type: 'Point', coordinates: [0, 0] },
  })
  location!: Point;

  @Prop({
    type: Point,
    required: true,
    default: { type: 'Point', coordinates: [0, 0] },
  })
  pre_location!: Point;

  @Prop({ type: Number })
  latitude!: number;

  @Prop({ type: Number })
  longitude!: number;

  @Prop({ type: String, enum: DIRECTION })
  direction!: string;

  @Prop({ type: String })
  socket_id!: string;

  @Prop({ type: Number })
  loyalty_point!: number;

  @Prop({ type: Number })
  current_bearing!: number;

  @Prop({ type: Number })
  current_speed!: number;

  @Prop({ type: Date })
  last_location_update!: Date;

  @Prop({ type: Object, default: {} })
  metadata!: any;

  @Prop({ default: moment().utc().valueOf() })
  created_at!: number;

  @Prop({ default: moment().utc().valueOf() })
  updated_at!: number;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ location: '2dsphere' });
