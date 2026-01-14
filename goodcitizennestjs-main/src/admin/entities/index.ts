import { ModelDefinition } from '@nestjs/mongoose';
import { Content, ContentSchema } from './content.entity';
import { ContentVersion, ContentVersionSchema } from './content-version.entity';
import {
  MultiLanguageContent,
  MultiLanguageContentSchema,
} from './multi-language-content.entity';
import { SystemMetrics, SystemMetricsSchema } from './system-metrics.entity';
import {
  EmergencyBroadcast,
  EmergencyBroadcastSchema,
} from './emergency-broadcast.entity';

export const AdminModelDefinitions: ModelDefinition[] = [
  {
    name: Content.name,
    schema: ContentSchema,
  },
  {
    name: ContentVersion.name,
    schema: ContentVersionSchema,
  },
  {
    name: MultiLanguageContent.name,
    schema: MultiLanguageContentSchema,
  },
  {
    name: SystemMetrics.name,
    schema: SystemMetricsSchema,
  },
  {
    name: EmergencyBroadcast.name,
    schema: EmergencyBroadcastSchema,
  },
];
