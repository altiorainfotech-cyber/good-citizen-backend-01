/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

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
import { Transform } from 'class-transformer';

export class RouteQueryDto {
  @ApiProperty({ description: 'Origin latitude', example: 28.6139 })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  originLat: number;

  @ApiProperty({ description: 'Origin longitude', example: 77.209 })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  originLng: number;

  @ApiProperty({ description: 'Destination latitude', example: 28.7041 })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  destinationLat: number;

  @ApiProperty({ description: 'Destination longitude', example: 77.1025 })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  destinationLng: number;

  @ApiProperty({
    description: 'Route type preference',
    enum: ['fastest', 'shortest', 'avoid_tolls'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['fastest', 'shortest', 'avoid_tolls'])
  routeType?: string;

  @ApiProperty({
    description: 'Include traffic information',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeTraffic?: boolean;
}

export class FacilityDetailQueryDto {
  @ApiProperty({
    description: 'Facility ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  facilityId: string;

  @ApiProperty({
    description: 'Include real-time capacity',
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCapacity?: boolean;

  @ApiProperty({
    description: 'Include operating hours',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeHours?: boolean;
}

export class StationDetailQueryDto {
  @ApiProperty({
    description: 'Station ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  stationId: string;

  @ApiProperty({
    description: 'Include service details',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeServices?: boolean;

  @ApiProperty({
    description: 'Include contact information',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeContact?: boolean;
}

export class HospitalDetailQueryDto {
  @ApiProperty({
    description: 'Hospital ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  hospitalId: string;

  @ApiProperty({
    description: 'Include specialties',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSpecialties?: boolean;

  @ApiProperty({
    description: 'Include real-time capacity',
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCapacity?: boolean;

  @ApiProperty({
    description: 'Include emergency services',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeEmergency?: boolean;
}

export class PaymentMethodsQueryDto {
  @ApiProperty({
    description: 'User location latitude for regional payment methods',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  latitude?: number;

  @ApiProperty({
    description: 'User location longitude for regional payment methods',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  longitude?: number;

  @ApiProperty({
    description: 'Currency preference',
    required: false,
    default: 'INR',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Include processing fees',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeFees?: boolean;
}
