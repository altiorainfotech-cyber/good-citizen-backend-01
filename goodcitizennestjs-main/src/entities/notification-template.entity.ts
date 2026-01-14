import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { NotificationType, NotificationPriority } from './notification.entity';

@Schema()
export class NotificationTemplate {
  @Prop({ required: true })
  template_key!: string; // e.g., 'ride_assigned', 'emergency_alert'

  @Prop({ type: String, enum: NotificationType, required: true })
  type!: NotificationType;

  @Prop({
    type: String,
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority!: NotificationPriority;

  // Localized content
  @Prop({
    type: Map,
    of: {
      title: String,
      message: String,
      push_title: String,
      push_message: String,
      email_subject: String,
      email_body: String,
      sms_message: String,
    },
    required: true,
  })
  localized_content!: Map<
    string,
    {
      title: string;
      message: string;
      push_title?: string;
      push_message?: string;
      email_subject?: string;
      email_body?: string;
      sms_message?: string;
    }
  >;

  // Template variables that can be replaced
  @Prop({ type: [String], default: [] })
  variables!: string[]; // e.g., ['driver_name', 'estimated_time', 'vehicle_plate']

  @Prop({ default: true })
  is_active!: boolean;

  @Prop({ default: Date.now() })
  created_at!: Date;

  @Prop({ default: Date.now() })
  updated_at!: Date;
}

export type NotificationTemplateDocument =
  HydratedDocument<NotificationTemplate>;
export const NotificationTemplateSchema =
  SchemaFactory.createForClass(NotificationTemplate);

// Create indexes
NotificationTemplateSchema.index({ template_key: 1 }, { unique: true });
NotificationTemplateSchema.index({ type: 1 });
NotificationTemplateSchema.index({ is_active: 1 });
