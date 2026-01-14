/* eslint-disable @typescript-eslint/no-unused-vars */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  Min,
  Max,
  Length,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  IsValidObjectId,
  IsValidResponseTime,
} from '../../common/validation/business-rules.decorators';
import {
  TrimString,
  ParseBoolean,
  ParseNumber,
  NormalizeEnum,
} from '../../common/validation/sanitization.pipe';

// Enhanced Rewards History Query DTO
export class EnhancedRewardsHistoryQueryDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsValidObjectId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: [
      'ambulance_assist',
      'ride_completion',
      'community_help',
      'emergency_response',
      'blood_donation',
      'volunteer_work',
    ],
    example: 'ambulance_assist',
  })
  @IsOptional()
  @IsEnum(
    [
      'ambulance_assist',
      'ride_completion',
      'community_help',
      'emergency_response',
      'blood_donation',
      'volunteer_work',
    ],
    { message: 'Invalid action type' },
  )
  @NormalizeEnum()
  actionType?: string;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Minimum points earned',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min points must be a valid number' })
  @Min(0, { message: 'Min points cannot be negative' })
  @Type(() => Number)
  minPoints?: number;

  @ApiPropertyOptional({
    description: 'Maximum points earned',
    example: 1000,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max points must be a valid number' })
  @Min(1, { message: 'Max points must be at least 1' })
  @Type(() => Number)
  maxPoints?: number;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Page must be a valid number' })
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of results per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Limit must be a valid number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be asc or desc' })
  @NormalizeEnum()
  sortOrder?: string = 'desc';

  @ApiPropertyOptional({
    description: 'Include metadata in response',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include metadata must be a boolean value' })
  @ParseBoolean()
  includeMetadata?: boolean = false;
}

// Enhanced Achievements Query DTO
export class EnhancedAchievementsQueryDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsValidObjectId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Filter by achievement category',
    enum: [
      'community',
      'safety',
      'loyalty',
      'emergency',
      'health',
      'volunteer',
    ],
    example: 'emergency',
  })
  @IsOptional()
  @IsEnum(
    ['community', 'safety', 'loyalty', 'emergency', 'health', 'volunteer'],
    { message: 'Invalid achievement category' },
  )
  @NormalizeEnum()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by unlock status',
    enum: ['all', 'unlocked', 'locked', 'in_progress'],
    example: 'unlocked',
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['all', 'unlocked', 'locked', 'in_progress'], {
    message: 'Invalid unlock status',
  })
  @NormalizeEnum()
  status?: string = 'all';

  @ApiPropertyOptional({
    description: 'Minimum progress percentage',
    example: 50,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min progress must be a valid number' })
  @Min(0, { message: 'Min progress cannot be negative' })
  @Max(100, { message: 'Min progress cannot exceed 100' })
  @Type(() => Number)
  minProgress?: number;

  @ApiPropertyOptional({
    description: 'Include achievement requirements',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include requirements must be a boolean value' })
  @ParseBoolean()
  includeRequirements?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include progress details',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include progress must be a boolean value' })
  @ParseBoolean()
  includeProgress?: boolean = true;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['name', 'category', 'progress', 'unlockedAt', 'pointsReward'],
    example: 'progress',
    default: 'progress',
  })
  @IsOptional()
  @IsEnum(['name', 'category', 'progress', 'unlockedAt', 'pointsReward'], {
    message: 'Invalid sort field',
  })
  @NormalizeEnum()
  sortBy?: string = 'progress';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be asc or desc' })
  @NormalizeEnum()
  sortOrder?: string = 'desc';
}

// Enhanced Ambulance Assists Query DTO
export class EnhancedAmbulanceAssistsQueryDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsValidObjectId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Filter by assist type',
    enum: [
      'navigation',
      'emergency_contact',
      'facility_info',
      'blood_bank_info',
      'ambulance_booking',
    ],
    example: 'navigation',
  })
  @IsOptional()
  @IsEnum(
    [
      'navigation',
      'emergency_contact',
      'facility_info',
      'blood_bank_info',
      'ambulance_booking',
    ],
    { message: 'Invalid assist type' },
  )
  @NormalizeEnum()
  assistType?: string;

  @ApiPropertyOptional({
    description: 'Filter by outcome',
    enum: ['successful', 'cancelled', 'redirected', 'failed'],
    example: 'successful',
  })
  @IsOptional()
  @IsEnum(['successful', 'cancelled', 'redirected', 'failed'], {
    message: 'Invalid outcome',
  })
  @NormalizeEnum()
  outcome?: string;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Minimum points earned',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min points must be a valid number' })
  @Min(0, { message: 'Min points cannot be negative' })
  @Type(() => Number)
  minPointsEarned?: number;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Page must be a valid number' })
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of results per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Limit must be a valid number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Include location details',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include location must be a boolean value' })
  @ParseBoolean()
  includeLocation?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include response time statistics',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include stats must be a boolean value' })
  @ParseBoolean()
  includeStats?: boolean = false;
}

