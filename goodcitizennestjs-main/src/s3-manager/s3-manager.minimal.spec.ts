/* eslint-disable @typescript-eslint/no-require-imports */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { S3ManagerService } from './s3-manager.service';
import { SharpService } from 'nestjs-sharp';
import { FileDocument } from './entities/s3-manager.entity';

// Mock file-type module
jest.mock('file-type');

describe('S3ManagerService Minimal Property Test', () => {
  let service: S3ManagerService;
  let mockFileTypeFromBuffer: jest.MockedFunction<any>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AWS_BUCKET_URL: 'https://test-bucket.s3.amazonaws.com',
        AWS_BUCKET_NAME: 'test-bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      };
      return config[key];
    }),
  };

  const mockSharpService = {
    edit: jest.fn().mockReturnValue({
      resize: jest.fn().mockReturnThis(),
      rotate: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image')),
    }),
  };

  const mockFileDocumentModel = {
    constructor: jest.fn(),
    save: jest.fn().mockResolvedValue({
      _id: 'test-file-id',
      file_name: 'test-file.jpg',
    }),
    findOne: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  // Mock S3Client
  const mockS3Client = {
    send: jest.fn().mockResolvedValue({ ETag: 'test-etag' }),
  };

  beforeEach(async () => {
    // Get the mocked function
    const fileType = require('file-type');
    mockFileTypeFromBuffer = fileType.fileTypeFromBuffer;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3ManagerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SharpService,
          useValue: mockSharpService,
        },
        {
          provide: getModelToken(FileDocument.name),
          useValue: mockFileDocumentModel,
        },
      ],
    }).compile();

    service = module.get<S3ManagerService>(S3ManagerService);

    // Mock the S3Client
    (service as any).S3Client = mockS3Client;

    // Reset mocks
    jest.clearAllMocks();
    mockFileTypeFromBuffer.mockResolvedValue(null);
  });

  it('should validate file types correctly', async () => {
    // Mock the internal methods to avoid S3 calls
    jest.spyOn(service as any, 'modify_images').mockResolvedValue({
      secure_urls: { original: 'https://test-url.com/test.jpg' },
    });
    jest.spyOn(service as any, 'saveFileMetadata').mockResolvedValue({});

    const validFile = {
      buffer: Buffer.from('fake-image-data'),
      mimetype: 'image/jpeg',
      originalname: 'test-image.jpg',
      size: 1024,
    } as Express.Multer.File;

    const userId = '507f1f77bcf86cd799439011';

    const result = await service.uploadFile(validFile, userId);

    expect(result).toBeDefined();
    expect(service['modify_images']).toHaveBeenCalled();
  });

  it('should reject oversized files', async () => {
    const oversizedFile = {
      buffer: Buffer.from('fake-data'),
      mimetype: 'image/jpeg',
      originalname: 'test-image.jpg',
      size: 11 * 1024 * 1024, // 11MB - over limit
    } as Express.Multer.File;

    const userId = '507f1f77bcf86cd799439011';

    await expect(service.uploadFile(oversizedFile, userId)).rejects.toThrow(
      BadRequestException,
    );
  });
});
