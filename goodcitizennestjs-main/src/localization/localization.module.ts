import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LocalizationService } from './localization.service';
import { LocalizationController } from './localization.controller';
import { RegionalCustomizationService } from './regional-customization.service';
import { RegionalCustomizationController } from './regional-customization.controller';
import { LocalizationUtils } from './localization.utils';
import { LocalizationSeeder } from './localization.seeder';
import {
  UserPreference,
  UserPreferenceSchema,
} from './entities/user-preference.entity';
import {
  LocalizedContent,
  LocalizedContentSchema,
} from './entities/localized-content.entity';
import {
  RegionalConfig,
  RegionalConfigSchema,
} from './entities/regional-config.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserPreference.name, schema: UserPreferenceSchema },
      { name: LocalizedContent.name, schema: LocalizedContentSchema },
      { name: RegionalConfig.name, schema: RegionalConfigSchema },
    ]),
  ],
  controllers: [LocalizationController, RegionalCustomizationController],
  providers: [
    LocalizationService,
    RegionalCustomizationService,
    LocalizationUtils,
    LocalizationSeeder,
  ],
  exports: [
    LocalizationService,
    RegionalCustomizationService,
    LocalizationUtils,
    LocalizationSeeder,
  ],
})
export class LocalizationModule {}
