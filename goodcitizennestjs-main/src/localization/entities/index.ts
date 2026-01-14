import { UserPreference, UserPreferenceSchema } from './user-preference.entity';
import {
  LocalizedContent,
  LocalizedContentSchema,
} from './localized-content.entity';
import { RegionalConfig, RegionalConfigSchema } from './regional-config.entity';

export const localizationModelDefinitions = [
  { name: UserPreference.name, schema: UserPreferenceSchema },
  { name: LocalizedContent.name, schema: LocalizedContentSchema },
  { name: RegionalConfig.name, schema: RegionalConfigSchema },
];

export {
  UserPreference,
  UserPreferenceSchema,
  LocalizedContent,
  LocalizedContentSchema,
  RegionalConfig,
  RegionalConfigSchema,
};
