/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import {
  Achievement,
  AchievementDocument,
} from './entities/achievement.entity';
import {
  UserAchievementProgress,
  UserAchievementProgressDocument,
} from './entities/user-achievement-progress.entity';
import {
  PointRedemption,
  PointRedemptionDocument,
} from './entities/point-redemption.entity';

export interface CommunityStats {
  total_users: number;
  active_users_last_30_days: number;
  total_ambulance_assists: number;
  total_points_earned: number;
  total_points_redeemed: number;
  total_achievements_unlocked: number;
  top_contributors: Array<{
    user_id: string;
    username: string;
    assists_count: number;
    points_earned: number;
  }>;
  assists_by_type: Record<string, number>;
  monthly_growth: {
    new_users: number;
    new_assists: number;
    points_awarded: number;
  };
}

@Injectable()
export class CommunityStatsService {
  private readonly logger = new Logger(CommunityStatsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Achievement.name)
    private achievementModel: Model<AchievementDocument>,
    @InjectModel(UserAchievementProgress.name)
    private userAchievementProgressModel: Model<UserAchievementProgressDocument>,
    @InjectModel(PointRedemption.name)
    private pointRedemptionModel: Model<PointRedemptionDocument>,
  ) {}

  /**
   * Get comprehensive community statistics
   */
  async getCommunityStats(): Promise<CommunityStats> {
    try {
      this.logger.log('Generating community statistics');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Basic user statistics
      const totalUsers = await this.userModel.countDocuments();
      const activeUsersLast30Days = await this.userModel.countDocuments({
        updated_at: { $gte: thirtyDaysAgo.getTime() },
      });

      // Ambulance assistance statistics
      const ambulanceAssistStats = await this.calculateAmbulanceAssistStats();

      // Points statistics
      const pointsStats = await this.calculatePointsStats();

      // Achievement statistics
      const totalAchievementsUnlocked =
        await this.userAchievementProgressModel.countDocuments({
          isUnlocked: true,
        });

      // Top contributors
      const topContributors = await this.getTopContributors();

      // Monthly growth statistics
      const monthlyGrowth = await this.calculateMonthlyGrowth();

      return {
        total_users: totalUsers,
        active_users_last_30_days: activeUsersLast30Days,
        total_ambulance_assists: ambulanceAssistStats.total,
        total_points_earned: pointsStats.totalEarned,
        total_points_redeemed: pointsStats.totalRedeemed,
        total_achievements_unlocked: totalAchievementsUnlocked,
        top_contributors: topContributors,
        assists_by_type: ambulanceAssistStats.byType,
        monthly_growth: monthlyGrowth,
      };
    } catch (error: any) {
      this.logger.error(`Error generating community stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate ambulance assistance statistics
   */
  private async calculateAmbulanceAssistStats(): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    try {
      const users = await this.userModel
        .find({
          'metadata.ambulance_assists': { $exists: true, $ne: [] },
        })
        .lean();

      let totalAssists = 0;
      const assistsByType: Record<string, number> = {
        navigation: 0,
        emergency_contact: 0,
        facility_info: 0,
      };

      users.forEach((user) => {
        const assists = user.metadata?.ambulance_assists || [];
        assists.forEach((assist: any) => {
          if (assist.outcome === 'successful') {
            totalAssists++;
            assistsByType[assist.assistType] =
              (assistsByType[assist.assistType] || 0) + 1;
          }
        });
      });

      return {
        total: totalAssists,
        byType: assistsByType,
      };
    } catch (error: any) {
      this.logger.error(
        `Error calculating ambulance assist stats: ${error.message}`,
      );
      return { total: 0, byType: {} };
    }
  }

  /**
   * Calculate points statistics
   */
  private async calculatePointsStats(): Promise<{
    totalEarned: number;
    totalRedeemed: number;
  }> {
    try {
      // Calculate total points currently held by all users
      const pointsResult = await this.userModel.aggregate([
        { $group: { _id: null, total: { $sum: '$loyalty_point' } } },
      ]);
      const currentPoints = pointsResult[0]?.total || 0;

      // Calculate total points redeemed
      const redeemedResult = await this.pointRedemptionModel.aggregate([
        { $match: { status: { $in: ['FULFILLED', 'APPROVED'] } } },
        { $group: { _id: null, total: { $sum: '$points_spent' } } },
      ]);
      const totalRedeemed = redeemedResult[0]?.total || 0;

      // Total earned = current points + redeemed points
      const totalEarned = currentPoints + totalRedeemed;

      return {
        totalEarned,
        totalRedeemed,
      };
    } catch (error: any) {
      this.logger.error(`Error calculating points stats: ${error.message}`);
      return { totalEarned: 0, totalRedeemed: 0 };
    }
  }

  /**
   * Get top contributors based on ambulance assists and points
   */
  private async getTopContributors(limit: number = 10): Promise<
    Array<{
      user_id: string;
      username: string;
      assists_count: number;
      points_earned: number;
    }>
  > {
    try {
      const users = await this.userModel
        .find({
          $or: [
            { 'metadata.ambulance_assists': { $exists: true, $ne: [] } },
            { loyalty_point: { $gt: 0 } },
          ],
        })
        .lean();

      const contributors = users.map((user) => {
        const assists = user.metadata?.ambulance_assists || [];
        const successfulAssists = assists.filter(
          (assist: any) => assist.outcome === 'successful',
        );

        return {
          user_id: user._id.toString(),
          username:
            user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`
              : user.email?.split('@')[0] || 'Anonymous',
          assists_count: successfulAssists.length,
          points_earned: user.loyalty_point || 0,
        };
      });

      // Sort by assists count first, then by points
      contributors.sort((a, b) => {
        if (a.assists_count !== b.assists_count) {
          return b.assists_count - a.assists_count;
        }
        return b.points_earned - a.points_earned;
      });

      return contributors.slice(0, limit);
    } catch (error: any) {
      this.logger.error(`Error getting top contributors: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate monthly growth statistics
   */
  private async calculateMonthlyGrowth(): Promise<{
    new_users: number;
    new_assists: number;
    points_awarded: number;
  }> {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // New users in the last month
      const newUsers = await this.userModel.countDocuments({
        created_at: { $gte: oneMonthAgo.getTime() },
      });

      // New assists in the last month
      const users = await this.userModel
        .find({
          'metadata.ambulance_assists': { $exists: true, $ne: [] },
        })
        .lean();

      let newAssists = 0;
      let pointsAwarded = 0;

      users.forEach((user) => {
        const assists = user.metadata?.ambulance_assists || [];
        assists.forEach((assist: any) => {
          const assistDate = new Date(assist.timestamp);
          if (assistDate >= oneMonthAgo && assist.outcome === 'successful') {
            newAssists++;
            pointsAwarded += assist.pointsEarned || 0;
          }
        });
      });

      return {
        new_users: newUsers,
        new_assists: newAssists,
        points_awarded: pointsAwarded,
      };
    } catch (error: any) {
      this.logger.error(`Error calculating monthly growth: ${error.message}`);
      return { new_users: 0, new_assists: 0, points_awarded: 0 };
    }
  }

  /**
   * Get user leaderboard
   */
  async getUserLeaderboard(limit: number = 50): Promise<
    Array<{
      rank: number;
      user_id: string;
      username: string;
      assists_count: number;
      points_earned: number;
      achievements_unlocked: number;
    }>
  > {
    try {
      const contributors = await this.getTopContributors(limit);

      // Get achievement counts for each user
      const leaderboard: Array<{
        rank: number;
        user_id: string;
        username: string;
        assists_count: number;
        points_earned: number;
        achievements_unlocked: number;
      }> = [];

      for (let i = 0; i < contributors.length; i++) {
        const contributor = contributors[i];
        if (!contributor) continue;

        const achievementCount =
          await this.userAchievementProgressModel.countDocuments({
            userId: contributor.user_id,
            isUnlocked: true,
          });

        leaderboard.push({
          rank: i + 1,
          user_id: contributor.user_id,
          username: contributor.username,
          assists_count: contributor.assists_count,
          points_earned: contributor.points_earned,
          achievements_unlocked: achievementCount,
        });
      }

      return leaderboard;
    } catch (error: any) {
      this.logger.error(`Error getting user leaderboard: ${error.message}`);
      return [];
    }
  }

  /**
   * Get platform-wide metrics for dashboard
   */
  async getPlatformMetrics(): Promise<{
    total_emergency_responses: number;
    average_response_time: number;
    user_satisfaction_score: number;
    community_impact_score: number;
  }> {
    try {
      const stats = await this.getCommunityStats();

      // Calculate metrics based on available data
      const totalEmergencyResponses = stats.total_ambulance_assists;

      // Mock average response time (in real implementation, this would come from actual response data)
      const averageResponseTime = 8.5; // minutes

      // Calculate user satisfaction based on successful assists vs total assists
      const users = await this.userModel
        .find({
          'metadata.ambulance_assists': { $exists: true, $ne: [] },
        })
        .lean();

      let totalAssists = 0;
      let successfulAssists = 0;

      users.forEach((user) => {
        const assists = user.metadata?.ambulance_assists || [];
        assists.forEach((assist: any) => {
          totalAssists++;
          if (assist.outcome === 'successful') {
            successfulAssists++;
          }
        });
      });

      const userSatisfactionScore =
        totalAssists > 0 ? (successfulAssists / totalAssists) * 100 : 0;

      // Calculate community impact score based on multiple factors
      const impactFactors = {
        assists: Math.min(stats.total_ambulance_assists / 1000, 1) * 30, // Max 30 points
        users: Math.min(stats.total_users / 10000, 1) * 25, // Max 25 points
        achievements: Math.min(stats.total_achievements_unlocked / 500, 1) * 20, // Max 20 points
        points: Math.min(stats.total_points_earned / 50000, 1) * 25, // Max 25 points
      };

      const communityImpactScore = Object.values(impactFactors).reduce(
        (sum, score) => sum + score,
        0,
      );

      return {
        total_emergency_responses: totalEmergencyResponses,
        average_response_time: averageResponseTime,
        user_satisfaction_score: Math.round(userSatisfactionScore * 100) / 100,
        community_impact_score: Math.round(communityImpactScore * 100) / 100,
      };
    } catch (error: any) {
      this.logger.error(`Error getting platform metrics: ${error.message}`);
      return {
        total_emergency_responses: 0,
        average_response_time: 0,
        user_satisfaction_score: 0,
        community_impact_score: 0,
      };
    }
  }
}
