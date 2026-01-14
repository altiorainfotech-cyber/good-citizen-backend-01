import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RegionalConfigDocument = RegionalConfig & Document;

@Schema({ timestamps: true })
export class RegionalConfig {
  @Prop({ required: true })
  region_code: string; // ISO 3166-1 alpha-2 (US, IN, GB, etc.)

  @Prop({ required: true })
  region_name: string;

  @Prop({ required: true })
  currency_code: string; // ISO 4217 (USD, INR, GBP, etc.)

  @Prop({ required: true })
  currency_symbol: string;

  @Prop({ required: true, default: 2 })
  currency_decimal_places: number;

  @Prop({ required: true })
  default_language: string;

  @Prop({ type: [String], required: true })
  supported_languages: string[];

  @Prop({ required: true })
  timezone: string; // IANA timezone (America/New_York, Asia/Kolkata, etc.)

  @Prop({ required: true, default: 'MM/DD/YYYY' })
  date_format: string;

  @Prop({ required: true, default: '12' })
  time_format: string; // '12' or '24'

  @Prop({ required: true, default: 'imperial' })
  unit_system: string; // 'metric' or 'imperial'

  @Prop({ type: Object, required: true })
  emergency_contacts: {
    police?: string;
    fire?: string;
    ambulance?: string;
    general_emergency?: string;
  };

  @Prop({ type: Object, required: true })
  pricing_config: {
    base_fare: number;
    per_km_rate: number;
    per_minute_rate: number;
    surge_multiplier_max: number;
    emergency_multiplier: number;
  };

  @Prop({ type: Object, default: {} })
  regional_settings: {
    address_format?: string;
    phone_format?: string;
    postal_code_format?: string;
    tax_rate?: number;
    service_fee?: number;
  };

  @Prop({ required: true, default: true })
  is_active: boolean;

  @Prop({ default: Date.now })
  created_at: Date;

  @Prop({ default: Date.now })
  updated_at: Date;
}

export const RegionalConfigSchema =
  SchemaFactory.createForClass(RegionalConfig);

// Create indexes
RegionalConfigSchema.index({ region_code: 1 }, { unique: true });
RegionalConfigSchema.index({ is_active: 1 });
RegionalConfigSchema.index({ supported_languages: 1 });
