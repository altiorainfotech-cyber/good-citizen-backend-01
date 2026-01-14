import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { LoyaltyPointsService } from './loyalty-points.service';
import {
  EmergencyAssistDto,
  LoyaltyPointsCalculationResponseDto,
  LoyaltyPointsSummaryDto,
  LeaderboardEntryDto,
  GetLeaderboardDto,
  AchievementDto,
} from './dto/loyalty-points.dto';

@Controller('loyalty-points')
export class LoyaltyPointsController {
  private readonly logger = new Logger(LoyaltyPointsController.name);

  constructor(private readonly loyaltyPointsService: LoyaltyPointsService) {}

  /**
   * Award loyalty points for emergency assistance
   */
  @Post('award-emergency-assist')
  async awardEmergencyAssist(
    @Body() emergencyAssistDto: EmergencyAssistDto,
  ): Promise<LoyaltyPointsCalculationResponseDto> {
    try {
      this.logger.log(
        `Processing emergency assist award for user ${emergencyAssistDto.user_id}`,
      );

      const assistData = {
        ...emergencyAssistDto,
        timestamp: emergencyAssistDto.timestamp
          ? new Date(emergencyAssistDto.timestamp)
          : new Date(),
      };

      const result =
        await this.loyaltyPointsService.awardEmergencyAssistPoints(assistData);

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error awarding emergency assist points: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Get user's loyalty points summary
   */
  @Get('summary/:userId')
  async getUserLoyaltyPointsSummary(
    @Param('userId') userId: string,
  ): Promise<LoyaltyPointsSummaryDto> {
    try {
      this.logger.log(`Getting loyalty points summary for user ${userId}`);

      const summary =
        await this.loyaltyPointsService.getUserLoyaltyPointsSummary(userId);

      // Convert achievements to DTO format
      const formattedSummary: LoyaltyPointsSummaryDto = {
        ...summary,
        achievements: summary.achievements.map((achievement) => ({
          achievement_id: achievement.achievement_id,
          unlocked: achievement.unlocked,
          progress: achievement.progress,
          progress_max: achievement.progress_max,
          ...(achievement.unlocked_at && {
            unlocked_at: achievement.unlocked_at.toISOString(),
          }),
        })),
      };

      return formattedSummary;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error getting loyalty points summary: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Get all available achievements
   */
  @Get('achievements')
  getAvailableAchievements(): AchievementDto[] {
    try {
      this.logger.log('Getting available achievements');

      const achievements = this.loyaltyPointsService.getAvailableAchievements();

      return achievements;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting achievements: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get loyalty points leaderboard
   */
  @Get('leaderboard')
  async getLoyaltyPointsLeaderboard(
    @Query() query: GetLeaderboardDto,
  ): Promise<LeaderboardEntryDto[]> {
    try {
      this.logger.log(
        `Getting loyalty points leaderboard (limit: ${query.limit})`,
      );

      const leaderboard =
        await this.loyaltyPointsService.getLoyaltyPointsLeaderboard(
          query.limit,
        );

      return leaderboard;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting leaderboard: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check and unlock achievements for a user
   */
  @Post('check-achievements/:userId')
  async checkUserAchievements(
    @Param('userId') userId: string,
  ): Promise<{ message: string; new_achievements: any[] }> {
    try {
      this.logger.log(`Checking achievements for user ${userId}`);

      const newAchievements =
        await this.loyaltyPointsService.checkAndUnlockAchievements(userId);
      const unlockedAchievements = newAchievements.filter(
        (achievement) => achievement.unlocked,
      );

      return {
        message: `Checked achievements for user ${userId}`,
        new_achievements: unlockedAchievements,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error checking achievements: ${errorMessage}`);
      throw error;
    }
  }
}
