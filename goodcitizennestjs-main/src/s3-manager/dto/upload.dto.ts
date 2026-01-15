import { ApiProperty } from '@nestjs/swagger';

export class UploadDto {
  file: any;
  documentType?: string;
}

export class Upload {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}

export class FileUploadResponse {
  @ApiProperty()
  base_url: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  folders: string[];

  @ApiProperty()
  file_name: string;

  @ApiProperty({ required: false })
  user_prefix?: string;

  @ApiProperty({ required: false })
  document_type?: string;

  @ApiProperty({ required: false })
  secure_url?: string;

  @ApiProperty({ required: false })
  secure_urls?: {
    original?: string;
    medium?: string;
    small?: string;
  };
}

export class PresignedUrlResponse {
  @ApiProperty()
  url: string;

  @ApiProperty()
  expiresIn: number;
}
