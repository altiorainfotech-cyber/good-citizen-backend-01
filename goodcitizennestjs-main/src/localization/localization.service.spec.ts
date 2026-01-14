import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LocalizationService } from './localization.service';
import { UserPreference } from './entities/user-preference.entity';
import { LocalizedContent } from './entities/localized-content.entity';
import { RegionalConfig } from './entities/regional-config.entity';

describe('LocalizationService', () => {
  let service: LocalizationService;

  const mockUserPreferenceModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockLocalizedContentModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRegionalConfigModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalizationService,
        {
          provide: getModelToken(UserPreference.name),
          useValue: mockUserPreferenceModel,
        },
        {
          provide: getModelToken(LocalizedContent.name),
          useValue: mockLocalizedContentModel,
        },
        {
          provide: getModelToken(RegionalConfig.name),
          useValue: mockRegionalConfigModel,
        },
      ],
    }).compile();

    service = module.get<LocalizationService>(LocalizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPreferences', () => {
    it('should create default preferences if none exist', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserPreferenceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockSavedPreferences = {
        user_id: userId,
        language: 'en',
        region: 'US',
        timezone: 'UTC',
        currency: 'USD',
        date_format: 'MM/DD/YYYY',
        time_format: '12',
        unit_system: 'imperial',
        notification_preferences: {
          language: 'en',
          emergency_alerts: true,
          ride_updates: true,
          promotional: false,
        },
        created_at: new Date(),
        updated_at: new Date(),
        save: jest.fn().mockResolvedValue(this),
      };

      // Mock the constructor and save method
      jest
        .spyOn(service as any, 'createDefaultUserPreferences')
        .mockResolvedValue(mockSavedPreferences);

      const result = await service.getUserPreferences(userId);

      expect(result).toBeDefined();
      expect(result.language).toBe('en');
      expect(result.region).toBe('US');
    });
  });

  describe('getLocalizedContent', () => {
    it('should return localized content when found', async () => {
      const mockContent = {
        content_key: 'welcome_message',
        language: 'en',
        region: 'US',
        content: 'Welcome to Good Citizen!',
        content_type: 'text',
        category: 'general',
        metadata: {},
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockLocalizedContentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockContent),
      });

      const result = await service.getLocalizedContent(
        'welcome_message',
        'en',
        'US',
      );

      expect(result).toBeDefined();
      expect(result?.content).toBe('Welcome to Good Citizen!');
      expect(result?.language).toBe('en');
    });

    it('should return null when content not found', async () => {
      mockLocalizedContentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getLocalizedContent(
        'nonexistent_key',
        'en',
        'US',
      );

      expect(result).toBeNull();
    });
  });
});
