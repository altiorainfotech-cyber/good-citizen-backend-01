import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseResilienceService } from './database-resilience.service';
import { ErrorMonitoringService } from '../monitoring/error-monitoring.service';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseResilienceService, ErrorMonitoringService],
  exports: [DatabaseResilienceService, ErrorMonitoringService],
})
export class ResilienceModule {}
