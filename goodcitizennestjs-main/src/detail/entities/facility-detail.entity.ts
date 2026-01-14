import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FacilityDetailDocument = FacilityDetail & Document;

@Schema({ timestamps: true })
export class FacilityDetail {
  @Prop({ required: true })
  facilityId: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    enum: ['hospital', 'station', 'blood_bank', 'clinic', 'emergency_center'],
    required: true,
  })
  type: string;

  @Prop({ required: true })
  address: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ type: [String], default: [] })
  services: string[];

  @Prop({
    type: {
      monday: { open: String, close: String, is24Hours: Boolean },
      tuesday: { open: String, close: String, is24Hours: Boolean },
      wednesday: { open: String, close: String, is24Hours: Boolean },
      thursday: { open: String, close: String, is24Hours: Boolean },
      friday: { open: String, close: String, is24Hours: Boolean },
      saturday: { open: String, close: String, is24Hours: Boolean },
      sunday: { open: String, close: String, is24Hours: Boolean },
    },
    default: {},
  })
  operatingHours: {
    monday: { open: string; close: string; is24Hours: boolean };
    tuesday: { open: string; close: string; is24Hours: boolean };
    wednesday: { open: string; close: string; is24Hours: boolean };
    thursday: { open: string; close: string; is24Hours: boolean };
    friday: { open: string; close: string; is24Hours: boolean };
    saturday: { open: string; close: string; is24Hours: boolean };
    sunday: { open: string; close: string; is24Hours: boolean };
  };

  @Prop({
    type: {
      phone: String,
      emergency: String,
      email: String,
      website: String,
      fax: String,
    },
    required: true,
  })
  contactInfo: {
    phone: string;
    emergency: string;
    email?: string;
    website?: string;
    fax?: string;
  };

  @Prop({ type: Number, min: 0, max: 100 })
  realTimeCapacity?: number; // percentage of available capacity

  @Prop({ type: [String], default: [] })
  specializations: string[];

  @Prop({
    type: {
      hasEmergency: Boolean,
      hasAmbulance: Boolean,
      hasICU: Boolean,
      hasBloodBank: Boolean,
      emergencyWaitTime: Number,
    },
    default: {},
  })
  emergencyServices: {
    hasEmergency: boolean;
    hasAmbulance: boolean;
    hasICU: boolean;
    hasBloodBank: boolean;
    emergencyWaitTime?: number; // in minutes
  };

  @Prop({
    type: {
      rating: Number,
      reviewCount: Number,
      lastUpdated: Date,
    },
    default: {},
  })
  ratings: {
    rating: number;
    reviewCount: number;
    lastUpdated: Date;
  };

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  isVerified: boolean;
}

export const FacilityDetailSchema =
  SchemaFactory.createForClass(FacilityDetail);

// Create indexes
FacilityDetailSchema.index({ 'location.coordinates': '2dsphere' });
FacilityDetailSchema.index({ facilityId: 1 });
FacilityDetailSchema.index({ type: 1 });
FacilityDetailSchema.index({ isActive: 1, isVerified: 1 });
