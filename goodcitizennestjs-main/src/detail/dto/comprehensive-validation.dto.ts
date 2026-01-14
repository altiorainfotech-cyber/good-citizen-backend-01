/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  IsValidLatitude,
  IsValidLongitude,
} from '../../common/validation/validation.decorators';
import {
  IsValidObjectId,
  IsValidTimeRange,
  IsValidCurrencyCode,
  IsValidCapacity,
  IsValidCoordinateArray,
  IsValidIndianMobile,
} from '../../common/validation/business-rules.decorators';
import {
  TrimString,
  NormalizePhoneNumber,
  ParseCoordinates,
  NormalizeCurrency,
  ParseBoolean,
  ParseNumber,
  NormalizeEnum,
} from '../../common/validation/sanitization.pipe';

// Enhanced Route Detail Query DTO
export class EnhancedRouteDetailQueryDto {
  @ApiProperty({
    description: 'Route or assistance ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'Route ID must be a string' })
  @IsValidObjectId({ message: 'Invalid route ID format' })
  routeId: string;

  @ApiPropertyOptional({
    description: 'Include turn-by-turn navigation',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include navigation must be a boolean value' })
  @ParseBoolean()
  includeNavigation?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include traffic conditions',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include traffic must be a boolean value' })
  @ParseBoolean()
  includeTraffic?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include estimated times',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include times must be a boolean value' })
  @ParseBoolean()
  includeTimes?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include alternative routes',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include alternatives must be a boolean value' })
  @ParseBoolean()
  includeAlternatives?: boolean = false;

  @ApiPropertyOptional({
    description: 'Maximum number of alternative routes',
    example: 2,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max alternatives must be a valid number' })
  @Min(1, { message: 'Max alternatives must be at least 1' })
  @Max(5, { message: 'Max alternatives cannot exceed 5' })
  @Type(() => Number)
  maxAlternatives?: number = 2;
}

// Enhanced Station Detail Query DTO
export class EnhancedStationDetailQueryDto {
  @ApiProperty({
    description: 'Station ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'Station ID must be a string' })
  @IsValidObjectId({ message: 'Invalid station ID format' })
  stationId: string;

  @ApiPropertyOptional({
    description: 'Include service details',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include services must be a boolean value' })
  @ParseBoolean()
  includeServices?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include contact information',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include contact must be a boolean value' })
  @ParseBoolean()
  includeContact?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include operating hours',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include hours must be a boolean value' })
  @ParseBoolean()
  includeHours?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include real-time availability',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include availability must be a boolean value' })
  @ParseBoolean()
  includeAvailability?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include pricing information',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include pricing must be a boolean value' })
  @ParseBoolean()
  includePricing?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include facility amenities',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include amenities must be a boolean value' })
  @ParseBoolean()
  includeAmenities?: boolean = false;
}

// Enhanced Hospital Detail Query DTO
export class EnhancedHospitalDetailQueryDto {
  @ApiProperty({
    description: 'Hospital ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'Hospital ID must be a string' })
  @IsValidObjectId({ message: 'Invalid hospital ID format' })
  hospitalId: string;

  @ApiPropertyOptional({
    description: 'Include medical specialties',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include specialties must be a boolean value' })
  @ParseBoolean()
  includeSpecialties?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include real-time capacity',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include capacity must be a boolean value' })
  @ParseBoolean()
  includeCapacity?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include emergency services',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include emergency must be a boolean value' })
  @ParseBoolean()
  includeEmergency?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include doctor information',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include doctors must be a boolean value' })
  @ParseBoolean()
  includeDoctors?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include insurance accepted',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include insurance must be a boolean value' })
  @ParseBoolean()
  includeInsurance?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include patient reviews',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include reviews must be a boolean value' })
  @ParseBoolean()
  includeReviews?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include bed availability by department',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include bed availability must be a boolean value' })
  @ParseBoolean()
  includeBedAvailability?: boolean = false;
}

// Enhanced Payment Methods Query DTO
export class EnhancedPaymentMethodsDetailQueryDto {
  @ApiPropertyOptional({
    description: 'User location latitude for regional payment methods',
    example: 28.6139,
    minimum: -90,
    maximum: 90,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @IsValidLatitude({ message: 'Invalid latitude coordinate' })
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'User location longitude for regional payment methods',
    example: 77.209,
    minimum: -180,
    maximum: 180,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @IsValidLongitude({ message: 'Invalid longitude coordinate' })
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Currency preference',
    example: 'INR',
    default: 'INR',
  })
  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @IsValidCurrencyCode({ message: 'Invalid currency code' })
  @NormalizeCurrency()
  currency?: string = 'INR';

  @ApiPropertyOptional({
    description: 'Include processing fees',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include fees must be a boolean value' })
  @ParseBoolean()
  includeFees?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include supported features',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include features must be a boolean value' })
  @ParseBoolean()
  includeFeatures?: boolean = true;

