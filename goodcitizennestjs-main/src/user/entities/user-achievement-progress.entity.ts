import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { Achievement } from './achievement.entity';

export type UserAchievementProgressDocument = UserAchievementProgress &
  Document;

@Schema({ timestamps: true })
export class UserAchievementProgress {
  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Achievement.name,
    required: true,
    index: true,
  })
  achievementId: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  progress: number;

  @Prop({ default: false, index: true })
  isUnlocked: boolean;

  @Prop({ type: Date })
  unlockedAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const UserAchievementProgressSchema = SchemaFactory.createForClass(
  UserAchievementProgress,
);

// Create compound indexes for efficient queries
UserAchievementProgressSchema.index(
  { userId: 1, achievementId: 1 },
  { unique: true },
);
UserAchievementProgressSchema.index({ userId: 1, isUnlocked: 1 });
UserAchievementProgressSchema.index({ achievementId: 1, isUnlocked: 1 });
UserAchievementProgressSchema.index({ userId: 1, progress: 1 });
