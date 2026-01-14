import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RegionalConfig,
  RegionalConfigDocument,
} from './entities/regional-config.entity';
import {
  UserPreference,
  UserPreferenceDocument,
} from './entities/user-preference.entity';
import { LocalizationService } from './localization.service';

export interface FormattedCurrency {
  amount: number;
  formatted: string;
  currency_code: string;
  currency_symbol: string;
}

export interface FormattedDate {
  original: Date;
  formatted: string;
  timezone: string;
  format: string;
}

export interface EmergencyContacts {
  region_code: string;
  region_name: string;
  contacts: {
    police?: string;
    fire?: string;
    ambulance?: string;
    general_emergency?: string;
  };
}

export interface RegionalPricing {
  region_code: string;
  currency_code: string;
  base_fare: FormattedCurrency;
  per_km_rate: FormattedCurrency;
  per_minute_rate: FormattedCurrency;
  surge_multiplier_max: number;
  emergency_multiplier: number;
  tax_rate?: number;
  service_fee?: FormattedCurrency;
}

@Injectable()
export class RegionalCustomizationService {
  constructor(
    @InjectModel(RegionalConfig.name)
    private regionalConfigModel: Model<RegionalConfigDocument>,
    @InjectModel(UserPreference.name)
    private userPreferenceModel: Model<UserPreferenceDocument>,
    private localizationService: LocalizationService,
  ) {}