  @ApiPropertyOptional({
    description: 'Filter by payment type',
    example: ['card', 'wallet', 'upi'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Payment types must be an array' })
  @IsString({ each: true, message: 'Each payment type must be a string' })
  @ArrayMaxSize(10, { message: 'Cannot filter by more than 10 payment types' })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => v.toLowerCase().trim()) : [value],
  )
  paymentTypes?: string[];

  @ApiPropertyOptional({
    description: 'Minimum transaction amount for filtering',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min amount must be a valid number' })
  @Min(0, { message: 'Min amount cannot be negative' })
  @Type(() => Number)
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum transaction amount for filtering',
    example: 100000,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max amount must be a valid number' })
  @Min(1, { message: 'Max amount must be at least 1' })
  @Type(() => Number)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Include international payment methods',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include international must be a boolean value' })
  @ParseBoolean()
  includeInternational?: boolean = false;
}

// Create/Update DTOs for Detail Services
export class CreateFacilityDetailDto {
  @ApiProperty({
    description: 'Facility name',
    example: 'Apollo Hospital',
    minLength: 2,
    maxLength: 200,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @Length(2, 200, { message: 'Name must be between 2 and 200 characters' })
  @TrimString()
  name: string;

  @ApiProperty({
    description: 'Facility type',
    enum: ['hospital', 'clinic', 'blood_bank', 'ambulance_service', 'pharmacy'],
    example: 'hospital',
  })
  @IsEnum(
    ['hospital', 'clinic', 'blood_bank', 'ambulance_service', 'pharmacy'],
    { message: 'Invalid facility type' },
  )
  @NormalizeEnum()
  type: string;

  @ApiProperty({
    description: 'Facility coordinates [longitude, latitude]',
    example: [77.209, 28.6139],
    type: [Number],
  })
  @IsArray({ message: 'Location must be an array of coordinates' })
  @IsValidCoordinateArray({ message: 'Invalid location coordinates' })
  @ParseCoordinates()
  location: [number, number];

  @ApiProperty({
    description: 'Facility address',
    example: 'Sarita Vihar, New Delhi, 110076',
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address is required' })
  @Length(10, 500, { message: 'Address must be between 10 and 500 characters' })
  @TrimString()
  address: string;

  @ApiPropertyOptional({
    description: 'Services offered',
    example: ['emergency', 'cardiology', 'neurology'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Services must be an array' })
  @IsString({ each: true, message: 'Each service must be a string' })
  @ArrayMaxSize(20, { message: 'Cannot have more than 20 services' })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => v.toLowerCase().trim()) : [value],
  )
  services?: string[];

  @ApiPropertyOptional({
    description: 'Operating hours by day',
    example: {
      monday: '09:00-17:00',
      tuesday: '09:00-17:00',
      sunday: '24/7',
    },
  })
  @IsOptional()
  operatingHours?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Contact information',
    example: {
      phone: '+91-11-26925858',
      emergency: '+91-11-26925800',
      email: 'info@apollohospital.com',
    },
  })
  @IsOptional()
  contactInfo?: {
    phone?: string;
    emergency?: string;
    email?: string;
    website?: string;
  };

  @ApiPropertyOptional({
    description: 'Current capacity',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Capacity must be a valid number' })
  @IsValidCapacity({ message: 'Invalid capacity value' })
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Is facility currently active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active must be a boolean value' })
  @ParseBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { accreditation: 'NABH', established: '1983' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateFacilityDetailDto {
  @ApiPropertyOptional({
    description: 'Facility name',
    minLength: 2,
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Length(2, 200, { message: 'Name must be between 2 and 200 characters' })
  @TrimString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Facility coordinates [longitude, latitude]',
    type: [Number],
  })
  @IsOptional()
  @IsArray({ message: 'Location must be an array of coordinates' })
  @IsValidCoordinateArray({ message: 'Invalid location coordinates' })
  @ParseCoordinates()
  location?: [number, number];

  @ApiPropertyOptional({
    description: 'Facility address',
    minLength: 10,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @Length(10, 500, { message: 'Address must be between 10 and 500 characters' })
  @TrimString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Services offered',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Services must be an array' })
  @IsString({ each: true, message: 'Each service must be a string' })
  @ArrayMaxSize(20, { message: 'Cannot have more than 20 services' })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => v.toLowerCase().trim()) : [value],
  )
  services?: string[];

  @ApiPropertyOptional({
    description: 'Operating hours by day',
  })
  @IsOptional()
  operatingHours?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Contact information',
  })
  @IsOptional()
  contactInfo?: {
    phone?: string;
    emergency?: string;
    email?: string;
    website?: string;
  };

  @ApiPropertyOptional({
    description: 'Current capacity',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Capacity must be a valid number' })
  @IsValidCapacity({ message: 'Invalid capacity value' })
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Is facility currently active',
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active must be a boolean value' })
  @ParseBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

// Bulk Operations DTOs
export class BulkFacilityUpdateDto {
  @ApiProperty({
    description: 'Array of facility IDs to update',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String],
  })
  @IsArray({ message: 'Facility IDs must be an array' })
  @IsString({ each: true, message: 'Each facility ID must be a string' })
  @ArrayMinSize(1, { message: 'At least one facility ID must be provided' })
  @ArrayMaxSize(50, {
    message: 'Cannot update more than 50 facilities at once',
  })
  facilityIds: string[];

  @ApiProperty({
    description: 'Update data to apply to all facilities',
  })
  @ValidateNested()
  @Type(() => UpdateFacilityDetailDto)
  updateData: UpdateFacilityDetailDto;
}
