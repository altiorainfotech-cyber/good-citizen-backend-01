/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable no-useless-catch */

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';
import { SharpService } from 'nestjs-sharp';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fileType from 'file-type';
import { FileValidationService } from '../common/validation/file-validation.service';
import { FileDocument, FileDocumentType } from './entities/s3-manager.entity';

@Injectable()
export class S3ManagerService {
  private readonly S3Client: S3Client;
  private readonly AWS_BUCKET_URL: string;
  private readonly AWS_BUCKET_NAME: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly sharpService: SharpService,
    private readonly fileValidationService: FileValidationService,
    @InjectModel(FileDocument.name)
    private fileDocumentModel: Model<FileDocumentType>,
  ) {
    this.AWS_BUCKET_URL = this.configService.get('AWS_BUCKET_URL')!;
    this.AWS_BUCKET_NAME = this.configService.get('AWS_BUCKET_NAME')!;

    // AWS SDK v3
    this.S3Client = new S3Client({
      region: this.configService.get('AWS_REGION')!,
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  // Enhanced file upload with comprehensive security validation
  async uploadFile(
    file: Express.Multer.File,
    userId?: string,
    documentType?: string,
  ) {
    try {
      // Use the new file validation service
      const validationResult = await this.fileValidationService.validateFile(
        file,
        documentType,
      );

      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'File validation failed',
          errors: validationResult.errors,
          fileInfo: validationResult.fileInfo,
        });
      }

      if (!userId) {
        throw new BadRequestException('User ID is required for file upload');
      }

      const { originalname, buffer, mimetype, size } = file;
      const file_name = await this.generate_file_name(originalname);
      const mime_type = mimetype.split('/');

      // Add user context to file path for access control
      const userPrefix = `users/${userId}/`;
      let uploadResult;

      if (mime_type[0] === 'image') {
        uploadResult = await this.modify_images(
          file_name,
          buffer,
          mime_type[0],
          userPrefix,
        );
        // Save metadata for original image
        await this.saveFileMetadata(
          file_name,
          originalname,
          'IMAGE',
          mimetype,
          size,
          uploadResult.secure_urls.original,
          userId,
          documentType,
        );
      } else if (mime_type[0] === 'audio') {
        uploadResult = await this.upload_audio(
          file_name,
          buffer,
          mime_type[0],
          userPrefix,
        );
        await this.saveFileMetadata(
          file_name,
          originalname,
          'AUDIO',
          mimetype,
          size,
          uploadResult.secure_url,
          userId,
          documentType,
        );
      } else if (mime_type[0] === 'video') {
        uploadResult = await this.upload_video(
          file_name,
          buffer,
          mime_type[0],
          userPrefix,
        );
        await this.saveFileMetadata(
          file_name,
          originalname,
          'VIDEO',
          mimetype,
          size,
          uploadResult.secure_url,
          userId,
          documentType,
        );
      } else if (mime_type[0] === 'application' && mime_type[1] === 'pdf') {
        uploadResult = await this.upload_doc(
          file_name,
          buffer,
          mime_type[0],
          userPrefix,
          documentType,
        );
        await this.saveFileMetadata(
          file_name,
          originalname,
          'DOCUMENT',
          mimetype,
          size,
          uploadResult.secure_url,
          userId,
          documentType,
        );
      } else {
        throw new BadRequestException('Unsupported file type');
      }

      return uploadResult;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('File upload failed');
    }
  }

  // Generate secure, time-limited URLs for file access
  async generatePresignedUrl(
    fileKey: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.AWS_BUCKET_NAME,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.S3Client, command, {
        expiresIn,
      });
      return signedUrl;
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate secure URL');
    }
  }

  // Delete file from S3 (for cleanup policies)
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.AWS_BUCKET_NAME,
        Key: fileKey,
      });

      await this.S3Client.send(command);

      // Also mark as inactive in database
      await this.fileDocumentModel.updateOne(
        { s3_key: fileKey },
        { is_active: false },
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  // Save file metadata to database
  private async saveFileMetadata(
    fileName: string,
    originalName: string,
    fileType: string,
    mimeType: string,
    fileSize: number,
    s3Key: string,
    uploadedBy: string,
    documentType?: string,
    associatedEntityType?: string,
    associatedEntityId?: string,
  ): Promise<FileDocumentType> {
    try {
      const fileDocument = new this.fileDocumentModel({
        file_name: fileName,
        original_name: originalName,
        file_type: fileType,
        mime_type: mimeType,
        file_size: fileSize,
        s3_key: s3Key,
        s3_bucket: this.AWS_BUCKET_NAME,
        uploaded_by: new Types.ObjectId(uploadedBy),
        document_type: documentType,
        associated_entity_type: associatedEntityType,
        associated_entity_id: associatedEntityId
          ? new Types.ObjectId(associatedEntityId)
          : undefined,
        is_active: true,
      });

      return await fileDocument.save();
    } catch (error) {
      throw new InternalServerErrorException('Failed to save file metadata');
    }
  }

  // Get file metadata by S3 key
  async getFileMetadata(s3Key: string): Promise<FileDocumentType | null> {
    return await this.fileDocumentModel.findOne({
      s3_key: s3Key,
      is_active: true,
    });
  }

  // Get user files
  async getUserFiles(
    userId: string,
    documentType?: string,
  ): Promise<FileDocumentType[]> {
    const query: any = {
      uploaded_by: new Types.ObjectId(userId),
      is_active: true,
    };

    if (documentType) {
      query.document_type = documentType;
    }

    return await this.fileDocumentModel.find(query).sort({ createdAt: -1 });
  }

  // Associate uploaded document with driver profile
  async associateDocumentWithDriver(
    fileId: string,
    driverId: string,
    documentType: string,
  ): Promise<FileDocumentType | null> {
    try {
      return await this.fileDocumentModel.findByIdAndUpdate(
        fileId,
        {
          associated_entity_type: 'driver_profile',
          associated_entity_id: new Types.ObjectId(driverId),
          document_type: documentType,
        },
        { new: true },
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to associate document with driver',
      );
    }
  }

  // Get driver documents by type
  async getDriverDocuments(
    driverId: string,
    documentType?: string,
  ): Promise<FileDocumentType[]> {
    const query: any = {
      associated_entity_type: 'driver_profile',
      associated_entity_id: new Types.ObjectId(driverId),
      is_active: true,
    };

    if (documentType) {
      query.document_type = documentType;
    }

    return await this.fileDocumentModel.find(query).sort({ createdAt: -1 });
  }

  // Validate driver document requirements
  async validateDriverDocuments(driverId: string): Promise<{
    isComplete: boolean;
    missingDocuments: string[];
    documents: Record<string, FileDocumentType[]>;
  }> {
    const requiredDocuments = ['license', 'insurance', 'vehicle_registration'];
    const documents: Record<string, FileDocumentType[]> = {};
    const missingDocuments: string[] = [];

    for (const docType of requiredDocuments) {
      const docs = await this.getDriverDocuments(driverId, docType);
      documents[docType] = docs;

      if (docs.length === 0) {
        missingDocuments.push(docType);
      }
    }

    return {
      isComplete: missingDocuments.length === 0,
      missingDocuments,
      documents,
    };
  }

  // Cleanup old files based on policies
  async cleanupOldFiles(): Promise<{
    deletedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedCount = 0;

    try {
      // Policy 1: Delete files older than 1 year that are not associated with active entities
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const oldFiles = await this.fileDocumentModel.find({
        createdAt: { $lt: oneYearAgo },
        associated_entity_type: { $exists: false },
        is_active: true,
      });

      for (const file of oldFiles) {
        try {
          await this.deleteFile(file.s3_key);
          deletedCount++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(
            `Failed to delete old file ${file.s3_key}: ${errorMessage}`,
          );
        }
      }

      // Policy 2: Delete temporary files older than 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const tempFiles = await this.fileDocumentModel.find({
        createdAt: { $lt: oneDayAgo },
        document_type: 'temporary',
        is_active: true,
      });

      for (const file of tempFiles) {
        try {
          await this.deleteFile(file.s3_key);
          deletedCount++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(
            `Failed to delete temp file ${file.s3_key}: ${errorMessage}`,
          );
        }
      }

      // Policy 3: Delete files marked for deletion
      const filesToDelete = await this.fileDocumentModel.find({
        is_active: false,
        updatedAt: { $lt: oneDayAgo }, // Give 24 hours grace period
      });

      for (const file of filesToDelete) {
        try {
          await this.deleteFile(file.s3_key);
          await this.fileDocumentModel.deleteOne({ _id: file._id });
          deletedCount++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(
            `Failed to delete marked file ${file.s3_key}: ${errorMessage}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Cleanup process error: ${errorMessage}`);
    }

    return { deletedCount, errors };
  }

  // Mark file for deletion (soft delete)
  async markFileForDeletion(fileId: string, userId: string): Promise<void> {
    try {
      const file = await this.fileDocumentModel.findOne({
        _id: new Types.ObjectId(fileId),
        uploaded_by: new Types.ObjectId(userId),
      });

      if (!file) {
        throw new BadRequestException('File not found or access denied');
      }

      await this.fileDocumentModel.updateOne(
        { _id: new Types.ObjectId(fileId) },
        { is_active: false },
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to mark file for deletion',
      );
    }
  }

  // Get file usage statistics
  async getFileUsageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    sizeByType: Record<string, number>;
  }> {
    const stats = await this.fileDocumentModel.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: '$file_type',
          count: { $sum: 1 },
          totalSize: { $sum: '$file_size' },
        },
      },
    ]);

    const filesByType: Record<string, number> = {};
    const sizeByType: Record<string, number> = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const stat of stats) {
      filesByType[stat._id] = stat.count;
      sizeByType[stat._id] = stat.totalSize;
      totalFiles += stat.count;
      totalSize += stat.totalSize;
    }

    return {
      totalFiles,
      totalSize,
      filesByType,
      sizeByType,
    };
  }

  // Generate file name with timestamp
  generate_file_name = async (file_name: string) => {
    try {
      const current_millis = moment().format('x');
      const raw_file_name = file_name.split(/\s/).join('');
      const split_file = raw_file_name.split('.');
      // spiting by all special charcters
      const split_all =
        split_file[0]?.split(/[^a-zA-Z0-9]/g).join('_') || 'file';
      const name = split_all.toLowerCase();
      const ext = file_name.split('.').pop();
      const gen_file_name = `${name}_${current_millis}.${ext}`;
      return gen_file_name.toLowerCase();
    } catch (err) {
      throw err;
    }
  };

  // Enhanced image processing with optimization
  modify_images = async (
    file_name: string,
    buffer: any,
    mime_type: string,
    userPrefix: string = '',
  ) => {
    try {
      // Create optimized versions for different use cases
      const originalBuffer = await this.create_sharp_file(
        buffer,
        null,
        'original',
      );
      await this.upload_file_to_aws(
        file_name,
        `${userPrefix}images/original`,
        mime_type,
        originalBuffer,
      );

      // Medium size for general display (500px max width/height)
      const mediumBuffer = await this.create_sharp_file(buffer, 500, 'medium');
      await this.upload_file_to_aws(
        file_name,
        `${userPrefix}images/medium`,
        mime_type,
        mediumBuffer,
      );

      // Small size for thumbnails (100px max width/height)
      const smallBuffer = await this.create_sharp_file(buffer, 100, 'small');
      await this.upload_file_to_aws(
        file_name,
        `${userPrefix}images/small`,
        mime_type,
        smallBuffer,
      );

      // Profile picture specific size (150px square for avatars)
      const profileBuffer = await this.create_sharp_file(
        buffer,
        150,
        'profile',
        true,
      );
      await this.upload_file_to_aws(
        file_name,
        `${userPrefix}images/profile`,
        mime_type,
        profileBuffer,
      );

      const response = {
        base_url: this.AWS_BUCKET_URL,
        type: 'IMAGE',
        folders: ['original', 'medium', 'small', 'profile'],
        file_name: file_name,
        user_prefix: userPrefix,
        secure_urls: {
          original: `${userPrefix}images/original/${file_name}`,
          medium: `${userPrefix}images/medium/${file_name}`,
          small: `${userPrefix}images/small/${file_name}`,
          profile: `${userPrefix}images/profile/${file_name}`,
        },
        optimization_info: {
          original_size: buffer.length,
          optimized_sizes: {
            medium: mediumBuffer.length,
            small: smallBuffer.length,
            profile: profileBuffer.length,
          },
        },
      };
      return response;
    } catch (err) {
      throw err;
    }
  };

  // Enhanced image processing with optimization options
  create_sharp_file = async (
    buffer: any,
    pixels: any,
    usage: string = 'general',
    square: boolean = false,
  ) => {
    try {
      let sharpInstance = this.sharpService.edit(buffer);

      if (pixels) {
        if (square) {
          // Create square crop for profile pictures
          sharpInstance = sharpInstance.resize(pixels, pixels, {
            fit: 'cover',
            position: 'center',
          });
        } else {
          // Maintain aspect ratio
          sharpInstance = sharpInstance.resize(pixels, pixels, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
      }

      // Apply optimization based on usage
      switch (usage) {
        case 'profile':
          // High quality for profile pictures
          sharpInstance = sharpInstance
            .jpeg({ quality: 90, progressive: true })
            .png({ quality: 90, compressionLevel: 6 });
          break;
        case 'medium':
          // Balanced quality for general display
          sharpInstance = sharpInstance
            .jpeg({ quality: 80, progressive: true })
            .png({ quality: 80, compressionLevel: 7 });
          break;
        case 'small':
          // Lower quality for thumbnails
          sharpInstance = sharpInstance
            .jpeg({ quality: 70, progressive: true })
            .png({ quality: 70, compressionLevel: 8 });
          break;
        default:
          // Original quality
          sharpInstance = sharpInstance
            .jpeg({ quality: 95, progressive: true })
            .png({ quality: 95, compressionLevel: 5 });
      }

      return await sharpInstance.rotate().toBuffer();
    } catch (err) {
      throw err;
    }
  };

  // Upload files to AWS S3 with secure access controls
  upload_file_to_aws = async (
    file_name: string,
    folder: string,
    mime_type: string,
    buffer: any,
  ) => {
    try {
      const params: PutObjectCommandInput = {
        Bucket: this.AWS_BUCKET_NAME,
        Key: `${folder}/${file_name}`,
        Body: buffer,
        ContentType: mime_type,
        // Remove public-read ACL for security - use presigned URLs instead
        ServerSideEncryption: 'AES256', // Enable server-side encryption
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'content-type': mime_type,
        },
      };
      const command = new PutObjectCommand(params);
      return await this.S3Client.send(command);
    } catch (err) {
      throw err;
    }
  };

  // Upload audio with user context
  upload_audio = async (
    file_name: string,
    buffer: any,
    mime_type: string,
    userPrefix: string = '',
  ) => {
    try {
      await this.upload_file_to_aws(
        file_name,
        `${userPrefix}audios`,
        mime_type,
        buffer,
      );
      const response = {
        base_url: this.AWS_BUCKET_URL,
        type: 'AUDIO',
        folders: ['audios'],
        file_name: file_name,
        user_prefix: userPrefix,
        secure_url: `${userPrefix}audios/${file_name}`,
      };
      return response;
    } catch (err) {
      throw err;
    }
  };

  // Upload video with user context
  upload_video = async (
    file_name: string,
    buffer: any,
    mime_type: string,
    userPrefix: string = '',
  ) => {
    try {
      await this.upload_file_to_aws(
        file_name,
        `${userPrefix}videos`,
        mime_type,
        buffer,
      );
      const response = {
        base_url: this.AWS_BUCKET_URL,
        type: 'VIDEO',
        folders: ['videos'],
        file_name: file_name,
        user_prefix: userPrefix,
        secure_url: `${userPrefix}videos/${file_name}`,
      };
      return response;
    } catch (err) {
      throw err;
    }
  };

  // Upload document with user context and document type
  upload_doc = async (
    file_name: string,
    buffer: any,
    mime_type: string,
    userPrefix: string = '',
    documentType?: string,
  ) => {
    try {
      const folder = documentType
        ? `${userPrefix}documents/${documentType}`
        : `${userPrefix}documents`;
      await this.upload_file_to_aws(file_name, folder, mime_type, buffer);
      const response = {
        base_url: this.AWS_BUCKET_URL,
        type: 'DOCUMENT',
        folders: ['documents'],
        file_name: file_name,
        user_prefix: userPrefix,
        document_type: documentType,
        secure_url: `${folder}/${file_name}`,
      };
      return response;
    } catch (err) {
      throw err;
    }
  };
}
