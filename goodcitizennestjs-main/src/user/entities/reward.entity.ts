import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import moment from 'moment';

@Schema({ versionKey: false })
export class Reward {
  @Prop({ required: true })
  reward_id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  points_required!: number;

  @Prop({
    enum: ['DISCOUNT', 'FREE_RIDE', 'MERCHANDISE', 'DONATION', 'SPECIAL'],
    default: 'DISCOUNT',
  })
  category!: string;

  @Prop({ required: true })
  value!: string; // e.g., "10% off", "Free ride up to $20", "T-shirt"

  @Prop({ default: true })
  is_active!: boolean;

  @Prop({ type: Number, default: null })
  max_redemptions_per_user?: number; // null = unlimited

  @Prop({ type: Number, default: null })
  total_available?: number; // null = unlimited

  @Prop({ type: Number, default: 0 })
  total_redeemed!: number;

  @Prop({ type: Date, default: null })
  expires_at?: Date;

  @Prop({
    type: {
      terms: { type: String },
      restrictions: { type: [String] },
      how_to_use: { type: String },
    },
  })
  details!: {
    terms: string;
    restrictions: string[];
    how_to_use: string;
  };

  @Prop({ default: moment().utc().valueOf() })
  created_at!: number;

  @Prop({ default: moment().utc().valueOf() })
  updated_at!: number;
}

export type RewardDocument = HydratedDocument<Reward>;
export const RewardSchema = SchemaFactory.createForClass(Reward);

// Indexes
RewardSchema.index({ reward_id: 1 }, { unique: true });
RewardSchema.index({ is_active: 1, points_required: 1 });
RewardSchema.index({ category: 1, is_active: 1 });
