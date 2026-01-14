import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { S3ManagerService } from './s3-manager.service';
import { SharpService } from 'nestjs-sharp';
import { FileDocument } from './entities/s3-manager.entity';

describe('S3ManagerService Simple Test', () => {
  let service: S3ManagerService;

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
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  beforeEach(async () => {
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
