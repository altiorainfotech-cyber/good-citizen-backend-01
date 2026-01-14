import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GeneratePresignedUrlDto {
  @ApiProperty({ description: 'S3 file key' })
  @IsString()
  fileKey: string;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    required: false,
    default: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(604800) // Max 7 days
  expiresIn?: number = 3600;
}

export class DeleteFileDto {
  @ApiProperty({ description: 'S3 file key to delete' })
  @IsString()
  fileKey: string;
}

export class FileValidationError {
  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  message: string;

  @ApiProperty()
  error: string;
}
