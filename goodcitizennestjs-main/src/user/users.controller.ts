/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/enhanced-jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/enhanced-roles.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from '../common/utils';
import { RewardsService } from './rewards.service';
import {
  GetAmbulanceAssistsDto,
  AmbulanceAssistDto,
} from './dto/rewards-history.dto';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly rewardsService: RewardsService) {}

  /**
   * Get user's ambulance assistance history with detailed records
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/ambulance-assists')
  async getUserAmbulanceAssists(
    @Param('id') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Req() req?: any,
  ): Promise<{
    assists: any[];
    total: number;
    hasMore: boolean;
    stats: {
      totalAssists: number;
      successfulAssists: number;
      pointsEarned: number;
      assistsByType: Record<string, number>;
    };
  }> {
    try {
      this.logger.log(`Getting ambulance assists for user ${userId}`);

      const limitValue = Math.min(limit || 20, 100); // Max 100 items per request
      const offsetValue = offset || 0;

      const allAssists = await this.rewardsService.getUserAmbulanceAssists(
        userId,
        1000,
      ); // Get all for stats
      const paginatedAssists = allAssists.slice(
        offsetValue,
        offsetValue + limitValue,
      );
      const hasMore = allAssists.length > offsetValue + limitValue;

      // Calculate statistics
      const stats = {
        totalAssists: allAssists.length,
        successfulAssists: allAssists.filter(
          (assist) => assist.outcome === 'successful',
        ).length,
        pointsEarned: allAssists.reduce(
          (total, assist) => total + assist.pointsEarned,
          0,
        ),
        assistsByType: allAssists.reduce(
          (acc, assist) => {
            acc[assist.assistType] = (acc[assist.assistType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      };

      return {
        assists: paginatedAssists,
        total: allAssists.length,
        hasMore,
        stats,
      };
    } catch (error: any) {
      this.logger.error(`Error getting ambulance assists: ${error.message}`);
      throw error;
    }
  }
}
