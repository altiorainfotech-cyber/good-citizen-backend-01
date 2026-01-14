/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  Min,
  Max,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmergencyRequestDto {
  @ApiProperty({
    description: 'Type of emergency',
    enum: ['ambulance', 'police', 'fire', 'medical', 'general'],
    example: 'ambulance',
  })
  @IsString()
  @IsEnum(['ambulance', 'police', 'fire', 'medical', 'general'])
  emergencyType: string;

  @ApiProperty({
    description: 'Latitude of emergency location',
    example: 28.6139,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @ApiProperty({
    description: 'Longitude of emergency location',
    example: 77.209,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;

  @ApiProperty({
    description: 'Address of emergency location',
    example: 'Connaught Place, New Delhi',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Priority level of emergency',
    enum: ['low', 'medium', 'high', 'critical'],
    example: 'high',
  })
  @IsString()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority: string;

  @ApiProperty({
    description: 'Detailed description of emergency',
    example: 'Person unconscious, needs immediate medical attention',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Contact number for emergency',
    example: '+91-9876543210',
  })
  @IsOptional()
  @IsString()
  contactNumber?: string;
}

export class UpdateEmergencyRequestDto {
  @ApiPropertyOptional({
    description: 'Status of emergency request',
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    example: 'assigned',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({
    description: 'ID of assigned ambulance provider',
  })
  @IsOptional()
  @IsString()
  assignedProviderId?: string;

  @ApiPropertyOptional({
    description: 'Estimated response time in minutes',
    example: 15,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedResponseTime?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class EmergencyRequestQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by emergency type',
    enum: ['ambulance', 'police', 'fire', 'medical', 'general'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['ambulance', 'police', 'fire', 'medical', 'general'])
  emergencyType?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by priority',
    enum: ['low', 'medium', 'high', 'critical'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @ApiPropertyOptional({
    description: 'Latitude for location-based filtering',
    example: 28.6139,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude for location-based filtering',
    example: 77.209,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Search radius in kilometers',
    example: 10,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  radius?: number = 20;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  pagination?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;
}

export class EmergencyContactQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by service type',
    enum: ['police', 'fire', 'medical', 'ambulance', 'general', 'disaster'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['police', 'fire', 'medical', 'ambulance', 'general', 'disaster'])
  serviceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by scope',
    enum: ['national', 'state', 'city', 'local'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['national', 'state', 'city', 'local'])
  scope?: string;

  @ApiPropertyOptional({
    description: 'Filter by state',
    example: 'Delhi',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'New Delhi',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Latitude for location-based filtering',
    example: 28.6139,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude for location-based filtering',
    example: 77.209,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Search radius in kilometers',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  radius?: number = 50;
}

export class AmbulanceAvailabilityUpdateDto {
  @ApiProperty({
    description: 'Ambulance provider ID',
  })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({
    description: 'Availability status',
    example: true,
  })
  @IsBoolean()
  availability: boolean;

  @ApiPropertyOptional({
    description: 'Current latitude',
    example: 28.6139,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Current longitude',
    example: 77.209,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Current response time in minutes',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  responseTime?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
