import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LocalizedContent,
  LocalizedContentDocument,
} from './entities/localized-content.entity';
import {
  RegionalConfig,
  RegionalConfigDocument,
} from './entities/regional-config.entity';

@Injectable()
export class LocalizationSeeder {
  constructor(
    @InjectModel(LocalizedContent.name)
    private localizedContentModel: Model<LocalizedContentDocument>,
    @InjectModel(RegionalConfig.name)
    private regionalConfigModel: Model<RegionalConfigDocument>,
  ) {}

  async seedRegionalConfigs(): Promise<void> {
    const configs = [
      {
        region_code: 'US',
        region_name: 'United States',
        currency_code: 'USD',
        currency_symbol: '$',
        currency_decimal_places: 2,
        default_language: 'en',
        supported_languages: ['en', 'es'],
        timezone: 'America/New_York',
        date_format: 'MM/DD/YYYY',
        time_format: '12',
        unit_system: 'imperial',
        emergency_contacts: {
          police: '911',
          fire: '911',
          ambulance: '911',
          general_emergency: '911',
        },
        pricing_config: {
          base_fare: 2.5,
          per_km_rate: 1.2,
          per_minute_rate: 0.25,
          surge_multiplier_max: 3.0,
          emergency_multiplier: 1.5,
        },
        regional_settings: {
          address_format: '{street}, {city}, {state} {zip}',
          phone_format: '(XXX) XXX-XXXX',
          postal_code_format: 'XXXXX',
          tax_rate: 0.08,
          service_fee: 1.0,
        },
        is_active: true,
      },
      {
        region_code: 'IN',
        region_name: 'India',
        currency_code: 'INR',
        currency_symbol: '₹',
        currency_decimal_places: 2,
        default_language: 'hi',
        supported_languages: ['hi', 'en'],
        timezone: 'Asia/Kolkata',
        date_format: 'DD/MM/YYYY',
        time_format: '24',
        unit_system: 'metric',
        emergency_contacts: {
          police: '100',
          fire: '101',
          ambulance: '108',
          general_emergency: '112',
        },
        pricing_config: {
          base_fare: 25.0,
          per_km_rate: 12.0,
          per_minute_rate: 2.0,
          surge_multiplier_max: 2.5,
          emergency_multiplier: 1.3,
        },
        regional_settings: {
          address_format: '{street}, {city}, {state} - {pin}',
          phone_format: '+91 XXXXX XXXXX',
          postal_code_format: 'XXXXXX',
          tax_rate: 0.18,
          service_fee: 10.0,
        },
        is_active: true,
      },
      {
        region_code: 'GB',
        region_name: 'United Kingdom',
        currency_code: 'GBP',
        currency_symbol: '£',
        currency_decimal_places: 2,
        default_language: 'en',
        supported_languages: ['en'],
        timezone: 'Europe/London',
        date_format: 'DD/MM/YYYY',
        time_format: '24',
        unit_system: 'metric',
        emergency_contacts: {
          police: '999',
          fire: '999',
          ambulance: '999',
          general_emergency: '999',
        },
        pricing_config: {
          base_fare: 2.0,
          per_km_rate: 1.5,
          per_minute_rate: 0.3,
          surge_multiplier_max: 2.8,
          emergency_multiplier: 1.4,
        },
        regional_settings: {
          address_format: '{street}, {city}, {postcode}',
          phone_format: '+44 XXXX XXXXXX',
          postal_code_format: 'XX XX XXX',
          tax_rate: 0.2,
          service_fee: 1.5,
        },
        is_active: true,
      },
    ];

    for (const config of configs) {
      await this.regionalConfigModel.findOneAndUpdate(
        { region_code: config.region_code },
        config,
        { upsert: true, new: true },
      );
    }
// console.log removed
  }

