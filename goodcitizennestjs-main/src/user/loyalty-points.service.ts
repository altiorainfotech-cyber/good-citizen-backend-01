/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import {
  LoyaltyPoint,
  LoyaltyPointDocument,
} from './entities/loyalty-point.entity';
import {
  DriverRide,
  DriverRideDocument,
} from '../driver/entities/driver-ride.entity';

export interface EmergencyAssistData {
  user_id: string;
  driver_id: string;
  ride_id: string;
  emergency_type: 'AMBULANCE' | 'FIRE' | 'POLICE';
  time_saved_seconds: number;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
}

export interface LoyaltyPointsCalculationResult {
  points_awarded: number;
  reason: string;
  emergency_type: string;
  time_saved_seconds: number;
  multiplier: number;
  base_points: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points_required: number;
  category: 'EMERGENCY_HELPER' | 'GOOD_CITIZEN' | 'FREQUENT_USER' | 'SPECIAL';
}

export interface UserAchievementStatus {
  achievement_id: string;
  unlocked: boolean;
  unlocked_at?: Date;
  progress: number;
  progress_max: number;
}

@Injectable()
export class LoyaltyPointsService {
  private readonly logger = new Logger(LoyaltyPointsService.name);

  // Base points for emergency assists
  private readonly BASE_POINTS = 5;

  // Emergency type multipliers
  private readonly EMERGENCY_MULTIPLIERS = {
    AMBULANCE: 3.0, // Highest priority - medical emergencies
    FIRE: 2.5, // High priority - fire emergencies
    POLICE: 2.0, // Standard priority - police emergencies
  };

  // Time-based bonus multipliers
  private readonly TIME_BONUS_THRESHOLDS = {
    CRITICAL: { min_seconds: 0, max_seconds: 30, multiplier: 2.0 }, // 0-30s: Critical response
    URGENT: { min_seconds: 31, max_seconds: 60, multiplier: 1.5 }, // 31-60s: Urgent response
    STANDARD: { min_seconds: 61, max_seconds: 120, multiplier: 1.2 }, // 61-120s: Standard response
    NORMAL: { min_seconds: 121, max_seconds: 300, multiplier: 1.0 }, // 121-300s: Normal response
  };

