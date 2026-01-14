import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LocalizedContentDocument = LocalizedContent & Document;

@Schema({ timestamps: true })
export class LocalizedContent {
  @Prop({ required: true })
  content_key: string;

  @Prop({ required: true })
  language: string;

  @Prop({ required: true })
  region: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, default: 'text' })
  content_type: string; // 'text', 'html', 'json'

  @Prop({ required: true, default: 'general' })
  category: string; // 'general', 'notification', 'error', 'emergency'

  @Prop({ type: Object, default: {} })
  metadata: {
    version?: string;
    author?: string;
    description?: string;
    variables?: string[];
  };

  @Prop({ required: true, default: true })
  is_active: boolean;

  @Prop({ default: Date.now })
  created_at: Date;

  @Prop({ default: Date.now })
  updated_at: Date;
}

export const LocalizedContentSchema =
  SchemaFactory.createForClass(LocalizedContent);

// Create compound indexes
LocalizedContentSchema.index(
  { content_key: 1, language: 1, region: 1 },
  { unique: true },
);
LocalizedContentSchema.index({ language: 1, region: 1, category: 1 });
LocalizedContentSchema.index({ is_active: 1 });
