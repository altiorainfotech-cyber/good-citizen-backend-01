import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FileDocumentType = FileDocument & Document;

@Schema({ timestamps: true })
export class FileDocument {
  @Prop({ required: true })
  file_name!: string;

  @Prop({ required: true })
  original_name!: string;

  @Prop({ required: true })
  file_type!: string;

  @Prop({ required: true })
  mime_type!: string;

  @Prop({ required: true })
  file_size!: number;

  @Prop({ required: true })
  s3_key!: string;

  @Prop({ required: true })
  s3_bucket!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploaded_by!: Types.ObjectId;

  @Prop({ required: false })
  document_type?: string; // license, insurance, profile_picture, etc.

  @Prop({ required: false })
  associated_entity_type?: string; // driver_application, ride, etc.

  @Prop({ type: Types.ObjectId, required: false })
  associated_entity_id?: Types.ObjectId;

  @Prop({ default: true })
  is_active!: boolean;

  @Prop({ required: false })
  expires_at?: Date;

  @Prop({ type: Object, required: false })
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    [key: string]: any;
  };
}

export const FileDocumentSchema = SchemaFactory.createForClass(FileDocument);