  // Currency Formatting Methods
  async formatCurrencyForRegion(
    amount: number,
    regionCode: string,
    language?: string,
  ): Promise<FormattedCurrency> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    const locale = language
      ? `${language}-${regionCode}`
      : `${regionalConfig.default_language}-${regionCode}`;

    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: regionalConfig.currency_code,
      minimumFractionDigits: regionalConfig.currency_decimal_places,
      maximumFractionDigits: regionalConfig.currency_decimal_places,
    });

    return {
      amount,
      formatted: formatter.format(amount),
      currency_code: regionalConfig.currency_code,
      currency_symbol: regionalConfig.currency_symbol,
    };
  }

  async formatCurrencyForUser(
    amount: number,
    userId: string,
  ): Promise<FormattedCurrency> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    return this.formatCurrencyForRegion(
      amount,
      preferences.region,
      preferences.language,
    );
  }

  async convertCurrency(
    amount: number,
    fromRegion: string,
    toRegion: string,
  ): Promise<{
    original: FormattedCurrency;
    converted: FormattedCurrency;
    rate: number;
  }> {
    // Note: In a real implementation, you would integrate with a currency exchange API
    // For now, we'll use mock exchange rates
    const exchangeRates: { [key: string]: { [key: string]: number } } = {
      USD: { EUR: 0.85, GBP: 0.73, INR: 83.0, CAD: 1.35 },
      EUR: { USD: 1.18, GBP: 0.86, INR: 97.5, CAD: 1.59 },
      GBP: { USD: 1.37, EUR: 1.16, INR: 113.5, CAD: 1.85 },
      INR: { USD: 0.012, EUR: 0.01, GBP: 0.0088, CAD: 0.016 },
      CAD: { USD: 0.74, EUR: 0.63, GBP: 0.54, INR: 61.5 },
    };

    const fromConfig = await this.regionalConfigModel
      .findOne({ region_code: fromRegion, is_active: true })
      .exec();
    const toConfig = await this.regionalConfigModel
      .findOne({ region_code: toRegion, is_active: true })
      .exec();

    if (!fromConfig || !toConfig) {
      throw new NotFoundException(
        'Regional configuration not found for currency conversion',
      );
    }

    const rate =
      exchangeRates[fromConfig.currency_code]?.[toConfig.currency_code] || 1;
    const convertedAmount = amount * rate;

    const original = await this.formatCurrencyForRegion(amount, fromRegion);
    const converted = await this.formatCurrencyForRegion(
      convertedAmount,
      toRegion,
    );

    return { original, converted, rate };
  }

  // Date and Time Formatting Methods
  async formatDateForRegion(
    date: Date,
    regionCode: string,
    language?: string,
    includeTime: boolean = true,
  ): Promise<FormattedDate> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    const locale = language
      ? `${language}-${regionCode}`
      : `${regionalConfig.default_language}-${regionCode}`;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: regionalConfig.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    if (includeTime) {
      if (regionalConfig.time_format === '24') {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = false;
      } else {
        options.hour = 'numeric';
        options.minute = '2-digit';
        options.hour12 = true;
      }
    }

    const formatter = new Intl.DateTimeFormat(locale, options);

    return {
      original: date,
      formatted: formatter.format(date),
      timezone: regionalConfig.timezone,
      format: regionalConfig.date_format,
    };
  }

  async formatDateForUser(
    date: Date,
    userId: string,
    includeTime: boolean = true,
  ): Promise<FormattedDate> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    return this.formatDateForRegion(
      date,
      preferences.region,
      preferences.language,
      includeTime,
    );
  }

  async convertTimezone(
    date: Date,
    fromRegion: string,
    toRegion: string,
  ): Promise<{ original: FormattedDate; converted: FormattedDate }> {
    const original = await this.formatDateForRegion(date, fromRegion);
    const converted = await this.formatDateForRegion(date, toRegion);

    return { original, converted };
  }

  // Emergency Contacts Methods
  async getEmergencyContacts(regionCode: string): Promise<EmergencyContacts> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    return {
      region_code: regionalConfig.region_code,
      region_name: regionalConfig.region_name,
      contacts: regionalConfig.emergency_contacts,
    };
  }

  async getEmergencyContactsForUser(
    userId: string,
  ): Promise<EmergencyContacts> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    return this.getEmergencyContacts(preferences.region);
  }

  async getAllEmergencyContacts(): Promise<EmergencyContacts[]> {
    const regionalConfigs = await this.regionalConfigModel
      .find({ is_active: true })
      .sort({ region_name: 1 })
      .exec();

    return regionalConfigs.map((config) => ({
      region_code: config.region_code,
      region_name: config.region_name,
      contacts: config.emergency_contacts,
    }));
  }

  // Regional Pricing Methods
  async getRegionalPricing(
    regionCode: string,
    language?: string,
  ): Promise<RegionalPricing> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    const baseFare = await this.formatCurrencyForRegion(
      regionalConfig.pricing_config.base_fare,
      regionCode,
      language,
    );
    const perKmRate = await this.formatCurrencyForRegion(
      regionalConfig.pricing_config.per_km_rate,
      regionCode,
      language,
    );
    const perMinuteRate = await this.formatCurrencyForRegion(
      regionalConfig.pricing_config.per_minute_rate,
      regionCode,
      language,
    );

    let serviceFee: FormattedCurrency | undefined;
    if (regionalConfig.regional_settings?.service_fee) {
      serviceFee = await this.formatCurrencyForRegion(
        regionalConfig.regional_settings.service_fee,
        regionCode,
        language,
      );
    }

    return {
      region_code: regionalConfig.region_code,
      currency_code: regionalConfig.currency_code,
      base_fare: baseFare,
      per_km_rate: perKmRate,
      per_minute_rate: perMinuteRate,
      surge_multiplier_max: regionalConfig.pricing_config.surge_multiplier_max,
      emergency_multiplier: regionalConfig.pricing_config.emergency_multiplier,
      ...(regionalConfig.regional_settings?.tax_rate && {
        tax_rate: regionalConfig.regional_settings.tax_rate,
      }),
      ...(serviceFee && { service_fee: serviceFee }),
    };
  }

  async getRegionalPricingForUser(userId: string): Promise<RegionalPricing> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    return this.getRegionalPricing(preferences.region, preferences.language);
  }

  async calculateFareWithRegionalSettings(
    distanceKm: number,
    durationMinutes: number,
    regionCode: string,
    isEmergency: boolean = false,
    surgeMultiplier: number = 1.0,
  ): Promise<{
    breakdown: {
      base_fare: FormattedCurrency;
      distance_fare: FormattedCurrency;
      time_fare: FormattedCurrency;
      subtotal: FormattedCurrency;
      surge_amount?: FormattedCurrency;
      emergency_amount?: FormattedCurrency;
      tax_amount?: FormattedCurrency;
      service_fee?: FormattedCurrency;
      total: FormattedCurrency;
    };
    multipliers: {
      surge: number;
      emergency: number;
    };
  }> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    const pricing = regionalConfig.pricing_config;

    // Calculate base components
    const baseFare = pricing.base_fare;
    const distanceFare = distanceKm * pricing.per_km_rate;
    const timeFare = durationMinutes * pricing.per_minute_rate;
    let subtotal = baseFare + distanceFare + timeFare;

    // Apply surge multiplier
    let surgeAmount = 0;
    if (surgeMultiplier > 1) {
      surgeAmount = subtotal * (surgeMultiplier - 1);
      subtotal += surgeAmount;
    }

    // Apply emergency multiplier
    let emergencyAmount = 0;
    if (isEmergency) {
      emergencyAmount = subtotal * (pricing.emergency_multiplier - 1);
      subtotal += emergencyAmount;
    }

    // Calculate tax
    let taxAmount = 0;
    if (regionalConfig.regional_settings?.tax_rate) {
      taxAmount = subtotal * regionalConfig.regional_settings.tax_rate;
    }

    // Add service fee
    let serviceFeeAmount = 0;
    if (regionalConfig.regional_settings?.service_fee) {
      serviceFeeAmount = regionalConfig.regional_settings.service_fee;
    }

    const total = subtotal + taxAmount + serviceFeeAmount;

    // Format all amounts
    const formatAmount = (amount: number) =>
      this.formatCurrencyForRegion(amount, regionCode);

    return {
      breakdown: {
        base_fare: await formatAmount(baseFare),
        distance_fare: await formatAmount(distanceFare),
        time_fare: await formatAmount(timeFare),
        subtotal: await formatAmount(subtotal - surgeAmount - emergencyAmount),
        ...(surgeAmount > 0 && {
          surge_amount: await formatAmount(surgeAmount),
        }),
        ...(emergencyAmount > 0 && {
          emergency_amount: await formatAmount(emergencyAmount),
        }),
        ...(taxAmount > 0 && { tax_amount: await formatAmount(taxAmount) }),
        ...(serviceFeeAmount > 0 && {
          service_fee: await formatAmount(serviceFeeAmount),
        }),
        total: await formatAmount(total),
      },
      multipliers: {
        surge: surgeMultiplier,
        emergency: isEmergency ? pricing.emergency_multiplier : 1.0,
      },
    };
  }

  // Unit System Conversion Methods
  async convertDistance(
    distanceKm: number,
    regionCode: string,
  ): Promise<{ value: number; unit: string; formatted: string }> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig) {
      throw new NotFoundException(
        `Regional configuration not found for region '${regionCode}'`,
      );
    }

    if (regionalConfig.unit_system === 'imperial') {
      const miles = distanceKm * 0.621371;
      return {
        value: Math.round(miles * 100) / 100,
        unit: 'miles',
        formatted: `${Math.round(miles * 100) / 100} mi`,
      };
    } else {
      return {
        value: Math.round(distanceKm * 100) / 100,
        unit: 'kilometers',
        formatted: `${Math.round(distanceKm * 100) / 100} km`,
      };
    }
  }

  async convertDistanceForUser(
    distanceKm: number,
    userId: string,
  ): Promise<{ value: number; unit: string; formatted: string }> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    return this.convertDistance(distanceKm, preferences.region);
  }

  // Address Formatting Methods
  async formatAddress(
    addressComponents: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      pin?: string;
      postcode?: string;
    },
    regionCode: string,
  ): Promise<string> {
    const regionalConfig = await this.regionalConfigModel
      .findOne({ region_code: regionCode, is_active: true })
      .exec();

    if (!regionalConfig || !regionalConfig.regional_settings?.address_format) {
      // Default format
      return [
        addressComponents.street,
        addressComponents.city,
        addressComponents.state,
        addressComponents.zip ||
          addressComponents.pin ||
          addressComponents.postcode,
      ]
        .filter(Boolean)
        .join(', ');
    }

    let format = regionalConfig.regional_settings.address_format;

    // Replace placeholders
    format = format.replace('{street}', addressComponents.street || '');
    format = format.replace('{city}', addressComponents.city || '');
    format = format.replace('{state}', addressComponents.state || '');
    format = format.replace('{zip}', addressComponents.zip || '');
    format = format.replace('{pin}', addressComponents.pin || '');
    format = format.replace('{postcode}', addressComponents.postcode || '');

    // Clean up extra commas and spaces
    return format.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
  }

  async formatAddressForUser(
    addressComponents: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      pin?: string;
      postcode?: string;
    },
    userId: string,
  ): Promise<string> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    return this.formatAddress(addressComponents, preferences.region);
  }
}
