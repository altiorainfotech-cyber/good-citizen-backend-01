import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsArray,
  IsIn,
} from 'class-validator';

export class CreateRegionalConfigDto {
  @IsString()
  region_code: string;

  @IsString()
  region_name: string;

  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN'])
  currency_code: string;

  @IsString()
  currency_symbol: string;

  @IsOptional()
  @IsNumber()
  currency_decimal_places?: number;

  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'zh', 'ja', 'ko', 'ar'])
  default_language: string;

  @IsArray()
  @IsString({ each: true })
  supported_languages: string[];

  @IsString()
  timezone: string;

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

  @IsObject()
  emergency_contacts: {
    police?: string;
    fire?: string;
    ambulance?: string;
    general_emergency?: string;
  };

  @IsObject()
  pricing_config: {
    base_fare: number;
    per_km_rate: number;
    per_minute_rate: number;
    surge_multiplier_max: number;
    emergency_multiplier: number;
  };

  @IsOptional()
  @IsObject()
  regional_settings?: {
    address_format?: string;
    phone_format?: string;
    postal_code_format?: string;
    tax_rate?: number;
    service_fee?: number;
  };

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateRegionalConfigDto {
  @IsOptional()
  @IsString()
  region_name?: string;

  @IsOptional()
  @IsString()
  currency_symbol?: string;

  @IsOptional()
  @IsNumber()
  currency_decimal_places?: number;

  @IsOptional()
  @IsString()
  default_language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supported_languages?: string[];

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  date_format?: string;

  @IsOptional()
  @IsString()
  time_format?: string;

  @IsOptional()
  @IsString()
  unit_system?: string;

  @IsOptional()
  @IsObject()
  emergency_contacts?: {
    police?: string;
    fire?: string;
    ambulance?: string;
    general_emergency?: string;
  };

  @IsOptional()
  @IsObject()
  pricing_config?: {
    base_fare?: number;
    per_km_rate?: number;
    per_minute_rate?: number;
    surge_multiplier_max?: number;
    emergency_multiplier?: number;
  };

  @IsOptional()
  @IsObject()
  regional_settings?: {
    address_format?: string;
    phone_format?: string;
    postal_code_format?: string;
    tax_rate?: number;
    service_fee?: number;
  };

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class RegionalConfigResponseDto {
  region_code: string;
  region_name: string;
  currency_code: string;
  currency_symbol: string;
  currency_decimal_places: number;
  default_language: string;
  supported_languages: string[];
  timezone: string;
  date_format: string;
  time_format: string;
  unit_system: string;
  emergency_contacts: {
    police?: string;
    fire?: string;
    ambulance?: string;
    general_emergency?: string;
  };
  pricing_config: {
    base_fare: number;
    per_km_rate: number;
    per_minute_rate: number;
    surge_multiplier_max: number;
    emergency_multiplier: number;
  };
  regional_settings: {
    address_format?: string;
    phone_format?: string;
    postal_code_format?: string;
    tax_rate?: number;
    service_fee?: number;
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
