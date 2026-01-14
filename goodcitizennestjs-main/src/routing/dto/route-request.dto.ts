import { IsNotEmpty, IsNumber, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CoordinatesDto {
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export enum TravelMode {
  DRIVING = 'driving',
  WALKING = 'walking',
  BICYCLING = 'bicycling',
  TRANSIT = 'transit',
}

export enum TrafficModel {
  BEST_GUESS = 'best_guess',
  PESSIMISTIC = 'pessimistic',
  OPTIMISTIC = 'optimistic',
}

export class RouteRequestDto {
  @IsNotEmpty()
  origin: CoordinatesDto;

  @IsNotEmpty()
  destination: CoordinatesDto;

  @IsOptional()
  @IsEnum(TravelMode)
  mode?: TravelMode = TravelMode.DRIVING;

  @IsOptional()
  @IsBoolean()
  alternatives?: boolean = true;

  @IsOptional()
  @IsBoolean()
  avoidTolls?: boolean = false;

  @IsOptional()
  @IsBoolean()
  avoidHighways?: boolean = false;

  @IsOptional()
  @IsBoolean()
  avoidFerries?: boolean = false;

  @IsOptional()
  @IsEnum(TrafficModel)
  trafficModel?: TrafficModel = TrafficModel.BEST_GUESS;

  @IsOptional()
  @IsString()
  departureTime?: string = 'now';
}

export class PlaceSearchDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  location?: CoordinatesDto;
}

export class PlaceDetailsDto {
  @IsString()
  @IsNotEmpty()
  placeId: string;
}

export class GeocodeDto {
  @IsString()
  @IsNotEmpty()
  address: string;
}
