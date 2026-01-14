/* eslint-disable @typescript-eslint/no-unsafe-return */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class BaseLocationQueryDto {
  @ApiProperty({ description: 'Latitude coordinate', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ description: 'Longitude coordinate', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    description: 'Search radius in kilometers',
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radius?: number;

  @ApiProperty({
    description: 'Pagination offset',
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pagination?: number;

  @ApiProperty({ description: 'Results limit', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class HospitalQueryDto extends BaseLocationQueryDto {
  @ApiProperty({
    description: 'Filter by medical specialties',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  specialties?: string[];
}

export enum VehicleType {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  CRITICAL = 'critical',
}

export class AmbulanceQueryDto extends BaseLocationQueryDto {
  @ApiProperty({
    description: 'Filter by vehicle type',
    required: false,
    enum: VehicleType,
  })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

export class BloodBankQueryDto extends BaseLocationQueryDto {
  @ApiProperty({
    description: 'Filter by blood type availability',
    required: false,
    enum: BloodType,
  })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;
}

export enum EmergencyServiceType {
  GENERAL = 'general',
  POLICE = 'police',
  FIRE = 'fire',
  MEDICAL = 'medical',
}

export class EmergencyServicesQueryDto {
  @ApiProperty({ description: 'Latitude coordinate', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ description: 'Longitude coordinate', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    description: 'Filter by service type',
    required: false,
    enum: EmergencyServiceType,
  })
  @IsOptional()
  @IsEnum(EmergencyServiceType)
  serviceType?: EmergencyServiceType;
}

export enum HealthTipCategory {
  EMERGENCY = 'emergency',
  SAFETY = 'safety',
  HEALTH = 'health',
  WELLNESS = 'wellness',
}

export class HealthTipsQueryDto {
  @ApiProperty({
    description: 'Filter by tip category',
    required: false,
    enum: HealthTipCategory,
  })
  @IsOptional()
  @IsEnum(HealthTipCategory)
  category?: HealthTipCategory;

  @ApiProperty({
    description: 'Pagination offset',
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pagination?: number;

  @ApiProperty({ description: 'Results limit', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export enum StatsTimeframe {
  WEEK = '7d',
  MONTH = '30d',
  QUARTER = '90d',
  YEAR = '365d',
}

export class CommunityStatsQueryDto {
  @ApiProperty({
    description: 'Statistics timeframe',
    required: false,
    enum: StatsTimeframe,
    default: StatsTimeframe.MONTH,
  })
  @IsOptional()
  @IsEnum(StatsTimeframe)
  timeframe?: StatsTimeframe;
}
