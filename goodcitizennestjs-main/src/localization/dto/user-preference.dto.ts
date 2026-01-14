/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class UpdateUserPreferenceDto {
  @IsOptional()
  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'zh', 'ja', 'ko', 'ar'])
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'US',
    'CA',
    'GB',
    'FR',
    'DE',
    'IT',
    'ES',
    'PT',
    'IN',
    'CN',
    'JP',
    'KR',
    'AU',
    'BR',
    'MX',
  ])
  region?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN'])
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY'])
  date_format?: string;

  @IsOptional()
  @IsString()
  @IsIn(['12', '24'])
  time_format?: string;

  @IsOptional()
  @IsString()
  @IsIn(['metric', 'imperial'])
  unit_system?: string;

  @IsOptional()
  @IsObject()
  notification_preferences?: {
    language?: string;
    emergency_alerts?: boolean;
    ride_updates?: boolean;
    promotional?: boolean;
  };
}

export class UserPreferenceResponseDto {
  user_id: string;
  language: string;
  region: string;
  timezone: string;
  currency: string;
  date_format: string;
  time_format: string;
  unit_system: string;
  notification_preferences: {
    language?: string;
    emergency_alerts?: boolean;
    ride_updates?: boolean;
    promotional?: boolean;
  };
  created_at: Date;
  updated_at: Date;
}
