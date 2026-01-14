import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmergencyRequestDocument = EmergencyRequest & Document;

@Schema({ timestamps: true })
export class EmergencyRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['ambulance', 'police', 'fire', 'medical', 'general'],
    index: true,
  })
  emergencyType: string;

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
    required: true,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true,
  })
  priority: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String })
  contactNumber?: string;

  @Prop({ type: Types.ObjectId, ref: 'AmbulanceProvider', index: true })
  assignedProviderId?: Types.ObjectId;

  @Prop({ type: Date, index: true })
  assignedAt?: Date;

  @Prop({ type: Date })
  respondedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Number, min: 0 })
  estimatedResponseTime?: number; // in minutes

  @Prop({ type: Number, min: 0 })
  actualResponseTime?: number; // in minutes

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: [String], default: [] })
  notificationsSent: string[]; // Track which notifications have been sent

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const EmergencyRequestSchema =
  SchemaFactory.createForClass(EmergencyRequest);

// Create indexes for efficient queries
EmergencyRequestSchema.index({ location: '2dsphere' });
EmergencyRequestSchema.index({ userId: 1, status: 1 });
EmergencyRequestSchema.index({ emergencyType: 1, status: 1 });
EmergencyRequestSchema.index({ priority: 1, createdAt: -1 });
EmergencyRequestSchema.index({ assignedProviderId: 1, status: 1 });
EmergencyRequestSchema.index({ createdAt: -1 });
