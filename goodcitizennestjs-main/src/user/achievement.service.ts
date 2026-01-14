/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-base-to-string */

/* eslint-disable no-case-declarations */

import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import {
  Achievement,
  AchievementDocument,
} from './entities/achievement.entity';
import {
  UserAchievementProgress,
  UserAchievementProgressDocument,
} from './entities/user-achievement-progress.entity';

export interface AchievementWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  badgeIcon: string;
  requirements: {
    requirementType: 'count' | 'streak' | 'milestone';
    target: number;
    action: string;
  };
  pointsReward: number;
  progress: number; // 0-100
  isUnlocked: boolean;
  unlockedAt?: Date;
}

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Achievement.name)
    private achievementModel: Model<AchievementDocument>,
    @InjectModel(UserAchievementProgress.name)
    private userAchievementProgressModel: Model<UserAchievementProgressDocument>,
  ) {}

  /**
   * Initialize default achievements
   */
  async initializeDefaultAchievements(): Promise<void> {
    try {
      const existingAchievements = await this.achievementModel.countDocuments();
      if (existingAchievements > 0) {
        this.logger.log('Achievements already initialized');
        return;
      }

      const defaultAchievements = [
        {
          achievement_id: 'first_ambulance_assist',
          name: 'First Responder',
          description: 'Provided your first ambulance assistance',
          category: 'emergency',
          badgeIcon: 'ambulance-badge',
          requirements: {
            requirementType: 'count',
            target: 1,
            action: 'ambulance_assist',
          },
          pointsReward: 25,
        },
        {
          achievement_id: 'ambulance_helper_5',
          name: 'Emergency Helper',
          description: 'Assisted with 5 ambulance requests',
          category: 'emergency',
          badgeIcon: 'helper-badge',
          requirements: {
            requirementType: 'count',
            target: 5,
            action: 'ambulance_assist',
          },
          pointsReward: 50,
        },
        {
          achievement_id: 'ambulance_hero_25',
          name: 'Community Hero',
          description: 'Assisted with 25 ambulance requests',
          category: 'emergency',
          badgeIcon: 'hero-badge',
          requirements: {
            requirementType: 'count',
            target: 25,
            action: 'ambulance_assist',
          },
          pointsReward: 150,
        },
        {
          achievement_id: 'safety_champion_100',
          name: 'Safety Champion',
          description: 'Assisted with 100 ambulance requests',
          category: 'safety',
          badgeIcon: 'champion-badge',
          requirements: {
            requirementType: 'count',
            target: 100,
            action: 'ambulance_assist',
          },
          pointsReward: 500,
        },
        {
          achievement_id: 'loyal_user_30_days',
          name: 'Loyal User',
          description: 'Used the app for 30 consecutive days',
          category: 'loyalty',
          badgeIcon: 'loyalty-badge',
          requirements: {
            requirementType: 'streak',
            target: 30,
            action: 'daily_usage',
          },
          pointsReward: 100,
        },
        {
          achievement_id: 'community_supporter',
          name: 'Community Supporter',
          description: 'Earned 1000 loyalty points',
          category: 'community',
          badgeIcon: 'supporter-badge',
          requirements: {
            requirementType: 'milestone',
            target: 1000,
            action: 'loyalty_points_earned',
          },
          pointsReward: 200,
        },
        {
          achievement_id: 'emergency_streak_7',
          name: 'Emergency Streak',
          description: 'Provided ambulance assistance for 7 consecutive days',
          category: 'emergency',
          badgeIcon: 'streak-badge',
          requirements: {
            requirementType: 'streak',
            target: 7,
            action: 'daily_ambulance_assist',
          },
          pointsReward: 75,
        },
        {
          achievement_id: 'navigation_expert',
          name: 'Navigation Expert',
          description: 'Provided navigation assistance 50 times',
          category: 'safety',
          badgeIcon: 'navigation-badge',
          requirements: {
            requirementType: 'count',
            target: 50,
            action: 'navigation_assist',
          },
          pointsReward: 125,
        },
      ];

      await this.achievementModel.insertMany(defaultAchievements);
      this.logger.log(
        `Initialized ${defaultAchievements.length} default achievements`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error initializing default achievements: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get user's achievements with progress
   */
  async getUserAchievements(
    userId: string,
  ): Promise<AchievementWithProgress[]> {
    try {
      const achievements = await this.achievementModel
        .find({ isActive: true })
        .lean();
      const userProgress = await this.userAchievementProgressModel
        .find({
          userId: new Types.ObjectId(userId),
        })
        .lean();

      const progressMap = new Map();
      userProgress.forEach((progress) => {
        progressMap.set(progress.achievementId.toString(), progress);
      });

      const achievementsWithProgress: AchievementWithProgress[] = [];

      for (const achievement of achievements) {
        const progress = progressMap.get(achievement._id.toString());
        const currentProgress = await this.calculateUserProgress(
          userId,
          achievement,
        );

        achievementsWithProgress.push({
          id: achievement._id.toString(),
          name: achievement.name,
          description: achievement.description,
          category: achievement.category,
          badgeIcon: achievement.badgeIcon,
          requirements: achievement.requirements,
          pointsReward: achievement.pointsReward,
          progress: currentProgress,
          isUnlocked: progress?.isUnlocked || false,
          unlockedAt: progress?.unlockedAt,
        });
      }

      // Sort by category and then by progress (unlocked first, then by progress percentage)
      achievementsWithProgress.sort((a, b) => {
        if (a.isUnlocked !== b.isUnlocked) {
          return a.isUnlocked ? -1 : 1;
        }
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return b.progress - a.progress;
      });

      return achievementsWithProgress;
    } catch (error: any) {
      this.logger.error(`Error getting user achievements: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user progress for a specific action
   */
  async updateUserProgress(
    userId: string,
    action: string,
    value: number = 1,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      this.logger.log(
        `Updating progress for user ${userId}, action: ${action}, value: ${value}`,
      );

      // Find achievements that match this action
      const relevantAchievements = await this.achievementModel
        .find({
          'requirements.action': action,
          isActive: true,
        })
        .lean();

      for (const achievement of relevantAchievements) {
        await this.updateAchievementProgress(
          userId,
          achievement,
          value,
          metadata,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error updating user progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate current progress for a user and achievement
   */
  private async calculateUserProgress(
    userId: string,
    achievement: any,
  ): Promise<number> {
    try {
      const user = await this.userModel.findById(userId).lean();
      if (!user) return 0;

      const { requirementType, target, action } = achievement.requirements;
      let currentValue = 0;

      switch (action) {
        case 'ambulance_assist':
          const assists = user.metadata?.ambulance_assists || [];
          currentValue = assists.filter(
            (assist: any) => assist.outcome === 'successful',
          ).length;
          break;

        case 'navigation_assist':
          const navAssists = user.metadata?.ambulance_assists || [];
          currentValue = navAssists.filter(
            (assist: any) =>
              assist.assistType === 'navigation' &&
              assist.outcome === 'successful',
          ).length;
          break;

        case 'loyalty_points_earned':
          currentValue = user.loyalty_point || 0;
          break;

        case 'daily_usage':
        case 'daily_ambulance_assist':
          // For streak-based achievements, we'd need to implement streak tracking
          // For now, return 0 as this requires more complex date-based calculations
          currentValue = 0;
          break;

        default:
          currentValue = 0;
      }

      // Calculate progress percentage
      const progressPercentage = Math.min(
        100,
        Math.round((currentValue / target) * 100),
      );
      return progressPercentage;
    } catch (error: any) {
      this.logger.error(`Error calculating user progress: ${error.message}`);
      return 0;
    }
  }

  /**
   * Update progress for a specific achievement
   */
  private async updateAchievementProgress(
    userId: string,
    achievement: any,
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const currentProgress = await this.calculateUserProgress(
        userId,
        achievement,
      );
      const isCompleted = currentProgress >= 100;

      // Find or create progress record
      let progressRecord = await this.userAchievementProgressModel.findOne({
        userId: new Types.ObjectId(userId),
        achievementId: achievement._id,
      });

      if (!progressRecord) {
        progressRecord = new this.userAchievementProgressModel({
          userId: new Types.ObjectId(userId),
          achievementId: achievement._id,
          progress: currentProgress,
          isUnlocked: isCompleted,
          unlockedAt: isCompleted ? new Date() : undefined,
          metadata: metadata || {},
        });
      } else {
        progressRecord.progress = currentProgress;

        // If just completed, unlock and award points
        if (isCompleted && !progressRecord.isUnlocked) {
          progressRecord.isUnlocked = true;
          progressRecord.unlockedAt = new Date();

          // Award points to user
          await this.userModel.updateOne(
            { _id: new Types.ObjectId(userId) },
            {
              $inc: { loyalty_point: achievement.pointsReward },
              $set: { updated_at: Date.now() },
            },
          );

          this.logger.log(
            `Achievement unlocked: ${achievement.name} for user ${userId}, awarded ${achievement.pointsReward} points`,
          );
        }

        if (metadata) {
          progressRecord.metadata = { ...progressRecord.metadata, ...metadata };
        }
      }

      await progressRecord.save();
    } catch (error: any) {
      this.logger.error(
        `Error updating achievement progress: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats(): Promise<{
    total_achievements: number;
    total_unlocked: number;
    achievements_by_category: Record<string, number>;
    most_popular_achievements: Array<{ name: string; unlock_count: number }>;
  }> {
    try {
      const totalAchievements = await this.achievementModel.countDocuments({
        isActive: true,
      });
      const totalUnlocked =
        await this.userAchievementProgressModel.countDocuments({
          isUnlocked: true,
        });

      const categoryStats = await this.achievementModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);
      const achievementsByCategory = categoryStats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        },
        {} as Record<string, number>,
      );

      const popularAchievements =
        await this.userAchievementProgressModel.aggregate([
          { $match: { isUnlocked: true } },
          {
            $lookup: {
              from: 'achievements',
              localField: 'achievementId',
              foreignField: '_id',
              as: 'achievement',
            },
          },
          { $unwind: '$achievement' },
          { $group: { _id: '$achievement.name', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]);
      const mostPopularAchievements = popularAchievements.map((stat) => ({
        name: stat._id,
        unlock_count: stat.count,
      }));

      return {
        total_achievements: totalAchievements,
        total_unlocked: totalUnlocked,
        achievements_by_category: achievementsByCategory,
        most_popular_achievements: mostPopularAchievements,
      };
    } catch (error: any) {
      this.logger.error(`Error getting achievement stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all available achievements
   */
  async getAllAchievements(): Promise<any[]> {
    try {
      this.logger.log('Getting all available achievements');

      const achievements = await this.achievementModel
        .find({ isActive: true })
        .lean();
      return achievements;
    } catch (error: any) {
      this.logger.error(`Error getting all achievements: ${error.message}`);
      throw error;
    }
  }
}
