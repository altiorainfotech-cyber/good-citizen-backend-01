import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ versionKey: false })
export class SystemMetrics {
  @Prop({ required: true })
  metric_type: string; // 'performance', 'usage', 'errors', 'rides', 'users'

  @Prop({ required: true })
  metric_name: string; // 'active_users', 'response_time', 'error_rate', etc.

  @Prop({ required: true })
  value: number;

  @Prop()
  unit: string; // 'ms', 'count', 'percentage', etc.

  @Prop({ type: Object })
  metadata: any; // Additional context data

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: Date.now })
  created_at: Date;
}

export type SystemMetricsDocument = HydratedDocument<SystemMetrics>;
export const SystemMetricsSchema = SchemaFactory.createForClass(SystemMetrics);

// Indexes
SystemMetricsSchema.index({ metric_type: 1, timestamp: -1 });
SystemMetricsSchema.index({ metric_name: 1, timestamp: -1 });
SystemMetricsSchema.index({ timestamp: -1 }); // For time-based queries
