import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsValidLatitude,
  IsValidLongitude,
  IsValidDistance,
} from '../../common/validation/validation.decorators';

export class LocationDto {
  @ApiProperty({
    description: 'Latitude coordinate (-90 to 90 degrees)',
    minimum: -90,
    maximum: 90,
    example: 28.6139,
  })
  @IsNotEmpty({ message: 'Latitude is required' })
  @IsNumber({}, { message: 'Latitude must be a number' })
  @IsValidLatitude({ message: 'Latitude must be between -90 and 90 degrees' })
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate (-180 to 180 degrees)',
    minimum: -180,
    maximum: 180,
    example: 77.209,
  })
  @IsNotEmpty({ message: 'Longitude is required' })
  @IsNumber({}, { message: 'Longitude must be a number' })
  @IsValidLongitude({
    message: 'Longitude must be between -180 and 180 degrees',
  })
  longitude: number;

  @ApiProperty({
    required: false,
    description: 'Human-readable address',
    maxLength: 500,
    example: 'Connaught Place, New Delhi, India',
  })
  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @MaxLength(500, { message: 'Address cannot exceed 500 characters' })
  address?: string;
}

export class CreateRideDto {
  @ApiProperty({
    type: LocationDto,
    description: 'Pickup location coordinates',
  })
  @IsNotEmpty({ message: 'Pickup location is required' })
  @ValidateNested({ message: 'Invalid pickup location format' })
  @Type(() => LocationDto)
  pickup_location: LocationDto;

  @ApiProperty({
    type: LocationDto,
    description: 'Destination location coordinates',
  })
  @IsNotEmpty({ message: 'Destination location is required' })
  @ValidateNested({ message: 'Invalid destination location format' })
  @Type(() => LocationDto)
  @IsValidDistance('pickup_location', 'destination_location', 0.05, 500, {
    message:
      'Distance between pickup and destination must be between 50 meters and 500 kilometers',
  })
  destination_location: LocationDto;

  @ApiProperty({
    enum: ['REGULAR', 'EMERGENCY'],
    default: 'REGULAR',
    description: 'Type of ride requested',
  })
  @IsOptional()
  @IsEnum(['REGULAR', 'EMERGENCY'], {
    message: 'Vehicle type must be either REGULAR or EMERGENCY',
  })
  vehicle_type?: 'REGULAR' | 'EMERGENCY';

  @ApiProperty({
    required: false,
    description: 'Additional details for emergency rides',
    maxLength: 1000,
    example:
      'Medical emergency - patient needs immediate transport to hospital',
  })
  @IsOptional()
  @IsString({ message: 'Emergency details must be a string' })
  @MaxLength(1000, {
    message: 'Emergency details cannot exceed 1000 characters',
  })
  emergency_details?: string;

  @ApiProperty({
    description: 'Payment method identifier',
    minLength: 1,
    maxLength: 50,
    example: 'card_123',
  })
  @IsNotEmpty({ message: 'Payment method is required' })
  @IsString({ message: 'Payment method must be a string' })
  @MinLength(1, { message: 'Payment method cannot be empty' })
  @MaxLength(50, { message: 'Payment method cannot exceed 50 characters' })
  payment_method: string;
}
