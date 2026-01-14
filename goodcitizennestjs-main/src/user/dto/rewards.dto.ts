import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class RedeemRewardDto {
  @IsString()
  user_id!: string;

  @IsString()
  reward_id!: string;
}

export class RewardCatalogItemDto {
  @IsString()
  reward_id!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(1)
  points_required!: number;

  @IsEnum(['DISCOUNT', 'FREE_RIDE', 'MERCHANDISE', 'DONATION', 'SPECIAL'])
  category!: string;

  @IsString()
  value!: string;

  @IsBoolean()
  is_available!: boolean;

  @IsBoolean()
  user_can_redeem!: boolean;

  @IsOptional()
  @IsNumber()
  user_redemption_count?: number;

  @IsOptional()
  @IsNumber()
  remaining_stock?: number;
}

export class RedemptionResultDto {
  @IsString()
  redemption_id!: string;

  @IsString()
  redemption_code!: string;

  @IsString()
  reward_name!: string;

  @IsNumber()
  points_spent!: number;

  @IsEnum(['PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED', 'EXPIRED'])
  status!: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsString()
  instructions!: string;
}

export class RedemptionHistoryItemDto {
  @IsString()
  redemption_id!: string;

  @IsString()
  redemption_code!: string;

  @IsString()
  reward_name!: string;

  @IsString()
  reward_value!: string;

  @IsNumber()
  points_spent!: number;

  @IsEnum(['PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED', 'EXPIRED'])
  status!: string;

  @IsDateString()
  redeemed_at!: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsDateString()
  fulfilled_at?: string;
}

export class ValidateRedemptionCodeDto {
  @IsString()
  redemption_code!: string;
}

export class FulfillRedemptionDto {
  @IsString()
  redemption_code!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetRedemptionHistoryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class RedemptionStatsDto {
  @IsNumber()
  total_redemptions!: number;

  @IsNumber()
  total_points_spent!: number;

  redemptions_by_category!: Record<string, number>;

  top_rewards!: Array<{
    reward_name: string;
    redemption_count: number;
  }>;
}
