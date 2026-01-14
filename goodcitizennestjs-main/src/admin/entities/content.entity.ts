/* eslint-disable @typescript-eslint/no-unused-vars */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContentType } from '../../common/utils';

@Schema({ versionKey: false })
export class Content {
  @Prop({ default: null, enum: ContentType })
  type: string;

  @Prop()
  image: string;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  content: string;

  @Prop()
  page_url: string;

  @Prop({ default: Date.now() })
  created_at: Date;
}

export type ContentDocument = HydratedDocument<Content>;
export const ContentSchema = SchemaFactory.createForClass(Content);
