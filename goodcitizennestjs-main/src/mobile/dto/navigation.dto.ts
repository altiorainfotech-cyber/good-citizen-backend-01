import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NavigationParamsDto {
  @ApiProperty()
  @IsString()
  screenName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: 'navigate' | 'replace' | 'goBack' | 'reset';
}

export class NavigationResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  screenName: string;

  @ApiProperty()
  params: Record<string, any>;

  @ApiPropertyOptional()
  message?: string;
}

export class ScreenStateDto {
  @ApiProperty()
  @IsString()
  screenName: string;

  @ApiProperty()
  @IsObject()
  state: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  timestamp?: Date;
}

export class ScreenStateResponse {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  message?: string;
}

export class RouteParamsValidationDto {
  @ApiProperty()
  @IsString()
  screenName: string;

  @ApiProperty()
  @IsObject()
  params: Record<string, any>;
}

export class RouteParamsValidationResponse {
  @ApiProperty()
  valid: boolean;

  @ApiProperty()
  sanitizedParams: Record<string, any>;

  @ApiPropertyOptional()
  errors?: string[] | undefined;

  @ApiPropertyOptional()
  warnings?: string[] | undefined;
}

export class NavigationHistoryItem {
  @ApiProperty()
  screenName: string;

  @ApiProperty()
  params: Record<string, any>;

  @ApiProperty()
  timestamp: Date;

  @ApiPropertyOptional()
  userId?: string;
}

export class NavigationHistoryDto {
  @ApiProperty({ type: [NavigationHistoryItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavigationHistoryItem)
  history: NavigationHistoryItem[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class NavigationHistoryResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  historyCount: number;

  @ApiPropertyOptional()
  message?: string;
}

export class DeepLinkValidationDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class DeepLinkValidationResponse {
  @ApiProperty()
  valid: boolean;

  @ApiProperty()
  screenName: string;

  @ApiProperty()
  params: Record<string, any>;

  @ApiProperty()
  requiresAuth: boolean;

  @ApiPropertyOptional()
  errors?: string[] | undefined;

  @ApiPropertyOptional()
  message?: string | undefined;
}

export class BackNavigationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentScreen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  currentParams?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  preserveState?: boolean;
}

export class BackNavigationResponse {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  targetScreen?: string;

  @ApiPropertyOptional()
  targetParams?: Record<string, any>;

  @ApiPropertyOptional()
  message?: string;
}

// Screen-specific DTOs for common navigation patterns

export class RideNavigationDto {
  @ApiProperty()
  @IsString()
  rideId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: 'view' | 'track' | 'rate' | 'cancel';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalData?: Record<string, any>;
}

export class DriverNavigationDto {
  @ApiProperty()
  @IsString()
  driverId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: 'profile' | 'contact' | 'rate';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalData?: Record<string, any>;
}

export class EmergencyNavigationDto {
  @ApiProperty()
  @IsString()
  emergencyType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: {
    latitude: number;
    longitude: number;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalData?: Record<string, any>;
}

export class AuthNavigationDto {
  @ApiProperty()
  @IsString()
  authAction: 'login' | 'register' | 'forgot-password' | 'verify';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  redirectParams?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalData?: Record<string, any>;
}
