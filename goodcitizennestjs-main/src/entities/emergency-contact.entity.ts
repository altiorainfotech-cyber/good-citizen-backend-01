import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmergencyContactDocument = EmergencyContact & Document;

@Schema({ timestamps: true })
export class EmergencyContact {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    enum: ['police', 'fire', 'medical', 'ambulance', 'general', 'disaster'],
    index: true,
  })
  serviceType: string;

  @Prop({ required: true })
  contactNumber: string;

  @Prop({ type: String })
  alternateNumber?: string;

  @Prop({ type: String })
  email?: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    required: true,
    enum: ['national', 'state', 'city', 'local'],
    index: true,
  })
  scope: string;

  @Prop({ type: String, index: true })
  state?: string;

  @Prop({ type: String, index: true })
  city?: string;

  @Prop({ type: String })
  district?: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  })
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ type: Number, min: 0 })
  coverageRadius?: number; // in kilometers

  @Prop({ type: String, default: '24/7' })
  availability: string;

  @Prop({ type: [String], default: [] })
  languages: string[];

  @Prop({
    required: true,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
    index: true,
  })
  status: string;

  @Prop({ type: Object, default: {} })
  operatingHours?: Record<string, string>;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const EmergencyContactSchema =
  SchemaFactory.createForClass(EmergencyContact);

// Create indexes for efficient location-based queries
EmergencyContactSchema.index({ location: '2dsphere' });
EmergencyContactSchema.index({ serviceType: 1, scope: 1 });
EmergencyContactSchema.index({ state: 1, city: 1 });
EmergencyContactSchema.index({ status: 1, isActive: 1 });
