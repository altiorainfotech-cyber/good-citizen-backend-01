/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserPreference,
  UserPreferenceDocument,
} from './entities/user-preference.entity';
import {
  LocalizedContent,
  LocalizedContentDocument,
} from './entities/localized-content.entity';
import {
  RegionalConfig,
  RegionalConfigDocument,
} from './entities/regional-config.entity';
import {
  UpdateUserPreferenceDto,
  UserPreferenceResponseDto,
} from './dto/user-preference.dto';
import {
  CreateLocalizedContentDto,
  UpdateLocalizedContentDto,
  LocalizedContentResponseDto,
} from './dto/localized-content.dto';
import {
  CreateRegionalConfigDto,
  UpdateRegionalConfigDto,
  RegionalConfigResponseDto,
} from './dto/regional-config.dto';

@Injectable()
export class LocalizationService {
  constructor(
    @InjectModel(UserPreference.name)
    private userPreferenceModel: Model<UserPreferenceDocument>,
    @InjectModel(LocalizedContent.name)
    private localizedContentModel: Model<LocalizedContentDocument>,
    @InjectModel(RegionalConfig.name)
    private regionalConfigModel: Model<RegionalConfigDocument>,
  ) {}

  // User Preference Methods
  async getUserPreferences(userId: string): Promise<UserPreferenceResponseDto> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    let preferences = await this.userPreferenceModel
      .findOne({ user_id: new Types.ObjectId(userId) })
      .exec();

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await this.createDefaultUserPreferences(userId);
    }

    if (!preferences) {
      throw new NotFoundException(
        'Unable to create or retrieve user preferences',
      );
    }

    return this.mapUserPreferenceToDto(preferences);
  }

  async updateUserPreferences(
    userId: string,
    updateDto: UpdateUserPreferenceDto,
  ): Promise<UserPreferenceResponseDto> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Validate region and language combination if both provided
    if (updateDto.region && updateDto.language) {
      await this.validateRegionLanguageCombination(
        updateDto.region,
        updateDto.language,
      );
    }

    const preferences = await this.userPreferenceModel
      .findOneAndUpdate(
        { user_id: new Types.ObjectId(userId) },
        { ...updateDto, updated_at: new Date() },
        { new: true, upsert: true },
      )
      .exec();

    return this.mapUserPreferenceToDto(preferences);
  }

  private async createDefaultUserPreferences(userId: string): Promise<any> {
    const defaultPreferences = new this.userPreferenceModel({
      user_id: new Types.ObjectId(userId),
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
    });

    return await defaultPreferences.save();
  }

  private async validateRegionLanguageCombination(
    region: string,
    language: string,
  ): Promise<void> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: region, is_active: true })
      .exec();

    if (
      regionalConfig &&
      !regionalConfig.supported_languages.includes(language)
    ) {
      throw new BadRequestException(
        `Language '${language}' is not supported in region '${region}'`,
      );
    }
  }

  // Localized Content Methods
  async getLocalizedContent(
    contentKey: string,
    language?: string,
    region?: string,
  ): Promise<LocalizedContentResponseDto | null> {
    const query: any = { content_key: contentKey, is_active: true };

    if (language) query.language = language;
    if (region) query.region = region;

    let content = await this.localizedContentModel.findOne(query).exec();

    // Fallback to default language if specific language not found
    if (!content && language && language !== 'en') {
      content = await this.localizedContentModel
        .findOne({
          content_key: contentKey,
          language: 'en',
          region: region || 'US',
          is_active: true,
        })
        .exec();
    }

    // Fallback to default region if specific region not found
    if (!content && region && region !== 'US') {
      content = await this.localizedContentModel
        .findOne({
          content_key: contentKey,
          language: language || 'en',
          region: 'US',
          is_active: true,
        })
        .exec();
    }

    return content ? this.mapLocalizedContentToDto(content) : null;
  }

  async getLocalizedContentBatch(
    contentKeys: string[],
    language?: string,
    region?: string,
  ): Promise<{ [key: string]: LocalizedContentResponseDto }> {
    const query: any = { content_key: { $in: contentKeys }, is_active: true };

    if (language) query.language = language;
    if (region) query.region = region;

    const contents = await this.localizedContentModel.find(query).exec();
    const result: { [key: string]: LocalizedContentResponseDto } = {};

    // Map found contents
    contents.forEach((content) => {
      result[content.content_key] = this.mapLocalizedContentToDto(content);
    });

    // Handle missing contents with fallbacks
    const missingKeys = contentKeys.filter((key) => !result[key]);
    if (missingKeys.length > 0) {
      await this.handleMissingContentFallbacks(
        missingKeys,
        language,
        region,
        result,
      );
    }

    return result;
  }

  private async handleMissingContentFallbacks(
    missingKeys: string[],
    language: string | undefined,
    region: string | undefined,
    result: { [key: string]: LocalizedContentResponseDto },
  ): Promise<void> {
    // Try fallback to default language
    if (language && language !== 'en') {
      const fallbackContents = await this.localizedContentModel
        .find({
          content_key: { $in: missingKeys },
          language: 'en',
          region: region || 'US',
          is_active: true,
        })
        .exec();

      fallbackContents.forEach((content) => {
        if (!result[content.content_key]) {
          result[content.content_key] = this.mapLocalizedContentToDto(content);
        }
      });
    }

    // Try fallback to default region
    const stillMissingKeys = missingKeys.filter((key) => !result[key]);
    if (stillMissingKeys.length > 0 && region && region !== 'US') {
      const fallbackContents = await this.localizedContentModel
        .find({
          content_key: { $in: stillMissingKeys },
          language: language || 'en',
          region: 'US',
          is_active: true,
        })
        .exec();

      fallbackContents.forEach((content) => {
        if (!result[content.content_key]) {
          result[content.content_key] = this.mapLocalizedContentToDto(content);
        }
      });
    }
  }

  async createLocalizedContent(
    createDto: CreateLocalizedContentDto,
  ): Promise<LocalizedContentResponseDto> {
    // Check if content already exists
    const existingContent = await this.localizedContentModel
      .findOne({
        content_key: createDto.content_key,
        language: createDto.language,
        region: createDto.region,
      })
      .exec();

    if (existingContent) {
      throw new BadRequestException(
        `Content already exists for key '${createDto.content_key}' in language '${createDto.language}' and region '${createDto.region}'`,
      );
    }

    const content = new this.localizedContentModel(createDto);
    const savedContent = await content.save();
    return this.mapLocalizedContentToDto(savedContent);
  }

  async updateLocalizedContent(
    contentKey: string,
    language: string,
    region: string,
    updateDto: UpdateLocalizedContentDto,
  ): Promise<LocalizedContentResponseDto> {
    const content = await this.localizedContentModel
      .findOneAndUpdate(
        { content_key: contentKey, language, region },
        { ...updateDto, updated_at: new Date() },
        { new: true },
      )
      .exec();

    if (!content) {
      throw new NotFoundException(
        `Content not found for key '${contentKey}' in language '${language}' and region '${region}'`,
      );
    }

    return this.mapLocalizedContentToDto(content);
  }

  async deleteLocalizedContent(
    contentKey: string,
    language: string,
    region: string,
  ): Promise<void> {
    const result = await this.localizedContentModel
      .deleteOne({ content_key: contentKey, language, region })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Content not found for key '${contentKey}' in language '${language}' and region '${region}'`,
      );
    }
  }

  // Regional Configuration Methods
  async getRegionalConfig(
    regionCode: string,
  ): Promise<RegionalConfigResponseDto> {
    const config = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!config) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    return this.mapRegionalConfigToDto(config);
  }

  async getAllRegionalConfigs(): Promise<RegionalConfigResponseDto[]> {
    const configs = await this.regionalConfigModel
      .find({ is_active: true })
      .sort({ region_name: 1 })
      .exec();

    return configs.map((config) => this.mapRegionalConfigToDto(config));
  }

  async createRegionalConfig(
    createDto: CreateRegionalConfigDto,
  ): Promise<RegionalConfigResponseDto> {
    // Check if region already exists
    const existingConfig = await this.regionalConfigModel
      .findOne({ region_code: createDto.region_code })
      .exec();

    if (existingConfig) {
      throw new BadRequestException(
        `Regional configuration already exists for region '${createDto.region_code}'`,
      );
    }

    const config = new this.regionalConfigModel(createDto);
    const savedConfig = await config.save();
    return this.mapRegionalConfigToDto(savedConfig);
  }

  async updateRegionalConfig(
    regionCode: string,
    updateDto: UpdateRegionalConfigDto,
  ): Promise<RegionalConfigResponseDto> {
    const config = await this.regionalConfigModel
      .findOneAndUpdate(
        { region_code: regionCode },
        { ...updateDto, updated_at: new Date() },
        { new: true },
      )
      .exec();

    if (!config) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    return this.mapRegionalConfigToDto(config);
  }

  // Utility Methods
  async getLocalizedContentForUser(
    userId: string,
    contentKeys: string[],
  ): Promise<{ [key: string]: LocalizedContentResponseDto }> {
    const preferences = await this.getUserPreferences(userId);
    return this.getLocalizedContentBatch(
      contentKeys,
      preferences.language,
      preferences.region,
    );
  }

  async formatCurrency(amount: number, userId: string): Promise<string> {
    const preferences = await this.getUserPreferences(userId);
    const regionalConfig = await this.getRegionalConfig(preferences.region);

    const formatter = new Intl.NumberFormat(
      `${preferences.language}-${preferences.region}`,
      {
        style: 'currency',
        currency: regionalConfig.currency_code,
        minimumFractionDigits: regionalConfig.currency_decimal_places,
        maximumFractionDigits: regionalConfig.currency_decimal_places,
      },
    );

    return formatter.format(amount);
  }

  async formatDate(date: Date, userId: string): Promise<string> {
    const preferences = await this.getUserPreferences(userId);

    const options: Intl.DateTimeFormatOptions = {
      timeZone: preferences.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    if (preferences.time_format === '24') {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = false;
    } else {
      options.hour = 'numeric';
      options.minute = '2-digit';
      options.hour12 = true;
    }

    const formatter = new Intl.DateTimeFormat(
      `${preferences.language}-${preferences.region}`,
      options,
    );
    return formatter.format(date);
  }

  // Private mapping methods
  private mapUserPreferenceToDto(
    preference: UserPreferenceDocument,
  ): UserPreferenceResponseDto {
    return {
      user_id: preference.user_id.toString(),
      language: preference.language,
      region: preference.region,
      timezone: preference.timezone,
      currency: preference.currency,
      date_format: preference.date_format,
      time_format: preference.time_format,
      unit_system: preference.unit_system,
      notification_preferences: preference.notification_preferences,
      created_at: preference.created_at,
      updated_at: preference.updated_at,
    };
  }

  private mapLocalizedContentToDto(
    content: LocalizedContentDocument,
  ): LocalizedContentResponseDto {
    return {
      content_key: content.content_key,
      language: content.language,
      region: content.region,
      content: content.content,
      content_type: content.content_type,
      category: content.category,
      metadata: content.metadata,
      is_active: content.is_active,
      created_at: content.created_at,
      updated_at: content.updated_at,
    };
  }

  private mapRegionalConfigToDto(
    config: RegionalConfigDocument,
  ): RegionalConfigResponseDto {
    return {
      region_code: config.region_code,
      region_name: config.region_name,
      currency_code: config.currency_code,
      currency_symbol: config.currency_symbol,
      currency_decimal_places: config.currency_decimal_places,
      default_language: config.default_language,
      supported_languages: config.supported_languages,
      timezone: config.timezone,
      date_format: config.date_format,
      time_format: config.time_format,
      unit_system: config.unit_system,
      emergency_contacts: config.emergency_contacts,
      pricing_config: config.pricing_config,
      regional_settings: config.regional_settings,
      is_active: config.is_active,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };
  }
}
