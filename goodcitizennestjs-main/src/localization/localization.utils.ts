/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable } from '@nestjs/common';
import { LocalizationService } from './localization.service';
import { RegionalCustomizationService } from './regional-customization.service';

export interface LocalizedNotification {
  title: string;
  message: string;
  data?: any;
  localized_at: Date;
  language: string;
  region: string;
}

export interface LocalizedError {
  error: string;
  message: string;
  statusCode: number;
  localized_at: Date;
  language: string;
  region: string;
}

@Injectable()
export class LocalizationUtils {
  constructor(
    private localizationService: LocalizationService,
    private regionalCustomizationService: RegionalCustomizationService,
  ) {}

  // Notification Localization
  async localizeNotification(
    titleKey: string,
    messageKey: string,
    userId: string,
    variables?: { [key: string]: any },
  ): Promise<LocalizedNotification> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);

    const titleContent = await this.localizationService.getLocalizedContent(
      titleKey,
      preferences.language,
      preferences.region,
    );

    const messageContent = await this.localizationService.getLocalizedContent(
      messageKey,
      preferences.language,
      preferences.region,
    );

    let title = titleContent?.content || titleKey;
    let message = messageContent?.content || messageKey;

    // Replace variables in content
    if (variables) {
      title = this.replaceVariables(title, variables);
      message = this.replaceVariables(message, variables);
    }

    return {
      title,
      message,
      data: variables,
      localized_at: new Date(),
      language: preferences.language,
      region: preferences.region,
    };
  }

  async localizeNotificationForRegion(
    titleKey: string,
    messageKey: string,
    language: string,
    region: string,
    variables?: { [key: string]: any },
  ): Promise<LocalizedNotification> {
    const titleContent = await this.localizationService.getLocalizedContent(
      titleKey,
      language,
      region,
    );

    const messageContent = await this.localizationService.getLocalizedContent(
      messageKey,
      language,
      region,
    );

    let title = titleContent?.content || titleKey;
    let message = messageContent?.content || messageKey;

    // Replace variables in content
    if (variables) {
      title = this.replaceVariables(title, variables);
      message = this.replaceVariables(message, variables);
    }

    return {
      title,
      message,
      data: variables,
      localized_at: new Date(),
      language,
      region,
    };
  }

  // Error Localization
  async localizeError(
    errorKey: string,
    statusCode: number,
    userId: string,
    variables?: { [key: string]: any },
  ): Promise<LocalizedError> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);

    const errorContent = await this.localizationService.getLocalizedContent(
      errorKey,
      preferences.language,
      preferences.region,
    );

    let message = errorContent?.content || errorKey;

    // Replace variables in content
    if (variables) {
      message = this.replaceVariables(message, variables);
    }

    return {
      error: errorKey,
      message,
      statusCode,
      localized_at: new Date(),
      language: preferences.language,
      region: preferences.region,
    };
  }

  async localizeErrorForRegion(
    errorKey: string,
    statusCode: number,
    language: string,
    region: string,
    variables?: { [key: string]: any },
  ): Promise<LocalizedError> {
    const errorContent = await this.localizationService.getLocalizedContent(
      errorKey,
      language,
      region,
    );

    let message = errorContent?.content || errorKey;

    // Replace variables in content
    if (variables) {
      message = this.replaceVariables(message, variables);
    }

    return {
      error: errorKey,
      message,
      statusCode,
      localized_at: new Date(),
      language,
      region,
    };
  }

  // Ride Information Localization
  async localizeRideInfo(
    rideData: {
      fare?: number;
      distance_km?: number;
      duration_minutes?: number;
      pickup_time?: Date;
      dropoff_time?: Date;
    },
    userId: string,
  ): Promise<{
    fare_formatted?: string;
    distance_formatted?: string;
    duration_formatted?: string;
    pickup_time_formatted?: string;
    dropoff_time_formatted?: string;
    currency?: string;
    distance_unit?: string;
    language: string;
    region: string;
  }> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    const result: any = {
      language: preferences.language,
      region: preferences.region,
    };

    // Format fare
    if (rideData.fare !== undefined) {
      const formattedFare =
        await this.regionalCustomizationService.formatCurrencyForUser(
          rideData.fare,
          userId,
        );
      result.fare_formatted = formattedFare.formatted;
      result.currency = formattedFare.currency_code;
    }

    // Format distance
    if (rideData.distance_km !== undefined) {
      const convertedDistance =
        await this.regionalCustomizationService.convertDistanceForUser(
          rideData.distance_km,
          userId,
        );
      result.distance_formatted = convertedDistance.formatted;
      result.distance_unit = convertedDistance.unit;
    }

    // Format duration
    if (rideData.duration_minutes !== undefined) {
      result.duration_formatted = this.formatDuration(
        rideData.duration_minutes,
        preferences.language,
      );
    }

    // Format pickup time
    if (rideData.pickup_time) {
      const formattedPickup =
        await this.regionalCustomizationService.formatDateForUser(
          rideData.pickup_time,
          userId,
        );
      result.pickup_time_formatted = formattedPickup.formatted;
    }

    // Format dropoff time
    if (rideData.dropoff_time) {
      const formattedDropoff =
        await this.regionalCustomizationService.formatDateForUser(
          rideData.dropoff_time,
          userId,
        );
      result.dropoff_time_formatted = formattedDropoff.formatted;
    }

    return result;
  }

  // Emergency Alert Localization
  async localizeEmergencyAlert(
    alertData: {
      vehicle_type: string;
      eta_seconds: number;
      driver_name?: string;
    },
    userId: string,
  ): Promise<LocalizedNotification> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);

    // Get emergency contacts for context
    const emergencyContacts =
      await this.regionalCustomizationService.getEmergencyContactsForUser(
        userId,
      );

    const variables = {
      vehicle_type: alertData.vehicle_type,
      eta: alertData.eta_seconds.toString(),
      driver_name: alertData.driver_name || 'Emergency Vehicle',
      emergency_number: emergencyContacts.contacts.general_emergency || '911',
    };

    return this.localizeNotificationForRegion(
      'emergency_alert_title',
      'emergency_alert',
      preferences.language,
      preferences.region,
      variables,
    );
  }

  // Utility Methods
  private replaceVariables(
    content: string,
    variables: { [key: string]: any },
  ): string {
    let result = content;

    Object.keys(variables).forEach((key) => {
      const placeholder = `{${key}}`;
      const value = variables[key]?.toString() || '';
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
  }

  private formatDuration(minutes: number, language: string): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (language === 'es') {
      if (hours > 0) {
        return `${hours}h ${remainingMinutes}min`;
      }
      return `${remainingMinutes}min`;
    } else if (language === 'hi') {
      if (hours > 0) {
        return `${hours} घंटे ${remainingMinutes} मिनट`;
      }
      return `${remainingMinutes} मिनट`;
    } else {
      // Default English
      if (hours > 0) {
        return `${hours}h ${remainingMinutes}min`;
      }
      return `${remainingMinutes}min`;
    }
  }

  // Batch Localization
  async localizeContentBatch(
    contentKeys: string[],
    userId: string,
    variables?: { [key: string]: { [key: string]: any } },
  ): Promise<{ [key: string]: string }> {
    const preferences =
      await this.localizationService.getUserPreferences(userId);
    const contents = await this.localizationService.getLocalizedContentBatch(
      contentKeys,
      preferences.language,
      preferences.region,
    );

    const result: { [key: string]: string } = {};

    Object.keys(contents).forEach((key) => {
      const contentItem = contents[key];
      if (!contentItem) return;

      let content = contentItem.content;

      // Replace variables if provided
      if (variables && variables[key]) {
        content = this.replaceVariables(content, variables[key]);
      }

      result[key] = content;
    });

    return result;
  }

  // Validation Helpers
  isValidLanguageCode(language: string): boolean {
    const validLanguages = [
      'en',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'hi',
      'zh',
      'ja',
      'ko',
      'ar',
    ];
    return validLanguages.includes(language.toLowerCase());
  }

  isValidRegionCode(region: string): boolean {
    const validRegions = [
      'US',
      'CA',
      'GB',
      'FR',
      'DE',
      'IT',
      'ES',
      'PT',
      'IN',
      'CN',
      'JP',
      'KR',
      'AU',
      'BR',
      'MX',
    ];
    return validRegions.includes(region.toUpperCase());
  }

  getDefaultLanguageForRegion(region: string): string {
    const regionLanguageMap: { [key: string]: string } = {
      US: 'en',
      CA: 'en',
      GB: 'en',
      AU: 'en',
      FR: 'fr',
      DE: 'de',
      IT: 'it',
      ES: 'es',
      PT: 'pt',
      BR: 'pt',
      MX: 'es',
      IN: 'hi',
      CN: 'zh',
      JP: 'ja',
      KR: 'ko',
    };

    return regionLanguageMap[region.toUpperCase()] || 'en';
  }
}
