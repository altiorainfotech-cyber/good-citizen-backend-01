import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class EmergencyAssistDto {
  @IsString()
  user_id!: string;

  @IsString()
  driver_id!: string;

  @IsString()
  ride_id!: string;

  @IsEnum(['AMBULANCE', 'FIRE', 'POLICE'])
  emergency_type!: 'AMBULANCE' | 'FIRE' | 'POLICE';

  @IsNumber()
  @Min(0)
  @Max(3600) // Max 1 hour response time
  time_saved_seconds!: number;

  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

export class LoyaltyPointsCalculationResponseDto {
  @IsNumber()
  points_awarded!: number;

  @IsString()
  reason!: string;

  @IsString()
  emergency_type!: string;

  @IsNumber()
  time_saved_seconds!: number;

  @IsNumber()
  multiplier!: number;

  @IsNumber()
  base_points!: number;
}

export class AchievementDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  icon!: string;

  @IsNumber()
  points_required!: number;

  @IsEnum(['EMERGENCY_HELPER', 'GOOD_CITIZEN', 'FREQUENT_USER', 'SPECIAL'])
  category!: 'EMERGENCY_HELPER' | 'GOOD_CITIZEN' | 'FREQUENT_USER' | 'SPECIAL';
}

export class UserAchievementStatusDto {
  @IsString()
  achievement_id!: string;

  @IsString()
  unlocked!: boolean;

  @IsOptional()
  @IsDateString()
  unlocked_at?: string;

  @IsNumber()
  progress!: number;

  @IsNumber()
  progress_max!: number;
}

export class LoyaltyPointsSummaryDto {
  @IsNumber()
  total_points!: number;

  @IsNumber()
  total_assists!: number;

  assists_by_type!: Record<string, number>;

  recent_assists!: any[];

  @ValidateNested({ each: true })
  @Type(() => UserAchievementStatusDto)
  achievements!: UserAchievementStatusDto[];
}

export class LeaderboardEntryDto {
  @IsString()
  user_id!: string;

  @IsString()
  name!: string;

  @IsNumber()
  loyalty_points!: number;

  @IsNumber()
  total_assists!: number;

  @IsNumber()
  rank!: number;
}

export class GetLeaderboardDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
