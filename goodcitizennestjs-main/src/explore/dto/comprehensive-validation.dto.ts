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
  IsEmail,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  IsValidLatitude,
  IsValidLongitude,
  IsValidPhoneNumber,
} from '../../common/validation/validation.decorators';
import {
  IsValidObjectId,
  IsValidEmergencyPriority,
  IsValidIndianPostalCode,
  IsValidTimeRange,
  IsValidCurrencyCode,
  IsValidBloodType,
  IsValidResponseTime,
  IsValidCapacity,
  IsValidCoordinateArray,
  IsValidIndianMobile,
} from '../../common/validation/business-rules.decorators';
import {
  TrimString,
  NormalizePhoneNumber,
  NormalizeEmail,
  ParseCoordinates,
  NormalizeCurrency,
  ParseBoolean,
  ParseNumber,
  NormalizeEnum,
} from '../../common/validation/sanitization.pipe';

// Enhanced Location Query DTOs
export class EnhancedLocationQueryDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 28.6139,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @IsValidLatitude({ message: 'Latitude must be between -90 and 90 degrees' })
  @Type(() => Number)
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 77.209,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @IsValidLongitude({
    message: 'Longitude must be between -180 and 180 degrees',
  })
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Search radius in kilometers',
    example: 10,
    minimum: 0.1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Radius must be a valid number' })
  @Min(0.1, { message: 'Radius must be at least 0.1 km' })
  @Max(100, { message: 'Radius cannot exceed 100 km' })
  @Type(() => Number)
  radius?: number = 10;

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
}

