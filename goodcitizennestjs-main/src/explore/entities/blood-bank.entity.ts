import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BloodBankDocument = BloodBank & Document;

@Schema({ timestamps: true })
export class BloodBank {
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

  @Prop({ required: true })
  address: string;

  @Prop({
    type: {
      'A+': { type: Number, default: 0 },
      'A-': { type: Number, default: 0 },
      'B+': { type: Number, default: 0 },
      'B-': { type: Number, default: 0 },
      'AB+': { type: Number, default: 0 },
      'AB-': { type: Number, default: 0 },
      'O+': { type: Number, default: 0 },
      'O-': { type: Number, default: 0 },
    },
    default: {},
  })
  bloodTypes: Record<string, number>;

  @Prop({ type: Object, default: {} })
  operatingHours: Record<string, string>;

  @Prop({ required: true })
  emergencyContact: string;

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

export const BloodBankSchema = SchemaFactory.createForClass(BloodBank);

// Create geospatial index for location-based queries
BloodBankSchema.index({ location: '2dsphere' });
BloodBankSchema.index({ isActive: 1 });
// Create compound indexes for blood type availability queries
BloodBankSchema.index({ 'bloodTypes.A+': 1 });
BloodBankSchema.index({ 'bloodTypes.A-': 1 });
BloodBankSchema.index({ 'bloodTypes.B+': 1 });
BloodBankSchema.index({ 'bloodTypes.B-': 1 });
BloodBankSchema.index({ 'bloodTypes.AB+': 1 });
BloodBankSchema.index({ 'bloodTypes.AB-': 1 });
BloodBankSchema.index({ 'bloodTypes.O+': 1 });
BloodBankSchema.index({ 'bloodTypes.O-': 1 });
