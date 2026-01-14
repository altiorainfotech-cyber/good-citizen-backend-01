import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Auth0AuthDto {
  @ApiProperty({
    description: 'Authentication provider',
    enum: ['google', 'apple'],
    example: 'google',
  })
  @IsEnum(['google', 'apple'])
  provider: 'google' | 'apple';

  @ApiPropertyOptional({
    description: 'Authorization code from OAuth flow',
    example: 'auth_code_123',
  })
  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @ApiPropertyOptional({
    description: 'ID token from Apple Sign-In',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...',
  })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({
    description: 'User profile data from social provider',
  })
  @IsOptional()
  user?: {
    email?: string;
    name?: string;
    picture?: string;
  };
}

export class DriverSignupDto {
  @ApiProperty({
    description: 'Driver email address',
    example: 'driver@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Driver password (minimum 8 characters)',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Driver first name',
    example: 'John',
  })
  @IsString()
  @MinLength(1)
  first_name: string;

  @ApiProperty({
    description: 'Driver last name',
    example: 'Doe',
  })
  @IsString()
  @MinLength(1)
  last_name: string;

  @ApiPropertyOptional({
    description: 'Driver phone number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Country code for phone number',
    example: '+1',
  })
  @IsOptional()
  @IsString()
  country_code?: string;

  @ApiPropertyOptional({
    description: 'Vehicle type',
    example: 'sedan',
  })
  @IsOptional()
  @IsString()
  vehicle_type?: string;

  @ApiPropertyOptional({
    description: 'Vehicle license plate',
    example: 'ABC123',
  })
  @IsOptional()
  @IsString()
  license_plate?: string;
}

export class DriverLoginDto {
  @ApiProperty({
    description: 'Driver email address',
    example: 'driver@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Driver password',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  })
  @IsString()
  refresh_token: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'User information' })
  user: {
    _id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    role: string;
    loyalty_points: number;
    is_email_verified: boolean;
  };

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'Session ID',
    example: '507f1f77bcf86cd799439011',
  })
  session_id: string;

  @ApiPropertyOptional({
    description: 'Authentication provider used',
    enum: ['auth0', 'local'],
    example: 'auth0',
  })
  auth_provider?: 'auth0' | 'local';
}
