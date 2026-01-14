import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../user/entities/user.entity';

export enum NotificationType {
  RIDE_UPDATE = 'RIDE_UPDATE',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  RIDE_COMPLETED = 'RIDE_COMPLETED',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

@Schema()
export class Notification {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  driver_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Ride' })
  ride_id?: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({
    type: String,
    enum: NotificationType,
    default: NotificationType.RIDE_UPDATE,
  })
  type!: NotificationType;

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status!: NotificationStatus;

  @Prop({
    type: String,
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority!: NotificationPriority;

  // Additional payload data
  @Prop({ type: Object, default: {} })
  data?: any;

  // Delivery tracking
  @Prop({ default: null })
  delivered_at?: Date;

  @Prop({ default: null })
  read_at?: Date;

  @Prop({ default: null })
  failed_reason?: string;

  // User preferences
  @Prop({ default: true })
  push_enabled?: boolean;

  @Prop({ default: true })
  email_enabled?: boolean;

  @Prop({ default: true })
  sms_enabled?: boolean;

  // Legacy fields for backward compatibility
  @Prop({ default: 'CH 01 9093' })
  ambulance_num?: string;

  @Prop({ default: '3.2 Km' })
  distance?: string;

  @Prop({ default: Date.now() })
  created_at!: Date;

  @Prop({ default: Date.now() })
  updated_at!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
