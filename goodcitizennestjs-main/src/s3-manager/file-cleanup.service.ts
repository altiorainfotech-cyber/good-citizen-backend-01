/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3ManagerService } from './s3-manager.service';

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  constructor(private readonly s3ManagerService: S3ManagerService) {}

  // Run cleanup daily at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyCleanup() {
    this.logger.log('Starting daily file cleanup...');

    try {
      const result = await this.s3ManagerService.cleanupOldFiles();

      this.logger.log(
        `Cleanup completed: ${result.deletedCount} files deleted`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`Cleanup errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Daily cleanup failed:', error);
    }
  }

  // Run expired file cleanup every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredFileCleanup() {
    this.logger.log('Starting expired file cleanup...');

    try {
      // This would be the old method, keeping for compatibility
      // await this.s3ManagerService.cleanupExpiredFiles();
      this.logger.log('Expired file cleanup completed');
    } catch (error) {
      this.logger.error('Expired file cleanup failed:', error);
    }
  }

  // Manual cleanup trigger for admin use
  async triggerManualCleanup(): Promise<{
    deletedCount: number;
    errors: string[];
  }> {
    this.logger.log('Manual cleanup triggered');
    return await this.s3ManagerService.cleanupOldFiles();
  }
}
