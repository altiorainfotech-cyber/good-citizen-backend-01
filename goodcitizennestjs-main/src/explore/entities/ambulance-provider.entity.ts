import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AmbulanceProviderDocument = AmbulanceProvider & Document;

@Schema({ timestamps: true })
export class AmbulanceProvider {
  @Prop({ required: true })
  name: string;

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

  @Prop({ required: true, min: 0 })
  responseTime: number; // in minutes

  @Prop({
    required: true,
    enum: ['basic', 'advanced', 'critical'],
    index: true,
  })
  vehicleType: string;

  @Prop({ default: true, index: true })
  availability: boolean;

  @Prop({ required: true })
  contactNumber: string;

  @Prop({ type: [String], default: [] })
  services: string[];

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

  @Prop({ type: Object, default: {} })
  operatingHours: Record<string, string>;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const AmbulanceProviderSchema =
  SchemaFactory.createForClass(AmbulanceProvider);

// Create geospatial index for location-based queries
AmbulanceProviderSchema.index({ location: '2dsphere' });
AmbulanceProviderSchema.index({ isActive: 1, availability: 1 });
AmbulanceProviderSchema.index({ vehicleType: 1 });
AmbulanceProviderSchema.index({ responseTime: 1 });
