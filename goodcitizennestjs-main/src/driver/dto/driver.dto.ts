import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class RideDto {
  @ApiProperty({
    example: { latitude: '12.9716', longitude: '77.5946' },
  })
  @IsObject()
  pickup_location: { latitude: string; longitude: string };

  @ApiProperty({
    example: { latitude: '12.9716', longitude: '77.5946' },
  })
  @IsObject()
  drop_location: { latitude: string; longitude: string };

  @ApiProperty()
  @IsNotEmpty({ message: 'pickup address is required' })
  @IsString()
  pickup_address: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'drop address is required' })
  @IsString()
  drop_address: string;
}

export class ID {
  @ApiProperty({ description: 'Enter ride id here' })
  @IsNotEmpty({ message: 'id is required' })
  @IsString()
  id: string;
}

export class UploadVerification {
  @ApiProperty({ description: 'Enter aadhar front here' })
  @IsOptional()
  @IsString()
  aadhar_front: string;

  @ApiProperty({ description: 'Enter aadhar back here' })
  @IsOptional()
  @IsString()
  aadhar_back: string;

  @ApiProperty({ description: 'Enter driving licience front here' })
  @IsOptional()
  @IsString()
  dl_front: string;

  @ApiProperty({ description: 'Enter driving licience back here' })
  @IsOptional()
  @IsString()
  dl_back: string;

  @ApiProperty({ description: 'Enter profile image URL here' })
  @IsOptional()
  @IsString()
  profile_image: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ description: 'Driver online status' })
  @IsNotEmpty({ message: 'is_online status is required' })
  @IsBoolean()
  is_online: boolean;
}

export class RatingDto {
  @ApiProperty({ description: 'Rating value between 1 and 5' })
  @IsNotEmpty({ message: 'rating is required' })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}
