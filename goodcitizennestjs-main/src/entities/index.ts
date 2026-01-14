import { ModelDefinition } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './notification.entity';
import {
  NotificationTemplate,
  NotificationTemplateSchema,
} from './notification-template.entity';
import {
  EmergencyRequest,
  EmergencyRequestSchema,
} from './emergency-request.entity';
import {
  EmergencyContact,
  EmergencyContactSchema,
} from './emergency-contact.entity';

export const commonModelDefinitions: ModelDefinition[] = [
  {
    name: Notification.name,
    schema: NotificationSchema,
  },
  {
    name: NotificationTemplate.name,
    schema: NotificationTemplateSchema,
  },
  {
    name: EmergencyRequest.name,
    schema: EmergencyRequestSchema,
  },
  {
    name: EmergencyContact.name,
    schema: EmergencyContactSchema,
  },
];
