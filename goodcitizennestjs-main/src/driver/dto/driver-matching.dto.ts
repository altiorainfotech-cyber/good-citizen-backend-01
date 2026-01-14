import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { LocationDto } from '../../ride/dto/create-ride.dto';

export class DriverMatchQuery {
  @ApiProperty()
  @IsNotEmpty()
  location: LocationDto;

  @ApiProperty({ minimum: 0.1, maximum: 50 })
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radius_km: number;

  @ApiProperty({ enum: ['REGULAR', 'EMERGENCY'] })
  @IsEnum(['REGULAR', 'EMERGENCY'])
  vehicle_type: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude_driver_ids?: string[];

  @ApiProperty({
    required: false,
    description: 'Whether this is an emergency ride request',
  })
  @IsOptional()
  is_emergency?: boolean;
}

export class DriverMatchResult {
  @ApiProperty()
  driver_id: string;

  @ApiProperty()
  distance_km: number;

  @ApiProperty()
  estimated_arrival_minutes: number;

  @ApiProperty()
  rating: number;

  @ApiProperty({ enum: ['AVAILABLE', 'BUSY'] })
  availability_status: 'AVAILABLE' | 'BUSY';

  @ApiProperty()
  driver_name: string;

  @ApiProperty()
  vehicle_info: string;

  @ApiProperty()
  phone_number: string;

  @ApiProperty()
  current_location: LocationDto;

  @ApiProperty({
    required: false,
    description: 'Whether driver can handle emergency rides',
  })
  is_emergency_capable?: boolean;
}

export class RideOfferDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ride_id: string;

  @ApiProperty()
  @IsNotEmpty()
  pickup_location: LocationDto;

  @ApiProperty()
  @IsNotEmpty()
  destination_location: LocationDto;

  @ApiProperty()
  @IsNumber()
  estimated_fare: number;

  @ApiProperty()
  @IsNumber()
  estimated_duration: number;

  @ApiProperty()
  @IsNumber()
  distance_km: number;

  @ApiProperty({ enum: ['REGULAR', 'EMERGENCY'] })
  @IsEnum(['REGULAR', 'EMERGENCY'])
  vehicle_type: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergency_details?: string;

  @ApiProperty({
    required: false,
    description: 'Whether this is an emergency ride',
  })
  @IsOptional()
  is_emergency?: boolean;

  @ApiProperty({
    required: false,
    enum: ['NORMAL', 'HIGH'],
    description: 'Priority level of the ride',
  })
  @IsOptional()
  @IsEnum(['NORMAL', 'HIGH'])
  priority?: 'NORMAL' | 'HIGH';

  @ApiProperty({
    required: false,
    description: 'Emergency message for drivers',
  })
  @IsOptional()
  @IsString()
  emergency_message?: string;

  @ApiProperty({ required: false, description: 'Response timeout in seconds' })
  @IsOptional()
  @IsNumber()
  response_timeout?: number;
}

export class DriverResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  driver_id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ride_id: string;

  @ApiProperty()
  @IsNotEmpty()
  accepted: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
