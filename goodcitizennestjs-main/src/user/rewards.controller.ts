/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/require-await */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  Put,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import {
  RedeemRewardDto,
  RewardCatalogItemDto,
  RedemptionResultDto,
  RedemptionHistoryItemDto,
  ValidateRedemptionCodeDto,
  FulfillRedemptionDto,
  GetRedemptionHistoryDto,
  RedemptionStatsDto,
} from './dto/rewards.dto';
import { RideData, AssistData, Achievement, UserActivity } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  private readonly logger = new Logger(RewardsController.name);

  constructor(private readonly rewardsService: RewardsService) {}

  /**
   * Initialize default rewards catalog (admin endpoint)
   */
  @Post('initialize')
  async initializeRewards(): Promise<{ message: string }> {
    try {
      this.logger.log('Initializing default rewards catalog');

      await this.rewardsService.initializeDefaultRewards();

      return { message: 'Default rewards catalog initialized successfully' };
    } catch (error: any) {
      this.logger.error(`Error initializing rewards: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get rewards catalog for a user
   */
  @Get('catalog/:userId')
  async getRewardsCatalog(
    @Param('userId') userId: string,
  ): Promise<RewardCatalogItemDto[]> {
    try {
      this.logger.log(`Getting rewards catalog for user ${userId}`);

      const catalog = await this.rewardsService.getRewardsCatalog(userId);

      return catalog;
    } catch (error: any) {
      this.logger.error(`Error getting rewards catalog: ${error.message}`);
      throw error;
    }
  }

  /**
   * Redeem a reward for points
   */
  @Post('redeem')
  async redeemReward(
    @Body() redeemRewardDto: RedeemRewardDto,
  ): Promise<RedemptionResultDto> {
    try {
      this.logger.log(
        `Processing reward redemption for user ${redeemRewardDto.user_id}`,
      );

      const result = await this.rewardsService.redeemReward(redeemRewardDto);

      // Convert result to DTO format
      const formattedResult: RedemptionResultDto = {
        redemption_id: result.redemption_id,
        redemption_code: result.redemption_code,
        reward_name: result.reward_name,
        points_spent: result.points_spent,
        status: result.status,
        instructions: result.instructions,
        ...(result.expires_at && {
          expires_at: result.expires_at.toISOString(),
        }),
      };

      return formattedResult;
    } catch (error: any) {
      this.logger.error(`Error redeeming reward: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's redemption history
   */
  @Get('history/:userId')
  async getUserRedemptionHistory(
    @Param('userId') userId: string,
    @Query() query: GetRedemptionHistoryDto,
  ): Promise<RedemptionHistoryItemDto[]> {
    try {
      this.logger.log(`Getting redemption history for user ${userId}`);

      const history = await this.rewardsService.getUserRedemptionHistory(
        userId,
        query.limit,
      );

      return history;
    } catch (error: any) {
      this.logger.error(`Error getting redemption history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate a redemption code
   */
  @Post('validate')
  async validateRedemptionCode(
    @Body() validateDto: ValidateRedemptionCodeDto,
  ): Promise<{
    valid: boolean;
    redemption?: any;
    error?: string;
  }> {
    try {
      this.logger.log(
        `Validating redemption code: ${validateDto.redemption_code}`,
      );

      const result = await this.rewardsService.validateRedemptionCode(
        validateDto.redemption_code,
      );

      return result;
    } catch (error: any) {
      this.logger.error(`Error validating redemption code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fulfill a redemption (admin endpoint)
   */
  @Put('fulfill')
  async fulfillRedemption(
    @Body() fulfillDto: FulfillRedemptionDto,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`Fulfilling redemption: ${fulfillDto.redemption_code}`);

      await this.rewardsService.fulfillRedemption(
        fulfillDto.redemption_code,
        fulfillDto.notes,
      );

      return { message: 'Redemption fulfilled successfully' };
    } catch (error: any) {
      this.logger.error(`Error fulfilling redemption: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get redemption statistics (admin endpoint)
   */
  @Get('stats')
  async getRedemptionStats(): Promise<RedemptionStatsDto> {
    try {
      this.logger.log('Getting redemption statistics');

      const stats = await this.rewardsService.getRedemptionStats();

      return stats;
    } catch (error: any) {
      this.logger.error(`Error getting redemption stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user rewards history
   */
  @Get('history/:userId')
  async getRewardsHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    try {
      this.logger.log(`Getting rewards history for user: ${userId}`);

      const history = await this.rewardsService.getUserRewardsHistory(
        userId,
        limit || 20,
      );

      return history;
    } catch (error: any) {
      this.logger.error(
        `Error getting rewards history: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get user achievements - returns real achievement data
   */
  @Get('achievements/:userId')
  async getAchievements(@Param('userId') userId: string): Promise<any> {
    try {
      this.logger.log(`Getting achievements for user: ${userId}`);

      const achievements = await this.rewardsService.getUserAchievements(userId);
      
      const completedCount = achievements.filter(a => a.unlocked).length;
      
      return {
        total_achievements: achievements.length,
        completed_achievements: completedCount,
        achievements: achievements,
      };
    } catch (error: any) {
      this.logger.error(
        `Error getting achievements: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Track ride completion activity
   */
  @Post('track/ride-completion')
  async trackRideCompletion(
    @Body() body: { userId: string; rideData: RideData },
  ): Promise<{ message: string; points_awarded: number }> {
    try {
      this.logger.log(`Tracking ride completion for user ${body.userId}`);

      await this.rewardsService.trackRideCompletion(body.userId, body.rideData);

      // Calculate points that would be awarded (for response)
      let basePoints = 10;
      if (body.rideData.vehicle_type === 'EMERGENCY') {
        basePoints += 15;
      }
      const distanceBonus = Math.min(Math.floor(body.rideData.distance_km), 20);
      const totalPoints = basePoints + distanceBonus;

      return {
        message: 'Ride completion tracked successfully',
        points_awarded: totalPoints,
      };
    } catch (error: any) {
      this.logger.error(`Error tracking ride completion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track emergency assist activity
   */
  @Post('track/emergency-assist')
  async trackEmergencyAssist(
    @Body() body: { userId: string; assistData: AssistData },
  ): Promise<{ message: string; points_awarded: number }> {
    try {
      this.logger.log(`Tracking emergency assist for user ${body.userId}`);

      await this.rewardsService.trackEmergencyAssist(body.userId, body.assistData);

      // Calculate points that would be awarded (for response)
      const bonusPoints = this.rewardsService.calculateBonusPoints({
        timeSaved: body.assistData.time_saved_seconds,
        livesAffected: body.assistData.impact_metrics?.lives_affected || 0,
        responseTimeImprovement: body.assistData.impact_metrics?.response_time_improvement || 0,
      });

      return {
        message: 'Emergency assist tracked successfully',
        points_awarded: bonusPoints,
      };
    } catch (error: any) {
      this.logger.error(`Error tracking emergency assist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user achievements based on current activity
   */
  @Post('achievements/:userId/update')
  async updateUserAchievements(@Param('userId') userId: string): Promise<{
    message: string;
    new_achievements: Achievement[];
  }> {
    try {
      this.logger.log(`Updating achievements for user ${userId}`);

      const newAchievements = await this.rewardsService.updateUserAchievements(userId);

      return {
        message: 'Achievements updated successfully',
        new_achievements: newAchievements,
      };
    } catch (error: any) {
      this.logger.error(`Error updating user achievements: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect activity to rewards system
   */
  @Post('connect-activity')
  async connectActivityToRewards(
    @Body() activity: UserActivity,
  ): Promise<{ message: string; transaction: any }> {
    try {
      this.logger.log(`Connecting activity to rewards for user ${activity.user_id}`);

      const transaction = await this.rewardsService.connectActivityToRewards(activity);

      return {
        message: 'Activity connected to rewards successfully',
        transaction,
      };
    } catch (error: any) {
      this.logger.error(`Error connecting activity to rewards: ${error.message}`);
      throw error;
    }
  }
}
