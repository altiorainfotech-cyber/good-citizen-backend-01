import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContentType } from '../../common/utils';

@Schema({ versionKey: false })
export class ContentVersion {
  @Prop({ type: Types.ObjectId, ref: 'Content', required: true })
  content_id: Types.ObjectId;

  @Prop({ required: true })
  version: string;

  @Prop({ enum: ContentType, required: true })
  type: string;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  content: string;

  @Prop()
  page_url: string;

  @Prop()
  image: string;

  @Prop({ required: true })
  created_by: string; // Admin user ID

  @Prop({ default: false })
  is_active: boolean;

  @Prop()
  change_notes: string;

  @Prop({ default: Date.now })
  created_at: Date;
}

export type ContentVersionDocument = HydratedDocument<ContentVersion>;
export const ContentVersionSchema =
  SchemaFactory.createForClass(ContentVersion);

// Indexes
ContentVersionSchema.index({ content_id: 1, version: -1 });
ContentVersionSchema.index({ type: 1, is_active: 1 });
