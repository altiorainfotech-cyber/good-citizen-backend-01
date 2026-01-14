/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { PrivacyService, DataDeletionRequest } from './privacy.service';

export class DataExportDto {
  format?: 'json' | 'csv' = 'json';
}

export class DataDeletionDto {
  dataTypes: string[];
  keepAnonymized: boolean = true;
  confirmationText: string;
}

export class DataAccessRequestDto {
  targetUserId: string;
  dataType: 'profile' | 'rides' | 'location' | 'notifications';
  purpose: string;
}

@ApiTags('Privacy & Data Protection')
@Controller('privacy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('export')
  @ApiOperation({ summary: 'Export user data (GDPR data portability)' })
  @ApiResponse({ status: 200, description: 'User data exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async exportUserData(@Request() req: any, @Body() dto: DataExportDto) {
    const userId = req.user._id;
    const userData = await this.privacyService.exportUserData(userId);

    return {
      message: 'Data exported successfully',
      data: userData,
      format: dto.format || 'json',
      exportedAt: new Date().toISOString(),
    };
  }

  @Delete('delete-data')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user data (GDPR right to be forgotten)' })
  @ApiResponse({ status: 204, description: 'Data deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteUserData(@Request() req: any, @Body() dto: DataDeletionDto) {
    const userId = req.user._id;

    // Validate confirmation text
    if (dto.confirmationText !== 'DELETE MY DATA') {
      throw new Error(
        'Invalid confirmation text. Please type "DELETE MY DATA" to confirm.',
      );
    }

    const deletionRequest: DataDeletionRequest = {
      userId: userId,
      dataTypes: dto.dataTypes,
      keepAnonymized: dto.keepAnonymized,
    };

    await this.privacyService.deleteUserData(deletionRequest);

    return {
      message: 'Data deletion completed',
      deletedAt: new Date().toISOString(),
    };
  }

  @Post('anonymize')
  @ApiOperation({ summary: 'Anonymize user data while preserving analytics' })
  @ApiResponse({ status: 200, description: 'Data anonymized successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async anonymizeUserData(@Request() req: any) {
    const userId = req.user._id;
    await this.privacyService.anonymizeUserData(userId);

    return {
      message: 'Data anonymized successfully',
      anonymizedAt: new Date().toISOString(),
    };
  }

  @Post('validate-access')
  @ApiOperation({ summary: 'Validate data access permissions' })
  @ApiResponse({ status: 200, description: 'Access validation result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validateDataAccess(
    @Request() req: any,
    @Body() dto: DataAccessRequestDto,
  ) {
    const userId = req.user._id;

    const hasAccess = await this.privacyService.validateDataAccess({
      userId: userId,
      requestedUserId: dto.targetUserId,
      dataType: dto.dataType,
      purpose: dto.purpose,
    });

    // Audit the access request
    await this.privacyService.auditDataAccess(
      {
        userId: userId,
        requestedUserId: dto.targetUserId,
        dataType: dto.dataType,
        purpose: dto.purpose,
      },
      hasAccess,
    );

    return {
      hasAccess: hasAccess,
      requestedAt: new Date().toISOString(),
    };
  }

  @Post('encrypt-sensitive-data')
  @ApiOperation({ summary: 'Encrypt user sensitive data in database' })
  @ApiResponse({
    status: 200,
    description: 'Sensitive data encrypted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async encryptSensitiveData(@Request() req: any) {
    const userId = req.user._id;
    await this.privacyService.encryptUserSensitiveFields(userId);

    return {
      message: 'Sensitive data encrypted successfully',
      encryptedAt: new Date().toISOString(),
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get filtered user data based on permissions' })
  @ApiResponse({
    status: 200,
    description: 'User data retrieved with privacy filters',
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getFilteredUserData(
    @Request() req: any,
    @Param('userId') targetUserId: string,
  ) {
    const requestingUserId = req.user._id;

    // This would typically get user data from UserService
    // For now, we'll demonstrate the filtering concept
    const mockUserData = {
      _id: targetUserId,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone_number: '+1234567890',
      role: 'USER',
      created_at: new Date(),
    };

    const filteredData = await this.privacyService.filterUserDataByPermissions(
      mockUserData,
      requestingUserId,
      targetUserId,
    );

    return {
      data: filteredData,
      accessLevel: requestingUserId === targetUserId ? 'full' : 'limited',
      retrievedAt: new Date().toISOString(),
    };
  }
}