  async seedLocalizedContent(): Promise<void> {
    const contents = [
      // English - US
      {
        content_key: 'welcome_message',
        language: 'en',
        region: 'US',
        content:
          'Welcome to Good Citizen! Your ride-hailing app for emergency and regular transportation.',
        content_type: 'text',
        category: 'general',
        is_active: true,
      },
      {
        content_key: 'ride_request_success',
        language: 'en',
        region: 'US',
        content:
          'Your ride has been requested successfully. Finding a driver nearby...',
        content_type: 'text',
        category: 'notification',
        is_active: true,
      },
      {
        content_key: 'emergency_alert',
        language: 'en',
        region: 'US',
        content:
          'Emergency vehicle approaching! Please clear the path. ETA: {eta} seconds.',
        content_type: 'text',
        category: 'emergency',
        metadata: {
          variables: ['eta'],
        },
        is_active: true,
      },
      {
        content_key: 'driver_assigned',
        language: 'en',
        region: 'US',
        content:
          'Driver {driverName} has been assigned to your ride. Vehicle: {vehicle} ({plate})',
        content_type: 'text',
        category: 'notification',
        metadata: {
          variables: ['driverName', 'vehicle', 'plate'],
        },
        is_active: true,
      },
      {
        content_key: 'ride_completed',
        language: 'en',
        region: 'US',
        content:
          'Your ride has been completed. Total fare: {fare}. Thank you for using Good Citizen!',
        content_type: 'text',
        category: 'notification',
        metadata: {
          variables: ['fare'],
        },
        is_active: true,
      },
      {
        content_key: 'error_no_drivers',
        language: 'en',
        region: 'US',
        content: 'No drivers available in your area. Please try again later.',
        content_type: 'text',
        category: 'error',
        is_active: true,
      },

      // Spanish - US
      {
        content_key: 'welcome_message',
        language: 'es',
        region: 'US',
        content:
          '¡Bienvenido a Good Citizen! Tu aplicación de transporte para emergencias y viajes regulares.',
        content_type: 'text',
        category: 'general',
        is_active: true,
      },
      {
        content_key: 'ride_request_success',
        language: 'es',
        region: 'US',
        content:
          'Tu viaje ha sido solicitado exitosamente. Buscando un conductor cercano...',
        content_type: 'text',
        category: 'notification',
        is_active: true,
      },
      {
        content_key: 'emergency_alert',
        language: 'es',
        region: 'US',
        content:
          '¡Vehículo de emergencia acercándose! Por favor despeja el camino. Tiempo estimado: {eta} segundos.',
        content_type: 'text',
        category: 'emergency',
        metadata: {
          variables: ['eta'],
        },
        is_active: true,
      },
      {
        content_key: 'driver_assigned',
        language: 'es',
        region: 'US',
        content:
          'El conductor {driverName} ha sido asignado a tu viaje. Vehículo: {vehicle} ({plate})',
        content_type: 'text',
        category: 'notification',
        metadata: {
          variables: ['driverName', 'vehicle', 'plate'],
        },
        is_active: true,
      },
      {
        content_key: 'error_no_drivers',
        language: 'es',
        region: 'US',
        content:
          'No hay conductores disponibles en tu área. Por favor intenta más tarde.',
        content_type: 'text',
        category: 'error',
        is_active: true,
      },

      // Hindi - India
      {
        content_key: 'welcome_message',
        language: 'hi',
        region: 'IN',
        content:
          'गुड सिटिज़न में आपका स्वागत है! आपातकालीन और नियमित परिवहन के लिए आपका राइड-हेलिंग ऐप।',
        content_type: 'text',
        category: 'general',
        is_active: true,
      },
      {
        content_key: 'ride_request_success',
        language: 'hi',
        region: 'IN',
        content:
          'आपकी राइड सफलतापूर्वक अनुरोधित की गई है। पास में ड्राइवर खोजा जा रहा है...',
        content_type: 'text',
        category: 'notification',
        is_active: true,
      },
      {
        content_key: 'emergency_alert',
        language: 'hi',
        region: 'IN',
        content:
          'आपातकालीन वाहन आ रहा है! कृपया रास्ता साफ करें। अनुमानित समय: {eta} सेकंड।',
        content_type: 'text',
        category: 'emergency',
        metadata: {
          variables: ['eta'],
        },
        is_active: true,
      },
      {
        content_key: 'driver_assigned',
        language: 'hi',
        region: 'IN',
        content:
          'ड्राइवर {driverName} आपकी राइड के लिए नियुक्त किया गया है। वाहन: {vehicle} ({plate})',
        content_type: 'text',
        category: 'notification',
        metadata: {
          variables: ['driverName', 'vehicle', 'plate'],
        },
        is_active: true,
      },
      {
        content_key: 'error_no_drivers',
        language: 'hi',
        region: 'IN',
        content:
          'आपके क्षेत्र में कोई ड्राइवर उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।',
        content_type: 'text',
        category: 'error',
        is_active: true,
      },

      // English - India (fallback)
      {
        content_key: 'welcome_message',
        language: 'en',
        region: 'IN',
        content:
          'Welcome to Good Citizen! Your ride-hailing app for emergency and regular transportation.',
        content_type: 'text',
        category: 'general',
        is_active: true,
      },
      {
        content_key: 'ride_request_success',
        language: 'en',
        region: 'IN',
        content:
          'Your ride has been requested successfully. Finding a driver nearby...',
        content_type: 'text',
        category: 'notification',
        is_active: true,
      },
      {
        content_key: 'emergency_alert',
        language: 'en',
        region: 'IN',
        content:
          'Emergency vehicle approaching! Please clear the path. ETA: {eta} seconds.',
        content_type: 'text',
        category: 'emergency',
        metadata: {
          variables: ['eta'],
        },
        is_active: true,
      },

      // English - UK
      {
        content_key: 'welcome_message',
        language: 'en',
        region: 'GB',
        content:
          'Welcome to Good Citizen! Your ride-hailing app for emergency and regular transport.',
        content_type: 'text',
        category: 'general',
        is_active: true,
      },
      {
        content_key: 'ride_request_success',
        language: 'en',
        region: 'GB',
        content:
          'Your ride has been requested successfully. Finding a driver nearby...',
        content_type: 'text',
        category: 'notification',
        is_active: true,
      },
      {
        content_key: 'emergency_alert',
        language: 'en',
        region: 'GB',
        content:
          'Emergency vehicle approaching! Please clear the way. ETA: {eta} seconds.',
        content_type: 'text',
        category: 'emergency',
        metadata: {
          variables: ['eta'],
        },
        is_active: true,
      },
    ];

    for (const content of contents) {
      await this.localizedContentModel.findOneAndUpdate(
        {
          content_key: content.content_key,
          language: content.language,
          region: content.region,
        },
        content,
        { upsert: true, new: true },
      );
    }
// console.log removed
  }

  async seedAll(): Promise<void> {
    await this.seedRegionalConfigs();
    await this.seedLocalizedContent();
// console.log removed
  }
}
