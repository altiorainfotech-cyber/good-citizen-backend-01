import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { S3ManagerService } from './s3-manager.service';
import { S3ManagerController } from './s3-manager.controller';
import { FileCleanupService } from './file-cleanup.service';
import { SharpService } from 'nestjs-sharp';
import { ValidationModule } from '../common/validation/validation.module';
import { FileDocument, FileDocumentSchema } from './entities/s3-manager.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileDocument.name, schema: FileDocumentSchema },
    ]),
    ScheduleModule.forRoot(),
    ValidationModule,
  ],
  controllers: [S3ManagerController],
  providers: [S3ManagerService, FileCleanupService, SharpService],
  exports: [S3ManagerService],
})
export class S3ManagerModule {}
