import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class GetAssistImpactDto {
  @ApiProperty({
    description: 'Assist ID to get impact data for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  assistId: string;
}

export class CompleteAssistDto {
  @ApiProperty({
    description: 'Additional notes about the assist completion',
    example: 'Successfully provided navigation assistance',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Actual response time in minutes',
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualResponseTime?: number;
}

export class GetUserImpactSummaryDto {
  @ApiProperty({
    description: 'Limit number of assists to include in calculation',
    example: 50,
    required: false,
    default: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 100;
}

export class ImpactMetricsResponseDto {
  @ApiProperty({
    description: 'Time saved in minutes',
    example: 15,
  })
  timeSaved: number;

  @ApiProperty({
    description: 'Number of lives potentially affected',
    example: 2,
  })
  livesAffected: number;

  @ApiProperty({
    description: 'Response time improvement percentage',
    example: 25,
  })
  responseTimeImprovement: number;

  @ApiProperty({
    description: 'Community contribution points earned',
    example: 75,
  })
  communityContribution: number;
}

export class UserImpactSummaryResponseDto {
  @ApiProperty({
    description: 'Total number of assists completed',
    example: 12,
  })
  totalAssists: number;

  @ApiProperty({
    description: 'Total time saved across all assists (minutes)',
    example: 180,
  })
  totalTimeSaved: number;

  @ApiProperty({
    description: 'Total lives affected across all assists',
    example: 24,
  })
  totalLivesAffected: number;

  @ApiProperty({
    description: 'Average response time improvement percentage',
    example: 22.5,
  })
  averageResponseTimeImprovement: number;

  @ApiProperty({
    description: 'Total community contribution points earned',
    example: 900,
  })
  totalCommunityContribution: number;

  @ApiProperty({
    description: 'Breakdown of assists by emergency type',
    example: { ambulance: 5, medical: 4, fire: 2, police: 1 },
  })
  impactsByType: Record<string, number>;
}

export class CommunityImpactStatsResponseDto {
  @ApiProperty({
    description: 'Total assists across all users',
    example: 1250,
  })
  totalAssists: number;

  @ApiProperty({
    description: 'Total time saved community-wide (minutes)',
    example: 18750,
  })
  totalTimeSaved: number;

  @ApiProperty({
    description: 'Total lives affected community-wide',
    example: 2500,
  })
  totalLivesAffected: number;

  @ApiProperty({
    description: 'Average response time improvement across community',
    example: 23.8,
  })
  averageResponseTimeImprovement: number;

  @ApiProperty({
    description: 'Total community contribution points',
    example: 93750,
  })
  totalCommunityContribution: number;

  @ApiProperty({
    description: 'Top contributors to community impact',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
        userName: { type: 'string', example: 'John Doe' },
        totalAssists: { type: 'number', example: 45 },
        totalContribution: { type: 'number', example: 2250 },
      },
    },
  })
  topContributors: Array<{
    userId: string;
    userName: string;
    totalAssists: number;
    totalContribution: number;
  }>;
}