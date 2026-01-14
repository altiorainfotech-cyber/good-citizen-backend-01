import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ContentType } from '../../common/utils';

export class AdminLoginDto {
  @ApiProperty({ default: 'admin@gmail.com' })
  @IsEmail({}, { message: 'Email must be an valid email address' })
  @IsString()
  email: string;

  @ApiProperty({ default: 'Asdfghjkl@1' })
  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  password: string;
}

export class Listing {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pagination: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  limit: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search: string;
}

export class ListingDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pagination: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  limit: string;
}

export class Idto {
  @ApiProperty({})
  @IsNotEmpty({ message: 'id is required' })
  @IsString()
  id: string;
}

export class Add_Content {
  @ApiProperty({ required: true, enum: ContentType })
  @IsString()
  @IsEnum(ContentType)
  type: string;

  @ApiProperty({ required: false })
  @IsString()
  image: string;

  @ApiProperty({ required: false })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsString()
  description: string;

  @ApiProperty({ required: false })
  @IsString()
  page_url: string;
}

export class GetContent {
  @ApiProperty({ required: false, enum: ContentType })
  @IsOptional()
  @IsString()
  @IsEnum(ContentType)
  type: string;
}

export class DashboardMetricsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timeframe?: 'today' | 'week' | 'month' | 'year';
}

export class SystemMonitoringDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  metric_type?: 'performance' | 'errors' | 'usage' | 'all';
}

export class EmergencyBroadcastDto {
  @ApiProperty({ required: true })
  @IsNotEmpty({ message: 'Message is required' })
  @IsString()
  message: string;

  @ApiProperty({ required: true })
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  target_area?: string; // Geographic area or 'all'

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  priority?: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  user_type?: 'users' | 'drivers' | 'all';
}

export class ContentVersionDto {
  @ApiProperty({ required: true })
  @IsNotEmpty({ message: 'Content ID is required' })
  @IsString()
  content_id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  version?: string;
}

export class MultiLanguageContentDto {
  @ApiProperty({ required: true, enum: ContentType })
  @IsString()
  @IsEnum(ContentType)
  type: string;

  @ApiProperty({ required: true })
  @IsNotEmpty({ message: 'Language code is required' })
  @IsString()
  language_code: string; // e.g., 'en', 'hi', 'es'

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
