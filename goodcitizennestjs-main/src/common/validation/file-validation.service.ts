/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fileType from 'file-type';

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileInfo?: {
    originalName: string;
    mimeType: string;
    size: number;
    extension?: string;
  };
}

@Injectable()
export class FileValidationService {
  private readonly maxFileSizes = {
    image: 5 * 1024 * 1024, // 5MB for images
    document: 10 * 1024 * 1024, // 10MB for documents
    default: 2 * 1024 * 1024, // 2MB default
  };

  private readonly allowedMimeTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    profile_picture: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    license: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    insurance: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  };

  constructor(private configService: ConfigService) {}

  /**
   * Comprehensive file validation
   */
  async validateFile(
    file: any,
    documentType?: string,
  ): Promise<FileValidationResult> {
    const errors: string[] = [];

    if (!file) {
      return {
        isValid: false,
        errors: ['No file provided'],
      };
    }

    // Basic file properties validation
    if (!file.originalname || file.originalname.trim() === '') {
      errors.push('File must have a valid name');
    }

    if (!file.buffer || file.buffer.length === 0) {
      errors.push('File is empty');
    }

    // File size validation
    const maxSize = this.getMaxFileSize(documentType);
    if (file.size > maxSize) {
      errors.push(
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSize)})`,
      );
    }

    // MIME type validation
    const allowedTypes = this.getAllowedMimeTypes(documentType);
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(
        `File type '${file.mimetype}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // File extension validation
    const fileExtension = this.getFileExtension(file.originalname);
    if (!this.isValidExtension(fileExtension, documentType)) {
      errors.push(
        `File extension '${fileExtension}' is not allowed for document type '${documentType}'`,
      );
    }

    // Magic number validation (file signature)
    try {
      const detectedType = await fileType.fromBuffer(file.buffer);
      if (detectedType && !allowedTypes.includes(detectedType.mime)) {
        errors.push(
          `File content type '${detectedType.mime}' does not match allowed types. File may be corrupted or have incorrect extension.`,
        );
      }
    } catch (error) {
      errors.push('Unable to detect file type. File may be corrupted.');
    }

    // Malicious file detection
    if (this.containsSuspiciousContent(file)) {
      errors.push('File contains suspicious content and cannot be uploaded');
    }

    return {
      isValid: errors.length === 0,
      errors,
      fileInfo: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        extension: fileExtension,
      },
    };
  }

  /**
   * Validate multiple files
   */
  async validateFiles(
    files: any[],
    documentType?: string,
  ): Promise<FileValidationResult[]> {
    if (!files || files.length === 0) {
      return [
        {
          isValid: false,
          errors: ['No files provided'],
        },
      ];
    }

    const maxFiles = this.configService.get<number>('MAX_FILES_PER_UPLOAD', 5);
    if (files.length > maxFiles) {
      return [
        {
          isValid: false,
          errors: [`Too many files. Maximum allowed: ${maxFiles}`],
        },
      ];
    }

    return Promise.all(
      files.map((file) => this.validateFile(file, documentType)),
    );
  }

  private getMaxFileSize(documentType?: string): number {
    if (!documentType) return this.maxFileSizes.default;

    if (documentType.includes('image') || documentType === 'profile_picture') {
      return this.maxFileSizes.image;
    }

    if (['license', 'insurance', 'document'].includes(documentType)) {
      return this.maxFileSizes.document;
    }

    return this.maxFileSizes.default;
  }

  private getAllowedMimeTypes(documentType?: string): string[] {
    if (!documentType) {
      return [
        ...this.allowedMimeTypes.image,
        ...this.allowedMimeTypes.document,
      ];
    }

    if (this.allowedMimeTypes[documentType]) {
      return this.allowedMimeTypes[documentType];
    }

    if (documentType.includes('image')) {
      return this.allowedMimeTypes.image;
    }

    return this.allowedMimeTypes.document;
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private isValidExtension(extension: string, documentType?: string): boolean {
    const validExtensions = {
      image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      document: ['pdf', 'doc', 'docx', 'txt'],
      profile_picture: ['jpg', 'jpeg', 'png', 'webp'],
      license: ['jpg', 'jpeg', 'png', 'pdf'],
      insurance: ['jpg', 'jpeg', 'png', 'pdf'],
    };

    if (!documentType) {
      return [...validExtensions.image, ...validExtensions.document].includes(
        extension,
      );
    }

    if (validExtensions[documentType]) {
      return validExtensions[documentType].includes(extension);
    }

    return validExtensions.document.includes(extension);
  }

  private containsSuspiciousContent(file: any): boolean {
    // Check for suspicious file signatures or patterns
    const suspiciousPatterns = [
      // Executable signatures
      Buffer.from([0x4d, 0x5a]), // MZ (Windows executable)
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF (Linux executable)
      Buffer.from([0xca, 0xfe, 0xba, 0xbe]), // Mach-O (macOS executable)
      // Script patterns
      Buffer.from('<?php', 'utf8'),
      Buffer.from('<script', 'utf8'),
      Buffer.from('javascript:', 'utf8'),
    ];

    const fileBuffer = file.buffer;

    return suspiciousPatterns.some((pattern) => {
      for (let i = 0; i <= fileBuffer.length - pattern.length; i++) {
        if (fileBuffer.subarray(i, i + pattern.length).equals(pattern)) {
          return true;
        }
      }
      return false;
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
