import { ModelDefinition } from '@nestjs/mongoose';
import { User, UserSchema } from './user.entity';
import { Session, SessionSchema } from './session.entity';
import { LoyaltyPoint, LoyaltyPointSchema } from './loyalty-point.entity';
import { Reward, RewardSchema } from './reward.entity';
import {
  PointRedemption,
  PointRedemptionSchema,
} from './point-redemption.entity';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from './notification-preference.entity';
import { Achievement, AchievementSchema } from './achievement.entity';
import {
  UserAchievementProgress,
  UserAchievementProgressSchema,
} from './user-achievement-progress.entity';
import { AssistImpact, AssistImpactSchema } from './assist-impact.entity';

export const modelDefinitions: ModelDefinition[] = [
  {
    name: User.name,
    schema: UserSchema,
  },
  {
    name: Session.name,
    schema: SessionSchema,
  },
  {
    name: LoyaltyPoint.name,
    schema: LoyaltyPointSchema,
  },
  {
    name: Reward.name,
    schema: RewardSchema,
  },
  {
    name: PointRedemption.name,
    schema: PointRedemptionSchema,
  },
  {
    name: NotificationPreference.name,
    schema: NotificationPreferenceSchema,
  },
  {
    name: Achievement.name,
    schema: AchievementSchema,
  },
  {
    name: UserAchievementProgress.name,
    schema: UserAchievementProgressSchema,
  },
  {
    name: AssistImpact.name,
    schema: AssistImpactSchema,
  },
];