// Create Reward Entry DTO
export class CreateRewardEntryDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsValidObjectId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiProperty({
    description: 'Action type',
    enum: [
      'ambulance_assist',
      'ride_completion',
      'community_help',
      'emergency_response',
      'blood_donation',
      'volunteer_work',
    ],
    example: 'ambulance_assist',
  })
  @IsEnum(
    [
      'ambulance_assist',
      'ride_completion',
      'community_help',
      'emergency_response',
      'blood_donation',
      'volunteer_work',
    ],
    { message: 'Invalid action type' },
  )
  @NormalizeEnum()
  action: string;

  @ApiProperty({
    description: 'Points earned',
    example: 50,
    minimum: 1,
    maximum: 10000,
  })
  @IsNumber({}, { message: 'Points must be a valid number' })
  @Min(1, { message: 'Points must be at least 1' })
  @Max(10000, { message: 'Points cannot exceed 10000' })
  @Type(() => Number)
  points: number;

  @ApiProperty({
    description: 'Description of the action',
    example: 'Provided navigation assistance to ambulance',
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: 'Description must be a string' })
  @IsNotEmpty({ message: 'Description is required' })
  @Length(10, 500, {
    message: 'Description must be between 10 and 500 characters',
  })
  @TrimString()
  description: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the action (ISO string)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Timestamp must be a valid ISO date string' })
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: {
      emergency_type: 'medical',
      response_time: 12,
      location: 'New Delhi',
    },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Reference ID for the related entity',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString({ message: 'Reference ID must be a string' })
  @IsValidObjectId({ message: 'Invalid reference ID format' })
  referenceId?: string;
}

// Create Ambulance Assist Entry DTO
export class CreateAmbulanceAssistDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsValidObjectId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiProperty({
    description: 'Type of assistance provided',
    enum: [
      'navigation',
      'emergency_contact',
      'facility_info',
      'blood_bank_info',
      'ambulance_booking',
    ],
    example: 'navigation',
  })
  @IsEnum(
    [
      'navigation',
      'emergency_contact',
      'facility_info',
      'blood_bank_info',
      'ambulance_booking',
    ],
    { message: 'Invalid assist type' },
  )
  @NormalizeEnum()
  assistType: string;

  @ApiProperty({
    description: 'Location where assistance was provided [longitude, latitude]',
    example: [77.209, 28.6139],
    type: [Number],
  })
  @IsArray({ message: 'Location must be an array of coordinates' })
  @ArrayMinSize(2, { message: 'Location must have exactly 2 coordinates' })
  @ArrayMaxSize(2, { message: 'Location must have exactly 2 coordinates' })
  @IsNumber({}, { each: true, message: 'Each coordinate must be a number' })
  location: [number, number];

  @ApiProperty({
    description: 'Outcome of the assistance',
    enum: ['successful', 'cancelled', 'redirected', 'failed'],
    example: 'successful',
  })
  @IsEnum(['successful', 'cancelled', 'redirected', 'failed'], {
    message: 'Invalid outcome',
  })
  @NormalizeEnum()
  outcome: string;

  @ApiProperty({
    description: 'Points earned for this assistance',
    example: 25,
    minimum: 1,
    maximum: 1000,
  })
  @IsNumber({}, { message: 'Points earned must be a valid number' })
  @Min(1, { message: 'Points earned must be at least 1' })
  @Max(1000, { message: 'Points earned cannot exceed 1000' })
  @Type(() => Number)
  pointsEarned: number;

  @ApiPropertyOptional({
    description: 'Timestamp of the assistance (ISO string)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Timestamp must be a valid ISO date string' })
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Response time in minutes (if applicable)',
    example: 8,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Response time must be a valid number' })
  @IsValidResponseTime({ message: 'Invalid response time' })
  @Type(() => Number)
  responseTime?: number;

  @ApiPropertyOptional({
    description: 'Emergency request ID (if related to an emergency)',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString({ message: 'Emergency request ID must be a string' })
  @IsValidObjectId({ message: 'Invalid emergency request ID format' })
  emergencyRequestId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: {
      ambulance_provider: 'Apollo Ambulance',
      patient_condition: 'stable',
      hospital_reached: 'AIIMS',
    },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

// Update Achievement Progress DTO
export class UpdateAchievementProgressDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsValidObjectId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiProperty({
    description: 'Achievement ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsString({ message: 'Achievement ID must be a string' })
  @IsValidObjectId({ message: 'Invalid achievement ID format' })
  achievementId: string;

  @ApiProperty({
    description: 'Progress increment',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber({}, { message: 'Progress increment must be a valid number' })
  @Min(1, { message: 'Progress increment must be at least 1' })
  @Max(100, { message: 'Progress increment cannot exceed 100' })
  @Type(() => Number)
  progressIncrement: number;

  @ApiPropertyOptional({
    description: 'Action that triggered the progress',
    example: 'ambulance_assist',
  })
  @IsOptional()
  @IsString({ message: 'Trigger action must be a string' })
  @TrimString()
  triggerAction?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { assist_count: 5, total_points: 125 },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

// Bulk Operations DTOs
export class BulkRewardUpdateDto {
  @ApiProperty({
    description: 'Array of user IDs to update',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String],
  })
  @IsArray({ message: 'User IDs must be an array' })
  @IsString({ each: true, message: 'Each user ID must be a string' })
  @ArrayMinSize(1, { message: 'At least one user ID must be provided' })
  @ArrayMaxSize(100, { message: 'Cannot update more than 100 users at once' })
  userIds: string[];

  @ApiProperty({
    description: 'Reward data to apply to all users',
  })
  @ValidateNested()
  @Type(() => CreateRewardEntryDto)
  rewardData: Omit<CreateRewardEntryDto, 'userId'>;
}
