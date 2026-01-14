import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class LatLong {
  @ApiProperty()
  @IsNotEmpty({ message: 'latitude is required' })
  @IsString()
  lat: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'longitude is required' })
  @IsString()
  long: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  accuracy?: number; // GPS accuracy in meters

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  altitude?: number; // Altitude in meters

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  speed?: number; // Speed in km/h

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  bearing?: number; // Bearing in degrees
}

export class DriverLatLong {
  @ApiProperty()
  @IsNotEmpty({ message: 'latitude is required' })
  @IsString()
  lat: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'longitude is required' })
  @IsString()
  long: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'ride id is required' })
  @IsString()
  ride_id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  accuracy?: number; // GPS accuracy in meters

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  altitude?: number; // Altitude in meters

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  speed?: number; // Speed in km/h

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  bearing?: number; // Bearing in degrees
}

export class BearingRequestDto {
  @ValidateNested()
  @Type(() => LatLong)
  from: LatLong;

  @ValidateNested()
  @Type(() => LatLong)
  to: LatLong;

  @ValidateNested()
  @Type(() => LatLong)
  user: LatLong;
}

export class LocationUpdateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  longitude: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  bearing?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timestamp?: string;
}
