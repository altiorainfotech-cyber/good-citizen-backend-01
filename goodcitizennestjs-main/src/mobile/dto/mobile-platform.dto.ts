import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LocationPermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
  RESTRICTED = 'restricted',
}

export enum LocationAccuracy {
  HIGH = 'high',
  LOW = 'low',
  NONE = 'none',
}

export enum DeviceType {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

export class LocationPermissionDto {
  @ApiProperty({ enum: LocationPermissionStatus })
  @IsEnum(LocationPermissionStatus)
  status: LocationPermissionStatus;

  @ApiPropertyOptional({ enum: LocationAccuracy })
  @IsOptional()
  @IsEnum(LocationAccuracy)
  accuracy?: LocationAccuracy | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  backgroundPermission?: boolean | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canAskAgain?: boolean | undefined;
}

export class LocationPermissionResponse {
  @ApiProperty()
  granted: boolean;

  @ApiProperty({ enum: LocationAccuracy })
  accuracy: LocationAccuracy;

  @ApiProperty()
  backgroundPermission: boolean;

  @ApiPropertyOptional()
  message?: string | undefined;
}

export class FCMTokenDto {
  @ApiProperty()
  @IsString()
  fcmToken: string;

  @ApiProperty({ enum: DeviceType })
  @IsEnum(DeviceType)
  deviceType: DeviceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  osVersion?: string | undefined;
}

export class NotificationSetupResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  pushToken: string;

  @ApiPropertyOptional()
  deviceId?: string | undefined;

  @ApiPropertyOptional()
  message?: string | undefined;
}

export class ImageUploadDto {
  @ApiProperty()
  @IsString()
  imageUri: string;

  @ApiProperty()
  @IsString()
  imageType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quality?: number | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxWidth?: number | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxHeight?: number | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  compress?: boolean | undefined;
}

export class ImageUploadResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  imageUrl: string;

  @ApiPropertyOptional()
  thumbnailUrl?: string;

  @ApiProperty()
  fileSize: number;

  @ApiPropertyOptional()
  originalSize?: number;

  @ApiPropertyOptional()
  compressionRatio?: number;

  @ApiPropertyOptional()
  message?: string;
}

export class OfflineDataItem {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsObject()
  data: any;

  @ApiProperty()
  timestamp: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string | undefined;
}

export class OfflineSyncDto {
  @ApiProperty({ type: [OfflineDataItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineDataItem)
  offlineData: OfflineDataItem[];
}

export class SyncResponse {
  @ApiProperty()
  synced: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  conflicts: any[];

  @ApiPropertyOptional()
  message?: string;
}

export class DeepLinkDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string | undefined;
}

export class DeepLinkResponse {
  @ApiProperty()
  screenName: string;

  @ApiProperty()
  params: any;

  @ApiProperty()
  requiresAuth: boolean;

  @ApiPropertyOptional()
  message?: string;
}

export class AppStateDto {
  @ApiProperty()
  @IsString()
  state: 'active' | 'background' | 'inactive';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previousState?: string | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  timestamp?: Date | undefined;
}

export class AppStateResponse {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  message?: string;
}
