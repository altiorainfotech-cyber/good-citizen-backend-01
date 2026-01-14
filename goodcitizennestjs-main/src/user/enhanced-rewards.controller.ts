/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Controller, Get, Query, UseGuards, Req, Logger } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/enhanced-jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/enhanced-roles.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from '../common/utils';
import { RewardsService } from './rewards.service';
import { AchievementService } from './achievement.service';

@ApiTags('Enhanced Rewards')
@Controller({ path: 'rewards', version: '1' })
export class EnhancedRewardsController {
  private readonly logger = new Logger(EnhancedRewardsController.name);

  constructor(
    private readonly rewardsService: RewardsService,
    private readonly achievementService: AchievementService,
  ) {}

  /**
   * Get user rewards history with pagination
   * @param query Query parameters including userId, limit, offset
   * @param req Request object with user info
   * @returns Paginated rewards history
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('history')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get chronological list of earned rewards and points',
  })
  async getRewardsHistory(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Req() req?: any,
  ): Promise<{
    history: any[];
    total: number;
    hasMore: boolean;
    stats: {
      totalPoints: number;
      totalRewards: number;
      recentActivity: number;
    };
  }> {
    try {
      this.logger.log(`Getting rewards history for user ${userId}`);

      const limitValue = Math.min(limit || 20, 100);
      const offsetValue = offset || 0;

      // Get user's redemption history as rewards history
      const allHistory = await this.rewardsService.getUserRedemptionHistory(
        userId,
        1000,
      );
      const paginatedHistory = allHistory.slice(
        offsetValue,
        offsetValue + limitValue,
      );
      const hasMore = allHistory.length > offsetValue + limitValue;

      // Calculate statistics
      const stats = {
        totalPoints: allHistory.reduce(
          (total, item) => total + (item.points_spent || 0),
          0,
        ),
        totalRewards: allHistory.length,
        recentActivity: allHistory.filter((item) => {
          const itemDate = new Date(item.redeemed_at);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return itemDate >= thirtyDaysAgo;
        }).length,
      };

      return {
        history: paginatedHistory,
        total: allHistory.length,
        hasMore,
        stats,
      };
    } catch (error: any) {
      this.logger.error(`Error getting rewards history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user achievements with progress tracking
   * @param query Query parameters including userId
   * @param req Request object with user info
   * @returns User achievements with progress
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('achievements')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: 'Get unlocked badges and milestone progress' })
  async getAchievements(
    @Query('userId') userId: string,
    @Req() req?: any,
  ): Promise<{
    achievements: any[];
    stats: {
      total: number;
      unlocked: number;
      inProgress: number;
      totalPoints: number;
    };
  }> {
    try {
      this.logger.log(`Getting achievements for user ${userId}`);

      // Get user achievements from achievement service
      const userAchievements =
        await this.achievementService.getUserAchievements(userId);
      const allAchievements =
        await this.achievementService.getAllAchievements();

      // The getUserAchievements already returns achievements with progress
      const achievementsWithProgress = userAchievements;

      // Calculate statistics
      const stats = {
        total: achievementsWithProgress.length,
        unlocked: achievementsWithProgress.filter((a) => a.isUnlocked).length,
        inProgress: achievementsWithProgress.filter(
          (a) => a.progress > 0 && !a.isUnlocked,
        ).length,
        totalPoints: achievementsWithProgress
          .filter((a) => a.isUnlocked)
          .reduce((total, a) => total + a.pointsReward, 0),
      };

      return {
        achievements: achievementsWithProgress,
        stats,
      };
    } catch (error: any) {
      this.logger.error(`Error getting achievements: ${error.message}`);
      throw error;
    }
  }
}
