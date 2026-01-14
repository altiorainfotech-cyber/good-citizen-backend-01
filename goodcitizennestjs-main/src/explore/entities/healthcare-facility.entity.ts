import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HealthcareFacilityDocument = HealthcareFacility & Document;

@Schema({ timestamps: true })
export class HealthcareFacility {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    enum: ['hospital', 'clinic', 'blood_bank', 'ambulance_service'],
    index: true,
  })
  type: string;

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

  @Prop({ required: true })
  address: string;

  @Prop({ type: [String], default: [] })
  services: string[];

  @Prop({ type: Object, default: {} })
  operatingHours: Record<string, string>;

  @Prop({
    type: {
      phone: { type: String, required: true },
      emergency: { type: String, required: true },
      email: { type: String, required: false },
    },
    required: true,
  })
  contactInfo: {
    phone: string;
    emergency: string;
    email?: string;
  };

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const HealthcareFacilitySchema =
  SchemaFactory.createForClass(HealthcareFacility);

// Create geospatial index for location-based queries
HealthcareFacilitySchema.index({ location: '2dsphere' });
HealthcareFacilitySchema.index({ type: 1, isActive: 1 });
HealthcareFacilitySchema.index({ services: 1 });
