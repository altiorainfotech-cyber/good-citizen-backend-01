import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContentType } from '../../common/utils';

@Schema({ versionKey: false })
export class MultiLanguageContent {
  @Prop({ type: Types.ObjectId, ref: 'Content', required: true })
  content_id: Types.ObjectId;

  @Prop({ enum: ContentType, required: true })
  type: string;

  @Prop({ required: true })
  language_code: string; // ISO 639-1 language codes (en, hi, es, etc.)

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  content: string;

  @Prop({ default: false })
  is_default: boolean; // Mark default language

  @Prop({ default: true })
  is_active: boolean;

  @Prop()
  translated_by: string; // Admin user ID or translation service

  @Prop({ default: Date.now })
  created_at: Date;

  @Prop({ default: Date.now })
  updated_at: Date;
}

export type MultiLanguageContentDocument =
  HydratedDocument<MultiLanguageContent>;
export const MultiLanguageContentSchema =
  SchemaFactory.createForClass(MultiLanguageContent);

// Indexes
MultiLanguageContentSchema.index(
  { content_id: 1, language_code: 1 },
  { unique: true },
);
MultiLanguageContentSchema.index({ type: 1, language_code: 1, is_active: 1 });
