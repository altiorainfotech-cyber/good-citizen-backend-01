import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class GetRewardsHistoryDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class RewardHistoryItemDto {
  @IsString()
  id!: string;

  @IsString()
  userId!: string;

  @IsEnum(['ambulance_assist', 'ride_completion', 'community_help'])
  action!: string;

  @IsNumber()
  points!: number;

  @IsString()
  description!: string;

  @IsDateString()
  timestamp!: string;

  metadata!: Record<string, any>;
}

export class GetAchievementsDto {
  @IsString()
  userId!: string;
}

export class AchievementDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  category!: string;

  @IsString()
  badgeIcon!: string;

  requirements!: {
    requirementType: 'count' | 'streak' | 'milestone';
    target: number;
    action: string;
  };

  @IsNumber()
  pointsReward!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  progress!: number;

  @IsOptional()
  isUnlocked?: boolean;

  @IsOptional()
  @IsDateString()
  unlockedAt?: string;
}

export class GetAmbulanceAssistsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class AmbulanceAssistDto {
  @IsString()
  id!: string;

  @IsString()
  userId!: string;

  @IsEnum(['navigation', 'emergency_contact', 'facility_info'])
  assistType!: string;

  location!: [number, number];

  @IsDateString()
  timestamp!: string;

  @IsEnum(['successful', 'cancelled', 'redirected'])
  outcome!: string;

  @IsNumber()
  pointsEarned!: number;
}
