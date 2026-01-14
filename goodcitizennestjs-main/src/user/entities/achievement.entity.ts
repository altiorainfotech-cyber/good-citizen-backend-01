import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AchievementDocument = Achievement & Document;

@Schema({ timestamps: true })
export class Achievement {
  @Prop({ required: true })
  achievement_id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    required: true,
    enum: ['community', 'safety', 'loyalty', 'emergency'],
  })
  category: string;

  @Prop({ required: true })
  badgeIcon: string;

  @Prop({
    type: {
      requirementType: {
        type: String,
        enum: ['count', 'streak', 'milestone'],
        required: true,
      },
      target: { type: Number, required: true },
      action: { type: String, required: true },
    },
    required: true,
  })
  requirements: {
    requirementType: 'count' | 'streak' | 'milestone';
    target: number;
    action: string;
  };

  @Prop({ default: 0 })
  pointsReward: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const AchievementSchema = SchemaFactory.createForClass(Achievement);

// Create indexes for efficient queries
AchievementSchema.index({ achievement_id: 1 }, { unique: true });
AchievementSchema.index({ category: 1, isActive: 1 });
AchievementSchema.index({ isActive: 1 });
