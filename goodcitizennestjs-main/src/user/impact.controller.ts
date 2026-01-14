import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from '../common/utils';
import { ImpactCalculatorService } from './impact-calculator.service';
import {
  CompleteAssistDto,
  GetUserImpactSummaryDto,
  ImpactMetricsResponseDto,
  UserImpactSummaryResponseDto,
  CommunityImpactStatsResponseDto,
} from './dto/impact.dto';

@ApiTags('Impact Tracking')
@Controller('v1')
export class ImpactController {
  constructor(private readonly impactCalculatorService: ImpactCalculatorService) {}

  /**
   * Get impact metrics for a specific assist
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('assists/:id/impact')
  @ApiParam({ name: 'id', description: 'Assist ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get calculated impact metrics for a specific emergency assist',
    description: 'Returns the calculated impact metrics including time saved, lives affected, and community contribution points for a completed assist.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Impact metrics retrieved successfully',
    type: ImpactMetricsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Assist not found or impact not calculated',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authorized',
  })
  async getAssistImpact(@Param('id') assistId: string, @Req() req) {
    const impact = await this.impactCalculatorService.getAssistImpact(assistId);
    
    if (!impact) {
      throw new NotFoundException('Impact data not found for this assist');
    }

    return {
      success: true,
      data: impact.metrics,
      calculatedAt: impact.calculatedAt,
      metadata: {
        emergencyType: impact.calculationData.emergencyType,
        assistanceType: impact.calculationData.assistanceType,
        trafficConditions: impact.calculationData.trafficConditions,
      },
    };
  }

  /**
   * Complete an assist and calculate impact
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('assists/:id/complete')
  @ApiParam({ name: 'id', description: 'Assist ID to complete' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Mark an assist as complete and calculate impact metrics',
    description: 'Completes an emergency assist and triggers the calculation of impact metrics including time saved and community contribution.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Assist completed and impact calculated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Assist completed and impact calculated' },
        impact: { $ref: '#/components/schemas/ImpactMetricsResponseDto' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Assist not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User not authorized to complete this assist or assist already completed',
  })
  async completeAssist(
    @Param('id') assistId: string,
    @Body() dto: CompleteAssistDto,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.id;
    const result = await this.impactCalculatorService.completeAssist(assistId, userId);

    return {
      success: result.success,
      message: result.message,
      impact: result.impact,
    };
  }

  /**
   * Get user's aggregated impact summary
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('users/:userId/impact-summary')
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get aggregated impact summary for a user',
    description: 'Returns the total impact metrics across all assists completed by the user, including breakdowns by emergency type.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User impact summary retrieved successfully',
    type: UserImpactSummaryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authorized',
  })
  async getUserImpactSummary(
    @Param('userId') userId: string,
    @Query() dto: GetUserImpactSummaryDto,
    @Req() req,
  ) {
    // Users can only access their own impact summary
    const requestingUserId = req.user.sub || req.user.id;
    if (userId !== requestingUserId) {
      throw new NotFoundException('User impact summary not found');
    }

    const summary = await this.impactCalculatorService.aggregateUserImpact(userId);

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get community-wide impact statistics
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('community/impact-stats')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Get community-wide impact statistics',
    description: 'Returns aggregated impact metrics across all users in the community, including top contributors and overall statistics.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Community impact statistics retrieved successfully',
    type: CommunityImpactStatsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authorized',
  })
  async getCommunityImpactStats(@Req() req) {
    const stats = await this.impactCalculatorService.getCommunityImpactStats();

    return {
      success: true,
      data: stats,
    };
  }
}