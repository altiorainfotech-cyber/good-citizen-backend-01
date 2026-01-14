import { IsNumber, IsString, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'Longitude coordinate',
    example: -122.4194,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({
    description: 'Latitude coordinate',
    example: 37.7749,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({
    description: 'Location accuracy in meters',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  accuracy!: number;

  @ApiProperty({
    description: 'Source of location data',
    enum: ['gps', 'network', 'manual'],
    example: 'gps',
  })
  @IsEnum(['gps', 'network', 'manual'])
  source!: string;

  @ApiProperty({
    description: 'User ID (optional, will be extracted from JWT if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;
}