// Enhanced Hospital Query DTO
export class EnhancedHospitalQueryDto extends EnhancedLocationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by medical specialties',
    example: ['cardiology', 'emergency'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Specialties must be an array' })
  @IsString({ each: true, message: 'Each specialty must be a string' })
  @ArrayMinSize(1, { message: 'At least one specialty must be provided' })
  @ArrayMaxSize(10, { message: 'Cannot filter by more than 10 specialties' })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => v.toLowerCase().trim()) : [value],
  )
  specialties?: string[];

  @ApiPropertyOptional({
    description: 'Include only hospitals with emergency services',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Emergency only must be a boolean value' })
  @ParseBoolean()
  emergencyOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Minimum capacity required',
    example: 50,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Minimum capacity must be a valid number' })
  @Min(1, { message: 'Minimum capacity must be at least 1' })
  @IsValidCapacity({ message: 'Invalid capacity value' })
  @Type(() => Number)
  minCapacity?: number;
}

// Enhanced Ambulance Query DTO
export enum VehicleType {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  CRITICAL = 'critical',
  ICU = 'icu',
}

export class EnhancedAmbulanceQueryDto extends EnhancedLocationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by vehicle type',
    enum: VehicleType,
    example: VehicleType.ADVANCED,
  })
  @IsOptional()
  @IsEnum(VehicleType, { message: 'Invalid vehicle type' })
  @NormalizeEnum()
  vehicleType?: VehicleType;

  @ApiPropertyOptional({
    description: 'Maximum acceptable response time in minutes',
    example: 15,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max response time must be a valid number' })
  @IsValidResponseTime({ message: 'Invalid response time' })
  @Type(() => Number)
  maxResponseTime?: number;

  @ApiPropertyOptional({
    description: 'Include only available ambulances',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Available only must be a boolean value' })
  @ParseBoolean()
  availableOnly?: boolean = true;
}

// Enhanced Blood Bank Query DTO
export class EnhancedBloodBankQueryDto extends EnhancedLocationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by blood type availability',
    example: 'O+',
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  })
  @IsOptional()
  @IsString({ message: 'Blood type must be a string' })
  @IsValidBloodType({ message: 'Invalid blood type' })
  @TrimString()
  bloodType?: string;

  @ApiPropertyOptional({
    description: 'Minimum units required',
    example: 2,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Minimum units must be a valid number' })
  @Min(1, { message: 'Minimum units must be at least 1' })
  @Type(() => Number)
  minUnits?: number;

  @ApiPropertyOptional({
    description: 'Include operating hours',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include hours must be a boolean value' })
  @ParseBoolean()
  includeHours?: boolean = true;
}

// Enhanced Emergency Request DTO
export enum EmergencyType {
  AMBULANCE = 'ambulance',
  POLICE = 'police',
  FIRE = 'fire',
  MEDICAL = 'medical',
  DISASTER = 'disaster',
  GENERAL = 'general',
}

export enum EmergencyPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class EnhancedEmergencyRequestDto {
  @ApiProperty({
    description: 'Type of emergency',
    enum: EmergencyType,
    example: EmergencyType.AMBULANCE,
  })
  @IsEnum(EmergencyType, { message: 'Invalid emergency type' })
  @NormalizeEnum()
  emergencyType: EmergencyType;

  @ApiProperty({
    description: 'Latitude of emergency location',
    example: 28.6139,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @IsValidLatitude({ message: 'Invalid latitude coordinate' })
  @Type(() => Number)
  latitude: number;

  @ApiProperty({
    description: 'Longitude of emergency location',
    example: 77.209,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @IsValidLongitude({ message: 'Invalid longitude coordinate' })
  @Type(() => Number)
  longitude: number;

  @ApiProperty({
    description: 'Address of emergency location',
    example: 'Connaught Place, New Delhi, 110001',
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address is required' })
  @Length(10, 500, { message: 'Address must be between 10 and 500 characters' })
  @TrimString()
  address: string;

  @ApiProperty({
    description: 'Priority level of emergency',
    enum: EmergencyPriority,
    example: EmergencyPriority.HIGH,
  })
  @IsEnum(EmergencyPriority, { message: 'Invalid priority level' })
  @IsValidEmergencyPriority({ message: 'Invalid emergency priority' })
  @NormalizeEnum()
  priority: EmergencyPriority;

  @ApiProperty({
    description: 'Detailed description of emergency',
    example: 'Person unconscious, needs immediate medical attention',
    minLength: 20,
    maxLength: 1000,
  })
  @IsString({ message: 'Description must be a string' })
  @IsNotEmpty({ message: 'Description is required' })
  @Length(20, 1000, {
    message: 'Description must be between 20 and 1000 characters',
  })
  @TrimString()
  description: string;

  @ApiPropertyOptional({
    description: 'Contact number for emergency',
    example: '+91-9876543210',
  })
  @IsOptional()
  @IsString({ message: 'Contact number must be a string' })
  @IsValidIndianMobile({ message: 'Invalid Indian mobile number format' })
  @NormalizePhoneNumber()
  contactNumber?: string;

  @ApiPropertyOptional({
    description: 'Number of people affected',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'People count must be a valid number' })
  @Min(1, { message: 'People count must be at least 1' })
  @Max(100, { message: 'People count cannot exceed 100' })
  @Type(() => Number)
  peopleCount?: number = 1;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { medical_condition: 'cardiac_arrest', age_group: 'elderly' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

// Enhanced Facility Detail DTO
export class EnhancedFacilityDetailDto {
  @ApiProperty({
    description: 'Facility ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'Facility ID must be a string' })
  @IsValidObjectId({ message: 'Invalid facility ID format' })
  facilityId: string;

  @ApiPropertyOptional({
    description: 'Include real-time capacity information',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include capacity must be a boolean value' })
  @ParseBoolean()
  includeCapacity?: boolean = false;

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
    description: 'Include contact information',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include contact must be a boolean value' })
  @ParseBoolean()
  includeContact?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include services offered',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include services must be a boolean value' })
  @ParseBoolean()
  includeServices?: boolean = true;
}

// Enhanced Payment Methods Query DTO
export class EnhancedPaymentMethodsQueryDto {
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
    description: 'Filter by payment type',
    example: ['card', 'wallet', 'upi'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Payment types must be an array' })
  @IsString({ each: true, message: 'Each payment type must be a string' })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => v.toLowerCase().trim()) : [value],
  )
  paymentTypes?: string[];
}

// Enhanced Route Query DTO
export class EnhancedRouteQueryDto {
  @ApiProperty({
    description: 'Origin coordinates [longitude, latitude]',
    example: [77.209, 28.6139],
    type: [Number],
  })
  @IsArray({ message: 'Origin must be an array of coordinates' })
  @IsValidCoordinateArray({ message: 'Invalid origin coordinates' })
  @ParseCoordinates()
  origin: [number, number];

  @ApiProperty({
    description: 'Destination coordinates [longitude, latitude]',
    example: [77.1025, 28.7041],
    type: [Number],
  })
  @IsArray({ message: 'Destination must be an array of coordinates' })
  @IsValidCoordinateArray({ message: 'Invalid destination coordinates' })
  @ParseCoordinates()
  destination: [number, number];

  @ApiPropertyOptional({
    description: 'Route type preference',
    enum: ['fastest', 'shortest', 'avoid_tolls', 'avoid_highways'],
    example: 'fastest',
    default: 'fastest',
  })
  @IsOptional()
  @IsEnum(['fastest', 'shortest', 'avoid_tolls', 'avoid_highways'], {
    message: 'Invalid route type',
  })
  @NormalizeEnum()
  routeType?: string = 'fastest';

  @ApiPropertyOptional({
    description: 'Include traffic information',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include traffic must be a boolean value' })
  @ParseBoolean()
  includeTraffic?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include turn-by-turn instructions',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include instructions must be a boolean value' })
  @ParseBoolean()
  includeInstructions?: boolean = true;

  @ApiPropertyOptional({
    description: 'Waypoints for the route [longitude, latitude]',
    example: [[77.15, 28.65]],
    type: [Array],
  })
  @IsOptional()
  @IsArray({ message: 'Waypoints must be an array' })
  @ValidateNested({ each: true })
  @ArrayMaxSize(5, { message: 'Cannot have more than 5 waypoints' })
  waypoints?: [number, number][];
}
