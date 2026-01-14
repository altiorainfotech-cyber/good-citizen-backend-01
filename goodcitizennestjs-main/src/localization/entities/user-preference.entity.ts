import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserPreferenceDocument = UserPreference & Document;

@Schema({ timestamps: true })
export class UserPreference {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, default: 'en' })
  language: string;

  @Prop({ required: true, default: 'US' })
  region: string;

  @Prop({ required: true, default: 'UTC' })
  timezone: string;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ required: true, default: 'MM/DD/YYYY' })
  date_format: string;

  @Prop({ required: true, default: '12' })
  time_format: string; // '12' or '24'

  @Prop({ required: true, default: 'imperial' })
  unit_system: string; // 'metric' or 'imperial'

  @Prop({ type: Object, default: {} })
  notification_preferences: {
    language?: string;
    emergency_alerts?: boolean;
    ride_updates?: boolean;
    promotional?: boolean;
  };

  @Prop({ default: Date.now })
  created_at: Date;

  @Prop({ default: Date.now })
  updated_at: Date;
}

export const UserPreferenceSchema =
  SchemaFactory.createForClass(UserPreference);

// Create indexes
UserPreferenceSchema.index({ user_id: 1 }, { unique: true });
UserPreferenceSchema.index({ language: 1, region: 1 });
