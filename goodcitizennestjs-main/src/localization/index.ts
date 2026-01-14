// Module
export { LocalizationModule } from './localization.module';

// Services
export { LocalizationService } from './localization.service';
export { RegionalCustomizationService } from './regional-customization.service';
export { LocalizationUtils } from './localization.utils';
export { LocalizationSeeder } from './localization.seeder';

// Controllers
export { LocalizationController } from './localization.controller';
export { RegionalCustomizationController } from './regional-customization.controller';

// Entities
export * from './entities';

// DTOs
export * from './dto/user-preference.dto';
export * from './dto/localized-content.dto';
export * from './dto/regional-config.dto';

// Middleware
export { LocalizationMiddleware } from './middleware/localization.middleware';

// Decorators
export * from './decorators/localization.decorator';

// Interceptors
export { LocalizationInterceptor } from './interceptors/localization.interceptor';

// Types
export type {
  FormattedCurrency,
  FormattedDate,
  EmergencyContacts,
  RegionalPricing,
} from './regional-customization.service';

export type {
  LocalizedNotification,
  LocalizedError,
} from './localization.utils';
