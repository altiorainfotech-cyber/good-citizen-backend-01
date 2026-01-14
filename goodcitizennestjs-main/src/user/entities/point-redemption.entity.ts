import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import moment from 'moment';
import { User } from './user.entity';
import { Reward } from './reward.entity';

@Schema({ versionKey: false })
export class PointRedemption {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Reward.name, required: true })
  reward_id!: Types.ObjectId;

  @Prop({ required: true })
  points_spent!: number;

  @Prop({
    enum: ['PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED', 'EXPIRED'],
    default: 'PENDING',
  })
  status!: string;

  @Prop({ required: true })
  redemption_code!: string; // Unique code for the user to claim the reward

  @Prop({ type: Date, default: null })
  expires_at?: Date;

  @Prop({ type: Date, default: null })
  fulfilled_at?: Date;

  @Prop({ type: String, default: null })
  fulfillment_notes?: string;

  @Prop({
    type: {
      reward_name: { type: String, required: true },
      reward_value: { type: String, required: true },
      reward_category: { type: String, required: true },
    },
  })
  reward_snapshot!: {
    reward_name: string;
    reward_value: string;
    reward_category: string;
  };

  @Prop({ default: moment().utc().valueOf() })
  created_at!: number;

  @Prop({ default: moment().utc().valueOf() })
  updated_at!: number;
}

export type PointRedemptionDocument = HydratedDocument<PointRedemption>;
export const PointRedemptionSchema =
  SchemaFactory.createForClass(PointRedemption);

// Indexes
PointRedemptionSchema.index({ user_id: 1, created_at: -1 });
PointRedemptionSchema.index({ redemption_code: 1 }, { unique: true });
PointRedemptionSchema.index({ status: 1, expires_at: 1 });
