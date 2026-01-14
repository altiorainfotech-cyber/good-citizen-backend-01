import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.entity';
import { NotificationType } from '../../entities/notification.entity';

@Schema()
export class NotificationPreference {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id!: Types.ObjectId;

  // Global notification settings
  @Prop({ default: true })
  push_notifications_enabled!: boolean;

  @Prop({ default: true })
  email_notifications_enabled!: boolean;

  @Prop({ default: false })
  sms_notifications_enabled!: boolean;

  // Type-specific preferences
  @Prop({
    type: Map,
    of: Boolean,
    default: () =>
      new Map([
        [NotificationType.RIDE_UPDATE, true],
        [NotificationType.EMERGENCY_ALERT, true],
        [NotificationType.DRIVER_ASSIGNED, true],
        [NotificationType.RIDE_COMPLETED, true],
        [NotificationType.SYSTEM_ANNOUNCEMENT, false],
      ]),
  })
  notification_types!: Map<NotificationType, boolean>;

  // Quiet hours
  @Prop({ default: null })
  quiet_hours_start?: string; // Format: "22:00"

  @Prop({ default: null })
  quiet_hours_end?: string; // Format: "08:00"

  @Prop({ default: true })
  emergency_override_quiet_hours!: boolean;

  // Language preference for notifications
  @Prop({ default: 'en' })
  language!: string;

  @Prop({ default: Date.now() })
  created_at!: Date;

  @Prop({ default: Date.now() })
  updated_at!: Date;
}

export type NotificationPreferenceDocument =
  HydratedDocument<NotificationPreference>;
export const NotificationPreferenceSchema = SchemaFactory.createForClass(
  NotificationPreference,
);

// Create indexes
NotificationPreferenceSchema.index({ user_id: 1 }, { unique: true });
