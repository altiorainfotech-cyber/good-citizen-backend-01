import { ApiProperty } from '@nestjs/swagger';
import { RideStatus } from '../../common/utils';
import { LocationDto } from './create-ride.dto';

export class DriverDto {
  @ApiProperty()
  driver_id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  vehicle: string;

  @ApiProperty()
  plate: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ type: LocationDto })
  current_location: LocationDto;
}

export class RideResponse {
  @ApiProperty()
  ride_id: string;

  @ApiProperty({ enum: RideStatus })
  status: RideStatus;

  @ApiProperty()
  estimated_fare: number;

  @ApiProperty()
  estimated_duration: number;

  @ApiProperty({ type: LocationDto })
  pickup_location: LocationDto;

  @ApiProperty({ type: LocationDto })
  destination_location: LocationDto;
}

export class RideStatusResponse {
  @ApiProperty()
  ride_id: string;

  @ApiProperty({ enum: RideStatus })
  status: RideStatus;

  @ApiProperty({ type: DriverDto, required: false })
  driver?: DriverDto;

  @ApiProperty({ type: LocationDto, required: false })
  current_location?: LocationDto;

  @ApiProperty({ required: false })
  estimated_arrival?: number;
}

export class RideHistoryResponse {
  @ApiProperty({ type: [RideResponse] })
  rides: RideResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class CompleteRideDto {
  @ApiProperty()
  final_fare: number;

  @ApiProperty()
  distance_km: number;

  @ApiProperty()
  duration_minutes: number;
}

export class RideReceipt {
  @ApiProperty()
  ride_id: string;

  @ApiProperty()
  final_fare: number;

  @ApiProperty()
  distance_km: number;

  @ApiProperty()
  duration_minutes: number;

  @ApiProperty()
  completed_at: Date;
}

export class RatingDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ required: false })
  feedback?: string;
}

export class PaginationDto {
  @ApiProperty({ default: 1 })
  page: number = 1;

  @ApiProperty({ default: 10 })
  limit: number = 10;
}