  // Duplicate prevention window (same incident within this time)
  private readonly DUPLICATE_PREVENTION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  // Achievement definitions
  private readonly ACHIEVEMENTS: Achievement[] = [
    {
      id: 'first_assist',
      name: 'First Responder',
      description: 'Helped your first emergency vehicle',
      icon: '🚑',
      points_required: 5,
      category: 'EMERGENCY_HELPER',
    },
    {
      id: 'ambulance_helper',
      name: 'Life Saver',
      description: 'Helped 10 ambulances reach their destination',
      icon: '💝',
      points_required: 150,
      category: 'EMERGENCY_HELPER',
    },
    {
      id: 'fire_helper',
      name: 'Fire Fighter Friend',
      description: 'Helped 5 fire trucks reach emergencies',
      icon: '🔥',
      points_required: 75,
      category: 'EMERGENCY_HELPER',
    },
    {
      id: 'police_helper',
      name: 'Law Enforcement Ally',
      description: 'Helped 5 police vehicles respond to calls',
      icon: '👮',
      points_required: 50,
      category: 'EMERGENCY_HELPER',
    },
    {
      id: 'good_citizen_100',
      name: 'Good Citizen',
      description: 'Earned 100 loyalty points',
      icon: '🏆',
      points_required: 100,
      category: 'GOOD_CITIZEN',
    },
    {
      id: 'good_citizen_500',
      name: 'Outstanding Citizen',
      description: 'Earned 500 loyalty points',
      icon: '🌟',
      points_required: 500,
      category: 'GOOD_CITIZEN',
    },
    {
      id: 'good_citizen_1000',
      name: 'Hero Citizen',
      description: 'Earned 1000 loyalty points',
      icon: '🦸',
      points_required: 1000,
      category: 'GOOD_CITIZEN',
    },
    {
      id: 'speed_demon',
      name: 'Lightning Response',
      description: 'Responded to emergency alert in under 10 seconds',
      icon: '⚡',
      points_required: 25,
      category: 'SPECIAL',
    },
  ];

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LoyaltyPoint.name)
    private loyaltyPointModel: Model<LoyaltyPointDocument>,
    // Note: driverRideModel is available for future use in ride-related loyalty features
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
  ) {}

  /**
   * Award loyalty points for emergency assistance
   * Implements duplicate prevention and consistent scoring rules
   */
  async awardEmergencyAssistPoints(
    assistData: EmergencyAssistData,
  ): Promise<LoyaltyPointsCalculationResult> {
    try {
      this.logger.log(
        `Processing emergency assist for user ${assistData.user_id}, ride ${assistData.ride_id}`,
      );

      // Check for duplicate points for the same incident
      const isDuplicate = await this.checkForDuplicateAssist(assistData);
      if (isDuplicate) {
        this.logger.warn(
          `Duplicate assist detected for user ${assistData.user_id}, ride ${assistData.ride_id}`,
        );
        return {
          points_awarded: 0,
          reason: 'Duplicate assist for same emergency incident',
          emergency_type: assistData.emergency_type,
          time_saved_seconds: assistData.time_saved_seconds,
          multiplier: 0,
          base_points: this.BASE_POINTS,
        };
      }

      // Calculate points based on emergency type and response time
      const calculation = this.calculatePoints(assistData);

      // Create loyalty point record
      const loyaltyPointRecord = new this.loyaltyPointModel({
        user_id: new Types.ObjectId(assistData.user_id),
        driver_id: new Types.ObjectId(assistData.driver_id),
        ride_id: new Types.ObjectId(assistData.ride_id),
        loyalty_point: calculation.points_awarded,
        emergency_type: assistData.emergency_type,
        time_saved_seconds: assistData.time_saved_seconds,
        location: assistData.location,
        calculation_details: {
          base_points: calculation.base_points,
          emergency_multiplier:
            this.EMERGENCY_MULTIPLIERS[assistData.emergency_type],
          time_multiplier:
            calculation.multiplier /
            this.EMERGENCY_MULTIPLIERS[assistData.emergency_type],
          total_multiplier: calculation.multiplier,
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await loyaltyPointRecord.save();

      // Update user's total loyalty points
      await this.updateUserLoyaltyPoints(
        assistData.user_id,
        calculation.points_awarded,
      );

      // Check for new achievements
      await this.checkAndUnlockAchievements(assistData.user_id);

      this.logger.log(
        `Awarded ${calculation.points_awarded} points to user ${assistData.user_id} for ${assistData.emergency_type} assist`,
      );

      return calculation;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error awarding emergency assist points: ${errorMessage}`,
      );
      throw new Error(`Failed to award loyalty points: ${errorMessage}`);
    }
  }

  /**
   * Calculate points based on emergency type and response time
   */
  private calculatePoints(
    assistData: EmergencyAssistData,
  ): LoyaltyPointsCalculationResult {
    const basePoints = this.BASE_POINTS;
    const emergencyMultiplier =
      this.EMERGENCY_MULTIPLIERS[assistData.emergency_type] || 1.0;

    // Calculate time-based bonus
    const timeMultiplier = this.calculateTimeMultiplier(
      assistData.time_saved_seconds,
    );

    // Total multiplier combines emergency type and time bonus
    const totalMultiplier = emergencyMultiplier * timeMultiplier;

    // Calculate final points (rounded to nearest integer)
    const pointsAwarded = Math.round(basePoints * totalMultiplier);

    let reason = `Emergency assist: ${assistData.emergency_type}`;
    if (timeMultiplier > 1.0) {
      reason += ` with quick response bonus`;
    }

    return {
      points_awarded: pointsAwarded,
      reason,
      emergency_type: assistData.emergency_type,
      time_saved_seconds: assistData.time_saved_seconds,
      multiplier: totalMultiplier,
      base_points: basePoints,
    };
  }

  /**
   * Calculate time-based multiplier for response speed
   */
  private calculateTimeMultiplier(timeSavedSeconds: number): number {
    for (const [, threshold] of Object.entries(this.TIME_BONUS_THRESHOLDS)) {
      if (
        timeSavedSeconds >= threshold.min_seconds &&
        timeSavedSeconds <= threshold.max_seconds
      ) {
        return threshold.multiplier;
      }
    }

    // Default multiplier for responses over 5 minutes
    return 0.8;
  }

  /**
   * Check for duplicate assists within the prevention window
   */
  private async checkForDuplicateAssist(
    assistData: EmergencyAssistData,
  ): Promise<boolean> {
    try {
      const windowStart = new Date(
        assistData.timestamp.getTime() - this.DUPLICATE_PREVENTION_WINDOW_MS,
      );
      const windowEnd = new Date(
        assistData.timestamp.getTime() + this.DUPLICATE_PREVENTION_WINDOW_MS,
      );

      // Check for existing loyalty points for the same user and ride within the time window
      const existingAssist = await this.loyaltyPointModel
        .findOne({
          user_id: new Types.ObjectId(assistData.user_id),
          ride_id: new Types.ObjectId(assistData.ride_id),
          created_at: {
            $gte: windowStart.getTime(),
            $lte: windowEnd.getTime(),
          },
        })
        .lean();

      return existingAssist !== null;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error checking for duplicate assist: ${errorMessage}`);
      // In case of error, allow the assist to prevent blocking legitimate points
      return false;
    }
  }

  /**
   * Update user's total loyalty points
   */
  private async updateUserLoyaltyPoints(
    userId: string,
    pointsToAdd: number,
  ): Promise<void> {
    try {
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $inc: { loyalty_point: pointsToAdd },
          $set: { updated_at: Date.now() },
        },
      );

      this.logger.debug(
        `Updated user ${userId} loyalty points by ${pointsToAdd}`,
      );
    } catch (error: any) {
      this.logger.error(`Error updating user loyalty points: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check and unlock achievements based on user's current points and activity
   */
  async checkAndUnlockAchievements(
    userId: string,
  ): Promise<UserAchievementStatus[]> {
    try {
      const user = await this.userModel.findById(userId).lean();
      if (!user) {
        throw new Error('User not found');
      }

      const userPoints = user.loyalty_point || 0;
      const newAchievements: UserAchievementStatus[] = [];

      // Get user's emergency assist history for specific achievement checks
      const assistHistory = await this.loyaltyPointModel
        .find({
          user_id: new Types.ObjectId(userId),
        })
        .lean();

      // Count assists by emergency type
      const assistCounts = {
        AMBULANCE: assistHistory.filter(
          (assist) => (assist as any).emergency_type === 'AMBULANCE',
        ).length,
        FIRE: assistHistory.filter(
          (assist) => (assist as any).emergency_type === 'FIRE',
        ).length,
        POLICE: assistHistory.filter(
          (assist) => (assist as any).emergency_type === 'POLICE',
        ).length,
      };

      // Check each achievement
      for (const achievement of this.ACHIEVEMENTS) {
        const isUnlocked = this.isAchievementUnlocked(
          userId,
          achievement.id,
        );

        if (!isUnlocked) {
          let shouldUnlock = false;
          let progress = 0;
          let progressMax = achievement.points_required;

          switch (achievement.id) {
            case 'first_assist':
              shouldUnlock = assistHistory.length >= 1;
              progress = Math.min(assistHistory.length, 1);
              progressMax = 1;
              break;

            case 'ambulance_helper':
              shouldUnlock = assistCounts.AMBULANCE >= 10;
              progress = assistCounts.AMBULANCE;
              progressMax = 10;
              break;

            case 'fire_helper':
              shouldUnlock = assistCounts.FIRE >= 5;
              progress = assistCounts.FIRE;
              progressMax = 5;
              break;

            case 'police_helper':
              shouldUnlock = assistCounts.POLICE >= 5;
              progress = assistCounts.POLICE;
              progressMax = 5;
              break;

            case 'good_citizen_100':
            case 'good_citizen_500':
            case 'good_citizen_1000':
              shouldUnlock = userPoints >= achievement.points_required;
              progress = userPoints;
              progressMax = achievement.points_required;
              break;

            case 'speed_demon': {
              // Check if user has any assists with response time under 10 seconds
              const quickResponses = assistHistory.filter(
                (assist) => (assist as any).time_saved_seconds <= 10,
              );
              shouldUnlock = quickResponses.length >= 1;
              progress = Math.min(quickResponses.length, 1);
              progressMax = 1;
              break;
            }
          }

          if (shouldUnlock) {
            this.unlockAchievement(userId, achievement.id);
            this.logger.log(
              `Achievement unlocked for user ${userId}: ${achievement.name}`,
            );
          }

          newAchievements.push({
            achievement_id: achievement.id,
            unlocked: shouldUnlock,
            unlocked_at: shouldUnlock ? new Date() : undefined,
            progress,
            progress_max: progressMax,
          } as UserAchievementStatus);
        }
      }

      return newAchievements;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error checking achievements for user ${userId}: ${errorMessage}`,
      );
      return [];
    }
  }

  /**
   * Check if a specific achievement is already unlocked
   */
  private isAchievementUnlocked(
    _userId: string,
    _achievementId: string,
  ): boolean {
    try {
      // In a full implementation, this would check a UserAchievements collection
      // For now, we'll use a simple approach based on user data
      // const user = await this.userModel.findById(userId).lean();
      // if (!user) return false;

      // Check if user has the achievement in their profile (if we had an achievements field)
      // For this implementation, we'll determine based on current state
      return false; // Always check for new achievements in this simplified version
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error checking achievement status: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Unlock an achievement for a user
   */
  private unlockAchievement(userId: string, achievementId: string): void {
    try {
      // In a full implementation, this would create a record in UserAchievements collection
      // For now, we'll log the achievement unlock
      this.logger.log(
        `Achievement ${achievementId} unlocked for user ${userId}`,
      );

      // Future implementation could:
      // await this.userAchievementModel.create({
      //   user_id: userId,
      //   achievement_id: achievementId,
      //   unlocked_at: new Date()
      // });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error unlocking achievement: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get user's loyalty points summary
   */
  async getUserLoyaltyPointsSummary(userId: string): Promise<{
    total_points: number;
    total_assists: number;
    assists_by_type: Record<string, number>;
    recent_assists: any[];
    achievements: UserAchievementStatus[];
  }> {
    try {
      const user = await this.userModel.findById(userId).lean();
      if (!user) {
        throw new Error('User not found');
      }

      const assistHistory = await this.loyaltyPointModel
        .find({
          user_id: new Types.ObjectId(userId),
        })
        .sort({ created_at: -1 })
        .limit(10)
        .lean();

      const assistsByType = assistHistory.reduce(
        (acc, assist) => {
          const type = (assist as any).emergency_type || 'UNKNOWN';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const achievements = await this.checkAndUnlockAchievements(userId);

      // Note: driverRideModel is available for future ride-related loyalty features
      const rideCount = await this.driverRideModel.countDocuments({
        user_id: new Types.ObjectId(userId),
      });
      this.logger.debug(`User ${userId} has ${rideCount} rides in history`);

      return {
        total_points: user.loyalty_point || 0,
        total_assists: assistHistory.length,
        assists_by_type: assistsByType,
        recent_assists: assistHistory.slice(0, 5),
        achievements,
      };
    } catch (error: any) {
      this.logger.error(
        `Error getting loyalty points summary: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all available achievements
   */
  getAvailableAchievements(): Achievement[] {
    return this.ACHIEVEMENTS;
  }

  /**
   * Get leaderboard of top users by loyalty points
   */
  async getLoyaltyPointsLeaderboard(limit: number = 10): Promise<
    Array<{
      user_id: string;
      name: string;
      loyalty_points: number;
      total_assists: number;
      rank: number;
    }>
  > {
    try {
      const topUsers = await this.userModel
        .find(
          {
            role: 'USER',
            is_deleted: false,
            loyalty_point: { $gt: 0 },
          },
          {
            _id: 1,
            first_name: 1,
            last_name: 1,
            loyalty_point: 1,
          },
        )
        .sort({ loyalty_point: -1 })
        .limit(limit)
        .lean();

      const leaderboard = await Promise.all(
        topUsers.map(async (user, index) => {
          const assistCount = await this.loyaltyPointModel.countDocuments({
            user_id: user._id,
          });

          return {
            user_id: user._id.toString(),
            name: `${user.first_name} ${user.last_name}`.trim() || 'Anonymous',
            loyalty_points: user.loyalty_point || 0,
            total_assists: assistCount,
            rank: index + 1,
          };
        }),
      );

      return leaderboard;
    } catch (error: any) {
      this.logger.error(
        `Error getting loyalty points leaderboard: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get user's current point balance
   */
  async getUserPointBalance(userId: string): Promise<number> {
    try {
      const user = await this.userModel
        .findById(userId, { loyalty_point: 1 })
        .lean();
      return user?.loyalty_point || 0;
    } catch (error: any) {
      this.logger.error(`Error getting user point balance: ${error.message}`);
      return 0;
    }
  }

  /**
   * Deduct points from user (used by rewards system)
   */
  async deductPoints(userId: string, pointsToDeduct: number): Promise<boolean> {
    try {
      const result = await this.userModel.updateOne(
        {
          _id: new Types.ObjectId(userId),
          loyalty_point: { $gte: pointsToDeduct }, // Ensure sufficient balance
        },
        {
          $inc: { loyalty_point: -pointsToDeduct },
          $set: { updated_at: Date.now() },
        },
      );

      return result.matchedCount > 0;
    } catch (error: any) {
      this.logger.error(`Error deducting points: ${error.message}`);
      return false;
    }
  }
}
