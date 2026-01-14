import { ApiProperty } from '@nestjs/swagger';

export class LocationResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  userId!: string;

  @ApiProperty({
    description: 'Location coordinates',
    example: {
      type: 'Point',
      coordinates: [-122.4194, 37.7749]
    },
  })
  coordinates!: {
    type: string;
    coordinates: number[];
  };

  @ApiProperty({
    description: 'Location accuracy in meters',
    example: 10,
  })
  accuracy!: number;

  @ApiProperty({
    description: 'Timestamp when location was recorded',
    example: '2024-01-13T10:30:00.000Z',
  })
  timestamp!: Date;

  @ApiProperty({
    description: 'Source of location data',
    enum: ['gps', 'network', 'manual'],
    example: 'gps',
  })
  source!: string;

  @ApiProperty({
    description: 'Whether this location is currently active',
    example: true,
  })
  isActive!: boolean;
}