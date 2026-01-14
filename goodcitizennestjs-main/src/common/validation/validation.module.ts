import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GpsValidationService } from './gps-validation.service';
import { FileValidationService } from './file-validation.service';
import { ComprehensiveValidationService } from './comprehensive-validation.service';

@Module({
  imports: [ConfigModule],
  providers: [
    GpsValidationService,
    FileValidationService,
    ComprehensiveValidationService,
  ],
  exports: [
    GpsValidationService,
    FileValidationService,
    ComprehensiveValidationService,
  ],
})
export class ValidationModule {}
