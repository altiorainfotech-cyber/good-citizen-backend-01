/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  Get,
  Param,
  UseGuards,
  Request,
  Put,
  Delete,
} from '@nestjs/common';
import { S3ManagerService } from './s3-manager.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  Upload,
  FileUploadResponse,
  PresignedUrlResponse,
} from './dto/upload.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

@Controller({ path: 's3-manager', version: '1' })
@ApiBearerAuth()
export class S3ManagerController {
  constructor(private readonly s3ManagerService: S3ManagerService) {}

  @Post('/upload')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upload file with security validation and optimization',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: Upload })
  @ApiQuery({
    name: 'documentType',
    required: false,
    description: 'Type of document (license, insurance, profile_picture, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    type: FileUploadResponse,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('documentType') documentType?: string,
    @Request() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.s3ManagerService.uploadFile(file, userId, documentType);
  }

  @Get('/presigned-url/:fileKey')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate secure time-limited URL for file access' })
  @ApiParam({ name: 'fileKey', description: 'S3 file key' })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    description: 'URL expiration time in seconds (default: 3600)',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated',
    type: PresignedUrlResponse,
  })
  async getPresignedUrl(
    @Param('fileKey') fileKey: string,
    @Query('expiresIn') expiresIn?: number,
  ) {
    const expiration = expiresIn ? parseInt(expiresIn.toString()) : 3600;
    const url = await this.s3ManagerService.generatePresignedUrl(
      fileKey,
      expiration,
    );
    return { url, expiresIn: expiration };
  }

  @Put('/associate-driver/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Associate uploaded document with driver profile' })
  @ApiParam({ name: 'fileId', description: 'File document ID' })
  @ApiQuery({ name: 'driverId', required: true, description: 'Driver ID' })
  @ApiQuery({
    name: 'documentType',
    required: true,
    description: 'Document type (license, insurance, etc.)',
  })
  async associateWithDriver(
    @Param('fileId') fileId: string,
    @Query('driverId') driverId: string,
    @Query('documentType') documentType: string,
  ) {
    return this.s3ManagerService.associateDocumentWithDriver(
      fileId,
      driverId,
      documentType,
    );
  }

  @Get('/driver-documents/:driverId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get driver documents by type' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  @ApiQuery({
    name: 'documentType',
    required: false,
    description: 'Filter by document type',
  })
  async getDriverDocuments(
    @Param('driverId') driverId: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.s3ManagerService.getDriverDocuments(driverId, documentType);
  }

  @Get('/driver-validation/:driverId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Validate driver document requirements' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  async validateDriverDocuments(@Param('driverId') driverId: string) {
    return this.s3ManagerService.validateDriverDocuments(driverId);
  }

  @Delete('/mark-deletion/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark file for deletion (soft delete)' })
  @ApiParam({ name: 'fileId', description: 'File document ID' })
  async markForDeletion(@Param('fileId') fileId: string, @Request() req: any) {
    const userId = req?.user?.sub || req?.user?.id;
    await this.s3ManagerService.markFileForDeletion(fileId, userId);
    return { message: 'File marked for deletion' };
  }

  @Get('/user-files')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user files' })
  @ApiQuery({
    name: 'documentType',
    required: false,
    description: 'Filter by document type',
  })
  async getUserFiles(
    @Query('documentType') documentType?: string,
    @Request() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.s3ManagerService.getUserFiles(userId, documentType);
  }

  @Get('/stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get file usage statistics' })
  async getFileStats() {
    return this.s3ManagerService.getFileUsageStats();
  }
}
