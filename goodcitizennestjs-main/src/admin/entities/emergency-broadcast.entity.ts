/* eslint-disable @typescript-eslint/no-unused-vars */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ versionKey: false })
export class EmergencyBroadcast {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  priority: string;

  @Prop({ enum: ['users', 'drivers', 'all'], default: 'all' })
  target_audience: string;

  @Prop()
  target_area: string; // Geographic area or 'all'

  @Prop({ required: true })
  created_by: string; // Admin user ID

  @Prop({ default: 0 })
  recipients_count: number; // Number of users who received the broadcast

  @Prop({ default: 0 })
  delivered_count: number; // Number of successful deliveries

  @Prop({ default: 0 })
  failed_count: number; // Number of failed deliveries

  @Prop({ enum: ['draft', 'sent', 'failed'], default: 'draft' })
  status: string;

  @Prop()
  sent_at: Date;

  @Prop({ default: Date.now })
  created_at: Date;

  @Prop({ default: Date.now })
  updated_at: Date;
}

export type EmergencyBroadcastDocument = HydratedDocument<EmergencyBroadcast>;
export const EmergencyBroadcastSchema =
  SchemaFactory.createForClass(EmergencyBroadcast);

// Indexes
EmergencyBroadcastSchema.index({ created_by: 1, created_at: -1 });
EmergencyBroadcastSchema.index({ status: 1, priority: 1 });
EmergencyBroadcastSchema.index({ sent_at: -1 });
