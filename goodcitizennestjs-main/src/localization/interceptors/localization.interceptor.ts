/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LocalizationService } from '../localization.service';
import { RegionalCustomizationService } from '../regional-customization.service';

@Injectable()
export class LocalizationInterceptor implements NestInterceptor {
  constructor(
    private localizationService: LocalizationService,
    private regionalCustomizationService: RegionalCustomizationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const localization = request.localization;

    return next.handle().pipe(
      map(async (data) => {
        // Only process if we have localization context
        if (!localization || !data) {
          return data;
        }

        // Process different types of responses
        if (this.shouldLocalizeResponse(data)) {
          return await this.localizeResponse(data, localization);
        }

        return data;
      }),
    );
  }

  private shouldLocalizeResponse(data: any): boolean {
    // Check if response contains localizable content
    return (
      data &&
      typeof data === 'object' &&
      (data.hasOwnProperty('message') ||
        data.hasOwnProperty('content') ||
        data.hasOwnProperty('amount') ||
        data.hasOwnProperty('date') ||
        data.hasOwnProperty('fare') ||
        data.hasOwnProperty('price'))
    );
  }

  private async localizeResponse(data: any, localization: any): Promise<any> {
    const localizedData = { ...data };

    try {
      // Localize currency amounts
      if (data.amount && typeof data.amount === 'number') {
        const formatted =
          await this.regionalCustomizationService.formatCurrencyForRegion(
            data.amount,
            localization.region,
            localization.language,
          );
        localizedData.amount_formatted = formatted.formatted;
        localizedData.currency = formatted.currency_code;
      }

      // Localize fare information
      if (data.fare && typeof data.fare === 'number') {
        const formatted =
          await this.regionalCustomizationService.formatCurrencyForRegion(
            data.fare,
            localization.region,
            localization.language,
          );
        localizedData.fare_formatted = formatted.formatted;
        localizedData.currency = formatted.currency_code;
      }

      // Localize price information
      if (data.price && typeof data.price === 'number') {
        const formatted =
          await this.regionalCustomizationService.formatCurrencyForRegion(
            data.price,
            localization.region,
            localization.language,
          );
        localizedData.price_formatted = formatted.formatted;
        localizedData.currency = formatted.currency_code;
      }

      // Localize date information
      if (data.date) {
        const date = new Date(data.date);
        const formatted =
          await this.regionalCustomizationService.formatDateForRegion(
            date,
            localization.region,
            localization.language,
          );
        localizedData.date_formatted = formatted.formatted;
        localizedData.timezone = formatted.timezone;
      }

      // Localize distance information
      if (data.distance_km && typeof data.distance_km === 'number') {
        const converted =
          await this.regionalCustomizationService.convertDistance(
            data.distance_km,
            localization.region,
          );
        localizedData.distance_formatted = converted.formatted;
        localizedData.distance_unit = converted.unit;
      }

      // Localize message content if it's a content key
      if (data.message && typeof data.message === 'string') {
        const localizedContent =
          await this.localizationService.getLocalizedContent(
            data.message,
            localization.language,
            localization.region,
          );
        if (localizedContent) {
          localizedData.message = localizedContent.content;
          localizedData.message_localized = true;
        }
      }

      // Localize content field
      if (data.content && typeof data.content === 'string') {
        const localizedContent =
          await this.localizationService.getLocalizedContent(
            data.content,
            localization.language,
            localization.region,
          );
        if (localizedContent) {
          localizedData.content = localizedContent.content;
          localizedData.content_localized = true;
        }
      }

      // Add localization metadata
      localizedData._localization = {
        language: localization.language,
        region: localization.region,
        timezone: localization.timezone,
        localized_at: new Date().toISOString(),
      };

      return localizedData;
    } catch (error) {
      // If localization fails, return original data
      console.error('Localization error:', error);
      return data;
    }
  }
}
