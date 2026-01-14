import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateLocalizedContentDto {
  @IsString()
  content_key: string;

  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'zh', 'ja', 'ko', 'ar'])
  language: string;

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
  region: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'html', 'json'])
  content_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['general', 'notification', 'error', 'emergency'])
  category?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    version?: string;
    author?: string;
    description?: string;
    variables?: string[];
  };

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateLocalizedContentDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'html', 'json'])
  content_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['general', 'notification', 'error', 'emergency'])
  category?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    version?: string;
    author?: string;
    description?: string;
    variables?: string[];
  };

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class GetLocalizedContentDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  content_key?: string;
}

export class LocalizedContentResponseDto {
  content_key: string;
  language: string;
  region: string;
  content: string;
  content_type: string;
  category: string;
  metadata: {
    version?: string;
    author?: string;
    description?: string;
    variables?: string[];
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
