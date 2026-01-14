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

describe('S3ManagerService Security Unit Tests', () => {
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

    // Mock the internal methods to avoid S3 calls
    jest.spyOn(service as any, 'modify_images').mockResolvedValue({
      secure_urls: { original: 'https://test-url.com/test.jpg' },
    });
    jest.spyOn(service as any, 'upload_doc').mockResolvedValue({
      secure_url: 'https://test-url.com/test.pdf',
    });
    jest.spyOn(service as any, 'saveFileMetadata').mockResolvedValue({});

    // Reset mocks
    jest.clearAllMocks();
    mockFileTypeFromBuffer.mockResolvedValue(null);
  });

  /**
   * Property 17: File Upload Security
   * Validates: Requirements 15.1, 15.2, 15.6
   */
  describe('Property 17: File Upload Security', () => {
    it('should accept valid image files', async () => {
      const validImageFile = {
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'test-image.jpg',
        size: 1024,
      } as Express.Multer.File;

      const userId = '507f1f77bcf86cd799439011';

      const result = await service.uploadFile(validImageFile, userId);

      expect(result).toBeDefined();
      expect(service['modify_images']).toHaveBeenCalled();
    });

    it('should accept valid PDF documents', async () => {
      const validPdfFile = {
        buffer: Buffer.from('fake-pdf-data'),
        mimetype: 'application/pdf',
        originalname: 'test-document.pdf',
        size: 2048,
      } as Express.Multer.File;

      const userId = '507f1f77bcf86cd799439011';

      const result = await service.uploadFile(validPdfFile, userId);

      expect(result).toBeDefined();
      expect(service['upload_doc']).toHaveBeenCalled();
    });

    it('should reject invalid file types', async () => {
      const invalidFile = {
        buffer: Buffer.from('fake-data'),
        mimetype: 'text/plain',
        originalname: 'test-file.txt',
        size: 1024,
      } as Express.Multer.File;

      const userId = '507f1f77bcf86cd799439011';

      await expect(service.uploadFile(invalidFile, userId)).rejects.toThrow(
        BadRequestException,
      );
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

    it('should reject empty files', async () => {
      const emptyFile = {
        buffer: Buffer.alloc(0),
        mimetype: 'image/jpeg',
        originalname: 'test-image.jpg',
        size: 0,
      } as Express.Multer.File;

      const userId = '507f1f77bcf86cd799439011';

      await expect(service.uploadFile(emptyFile, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require user ID for file upload', async () => {
      const validFile = {
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'test-image.jpg',
        size: 1024,
      } as Express.Multer.File;

      await expect(service.uploadFile(validFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should generate secure presigned URLs', async () => {
      const fileKey = 'test-file-key';
      const expiresIn = 3600; // 1 hour

      const url = await service.generatePresignedUrl(fileKey, expiresIn);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url.startsWith('https://')).toBe(true);
    });

    it('should detect file type mismatches', async () => {
      // Mock file-type detection to return different type than declared
      mockFileTypeFromBuffer.mockResolvedValue({
        mime: 'text/plain',
        ext: 'txt',
      });

      const mismatchedFile = {
        buffer: Buffer.from('fake-data'),
        mimetype: 'image/jpeg', // Declared as image
        originalname: 'test-file.jpg',
        size: 1024,
      } as Express.Multer.File;

      const userId = '507f1f77bcf86cd799439011';

      await expect(service.uploadFile(mismatchedFile, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
