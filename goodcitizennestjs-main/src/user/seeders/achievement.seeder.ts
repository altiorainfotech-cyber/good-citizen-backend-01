/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Achievement,
  AchievementDocument,
} from '../entities/achievement.entity';

@Injectable()
export class AchievementSeeder {
  private readonly logger = new Logger(AchievementSeeder.name);

  constructor(
    @InjectModel(Achievement.name)
    private achievementModel: Model<AchievementDocument>,
  ) {}

  /**
   * Seed achievement definitions
   * Requirements: 2.2 - Achievement system with badges and milestone tracking
   */
  async seedAchievements() {
    this.logger.log('Starting achievement definitions seeding...');

    const achievements = [
      // Community Achievements
      {
        achievement_id: 'first_assist',
        name: 'First Responder',
        description:
          'Provided your first emergency assistance to someone in need',
        category: 'community',
        badgeIcon: 'first-aid-badge',
        requirements: {
          requirementType: 'count',
          target: 1,
          action: 'emergency_assist',
        },
        pointsReward: 100,
        isActive: true,
        metadata: {
          rarity: 'common',
          displayOrder: 1,
        },
      },
      {
        achievement_id: 'helping_hand',
        name: 'Helping Hand',
        description: 'Assisted 5 people in emergency situations',
        category: 'community',
        badgeIcon: 'helping-hand-badge',
        requirements: {
          requirementType: 'count',
          target: 5,
          action: 'emergency_assist',
        },
        pointsReward: 250,
        isActive: true,
        metadata: {
          rarity: 'uncommon',
          displayOrder: 2,
        },
      },
      {
        achievement_id: 'community_hero',
        name: 'Community Hero',
        description: 'Provided assistance to 25 people in emergency situations',
        category: 'community',
        badgeIcon: 'hero-badge',
        requirements: {
          requirementType: 'count',
          target: 25,
          action: 'emergency_assist',
        },
        pointsReward: 500,
        isActive: true,
        metadata: {
          rarity: 'rare',
          displayOrder: 3,
        },
      },
      {
        achievement_id: 'guardian_angel',
        name: 'Guardian Angel',
        description:
          'Helped 100 people in emergency situations - a true community guardian',
        category: 'community',
        badgeIcon: 'angel-badge',
        requirements: {
          requirementType: 'count',
          target: 100,
          action: 'emergency_assist',
        },
        pointsReward: 1000,
        isActive: true,
        metadata: {
          rarity: 'legendary',
          displayOrder: 4,
        },
      },

      // Safety Achievements
      {
        achievement_id: 'ambulance_navigator',
        name: 'Ambulance Navigator',
        description: 'Successfully guided an ambulance to its destination',
        category: 'safety',
        badgeIcon: 'navigation-badge',
        requirements: {
          requirementType: 'count',
          target: 1,
          action: 'ambulance_navigation',
        },
        pointsReward: 150,
        isActive: true,
        metadata: {
          rarity: 'common',
          displayOrder: 5,
        },
      },
      {
        achievement_id: 'emergency_coordinator',
        name: 'Emergency Coordinator',
        description: 'Coordinated 10 emergency responses effectively',
        category: 'safety',
        badgeIcon: 'coordinator-badge',
        requirements: {
          requirementType: 'count',
          target: 10,
          action: 'emergency_coordination',
        },
        pointsReward: 400,
        isActive: true,
        metadata: {
          rarity: 'uncommon',
          displayOrder: 6,
        },
      },
      {
        achievement_id: 'life_saver',
        name: 'Life Saver',
        description:
          'Provided critical assistance in life-threatening emergencies',
        category: 'safety',
        badgeIcon: 'lifesaver-badge',
        requirements: {
          requirementType: 'count',
          target: 5,
          action: 'critical_emergency_assist',
        },
        pointsReward: 750,
        isActive: true,
        metadata: {
          rarity: 'rare',
          displayOrder: 7,
        },
      },

      // Loyalty Achievements
      {
        achievement_id: 'loyal_citizen',
        name: 'Loyal Citizen',
        description: 'Active member for 30 consecutive days',
        category: 'loyalty',
        badgeIcon: 'loyalty-badge',
        requirements: {
          requirementType: 'streak',
          target: 30,
          action: 'daily_activity',
        },
        pointsReward: 200,
        isActive: true,
        metadata: {
          rarity: 'common',
          displayOrder: 8,
        },
      },
      {
        achievement_id: 'dedicated_helper',
        name: 'Dedicated Helper',
        description: 'Maintained helping streak for 7 consecutive days',
        category: 'loyalty',
        badgeIcon: 'dedication-badge',
        requirements: {
          requirementType: 'streak',
          target: 7,
          action: 'daily_assist',
        },
        pointsReward: 300,
        isActive: true,
        metadata: {
          rarity: 'uncommon',
          displayOrder: 9,
        },
      },
      {
        achievement_id: 'platform_veteran',
        name: 'Platform Veteran',
        description: 'Active member for 365 consecutive days',
        category: 'loyalty',
        badgeIcon: 'veteran-badge',
        requirements: {
          requirementType: 'streak',
          target: 365,
          action: 'daily_activity',
        },
        pointsReward: 1500,
        isActive: true,
        metadata: {
          rarity: 'legendary',
          displayOrder: 10,
        },
      },

      // Emergency Achievements
      {
        achievement_id: 'rapid_responder',
        name: 'Rapid Responder',
        description: 'Responded to emergency calls within 2 minutes',
        category: 'emergency',
        badgeIcon: 'rapid-response-badge',
        requirements: {
          requirementType: 'count',
          target: 10,
          action: 'rapid_emergency_response',
        },
        pointsReward: 350,
        isActive: true,
        metadata: {
          rarity: 'uncommon',
          displayOrder: 11,
        },
      },
      {
        achievement_id: 'night_guardian',
        name: 'Night Guardian',
        description: 'Provided assistance during night hours (10 PM - 6 AM)',
        category: 'emergency',
        badgeIcon: 'night-guardian-badge',
        requirements: {
          requirementType: 'count',
          target: 15,
          action: 'night_emergency_assist',
        },
        pointsReward: 450,
        isActive: true,
        metadata: {
          rarity: 'rare',
          displayOrder: 12,
        },
      },
      {
        achievement_id: 'medical_assistant',
        name: 'Medical Assistant',
        description: 'Assisted in medical emergencies and hospital navigation',
        category: 'emergency',
        badgeIcon: 'medical-badge',
        requirements: {
          requirementType: 'count',
          target: 20,
          action: 'medical_emergency_assist',
        },
        pointsReward: 600,
        isActive: true,
        metadata: {
          rarity: 'rare',
          displayOrder: 13,
        },
      },

      // Milestone Achievements
      {
        achievement_id: 'point_collector',
        name: 'Point Collector',
        description: 'Earned 1000 loyalty points through community service',
        category: 'loyalty',
        badgeIcon: 'points-badge',
        requirements: {
          requirementType: 'milestone',
          target: 1000,
          action: 'loyalty_points_earned',
        },
        pointsReward: 100,
        isActive: true,
        metadata: {
          rarity: 'common',
          displayOrder: 14,
        },
      },
      {
        achievement_id: 'point_master',
        name: 'Point Master',
        description: 'Earned 10000 loyalty points - a true point master',
        category: 'loyalty',
        badgeIcon: 'master-badge',
        requirements: {
          requirementType: 'milestone',
          target: 10000,
          action: 'loyalty_points_earned',
        },
        pointsReward: 500,
        isActive: true,
        metadata: {
          rarity: 'legendary',
          displayOrder: 15,
        },
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const achievementData of achievements) {
      try {
        const existingAchievement = await this.achievementModel.findOne({
          achievement_id: achievementData.achievement_id,
        });

        if (existingAchievement) {
          // Update existing achievement if data has changed
          const updated = await this.achievementModel.updateOne(
            { achievement_id: achievementData.achievement_id },
            { $set: achievementData },
          );

          if (updated.modifiedCount > 0) {
            updatedCount++;
            this.logger.log(`Updated achievement: ${achievementData.name}`);
          } else {
            skippedCount++;
          }
        } else {
          // Create new achievement
          await this.achievementModel.create(achievementData);
          createdCount++;
          this.logger.log(`Created achievement: ${achievementData.name}`);
        }
      } catch (error) {
        this.logger.error(
          `Error seeding achievement ${achievementData.name}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Achievement seeding completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
    );
    return {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: achievements.length,
    };
  }

  /**
   * Remove inactive or deprecated achievements
   */
  async cleanupAchievements() {
    this.logger.log('Cleaning up inactive achievements...');

    const result = await this.achievementModel.deleteMany({
      isActive: false,
      // Only delete achievements that haven't been unlocked by any user
      achievement_id: { $nin: await this.getUnlockedAchievementIds() },
    });

    this.logger.log(`Cleaned up ${result.deletedCount} inactive achievements`);
    return result.deletedCount;
  }

  /**
   * Get list of achievement IDs that have been unlocked by users
   */
  private async getUnlockedAchievementIds(): Promise<string[]> {
    // This would require UserAchievementProgress model, but we'll keep it simple for now
    // In a real implementation, you'd query the UserAchievementProgress collection
    return [];
  }

  /**
   * Seed all achievement data
   */
  async seedAll() {
    this.logger.log('Starting complete achievement seeding...');

    try {
      const seedResult = await this.seedAchievements();
      await this.cleanupAchievements();

      this.logger.log('Achievement seeding completed successfully');
      return seedResult;
    } catch (error) {
      this.logger.error('Achievement seeding failed:', error);
      throw error;
    }
  }
}
