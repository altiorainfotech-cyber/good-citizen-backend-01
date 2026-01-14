import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface LocalizationContext {
  language?: string;
  region?: string;
  timezone?: string;
  acceptLanguages?: string[];
}

declare global {
  namespace Express {
    interface Request {
      localization?: LocalizationContext;
    }
  }
}

@Injectable()
export class LocalizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const localization: LocalizationContext = {};

    // Extract language from Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      const languages = this.parseAcceptLanguage(acceptLanguage);
      localization.acceptLanguages = languages;
      const primaryLanguage = languages[0]?.split('-')[0];
      if (primaryLanguage) {
        localization.language = primaryLanguage;
      }
    }

    // Extract region from custom headers or query parameters
    const regionHeader = req.headers['x-region'] as string;
    const regionQuery = req.query.region as string;
    if (regionHeader) {
      localization.region = regionHeader.toUpperCase();
    } else if (regionQuery) {
      localization.region = regionQuery.toUpperCase();
    }

    // Extract timezone from custom headers
    const timezoneHeader = req.headers['x-timezone'] as string;
    if (timezoneHeader) {
      localization.timezone = timezoneHeader;
    }

    // Try to detect region from Accept-Language if not explicitly provided
    if (!localization.region && acceptLanguage) {
      const languageWithRegion = localization.acceptLanguages?.find((lang) =>
        lang.includes('-'),
      );
      if (languageWithRegion) {
        const parts = languageWithRegion.split('-');
        const region = parts[1];
        if (region) {
          localization.region = region.toUpperCase();
        }
      }
    }

    // Set defaults if not detected
    if (!localization.language) {
      localization.language = 'en';
    }
    if (!localization.region) {
      localization.region = 'US';
    }
    if (!localization.timezone) {
      localization.timezone = 'UTC';
    }

    req.localization = localization;
    next();
  }

  private parseAcceptLanguage(acceptLanguage: string): string[] {
    return acceptLanguage
      .split(',')
      .map((lang) => {
        const [language, quality] = lang.trim().split(';q=');
        return {
          language: language?.trim() ?? '',
          quality: quality ? parseFloat(quality) : 1.0,
        };
      })
      .sort((a, b) => b.quality - a.quality)
      .map((item) => item.language);
  }
}
