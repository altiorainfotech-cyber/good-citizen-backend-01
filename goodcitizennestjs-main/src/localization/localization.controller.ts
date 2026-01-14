/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from '../common/utils';
import { LocalizationService } from './localization.service';
import {
  UpdateUserPreferenceDto,
  UserPreferenceResponseDto,
} from './dto/user-preference.dto';
import {
  CreateLocalizedContentDto,
  UpdateLocalizedContentDto,
  GetLocalizedContentDto,
  LocalizedContentResponseDto,
} from './dto/localized-content.dto';
import {
  CreateRegionalConfigDto,
  UpdateRegionalConfigDto,
  RegionalConfigResponseDto,
} from './dto/regional-config.dto';

@Controller('localization')
export class LocalizationController {
  constructor(private readonly localizationService: LocalizationService) {}

  // User Preference Endpoints
  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getUserPreferences(@Request() req): Promise<UserPreferenceResponseDto> {
    return this.localizationService.getUserPreferences(req.user.userId);
  }

  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  async updateUserPreferences(
    @Request() req,
    @Body() updateDto: UpdateUserPreferenceDto,
  ): Promise<UserPreferenceResponseDto> {
    return this.localizationService.updateUserPreferences(
      req.user.userId,
      updateDto,
    );
  }

  // Localized Content Endpoints
  @Get('content/:contentKey')
  async getLocalizedContent(
    @Param('contentKey') contentKey: string,
    @Query('language') language?: string,
    @Query('region') region?: string,
  ): Promise<LocalizedContentResponseDto | null> {
    return this.localizationService.getLocalizedContent(
      contentKey,
      language,
      region,
    );
  }

  @Post('content/batch')
  async getLocalizedContentBatch(
    @Body() body: { contentKeys: string[]; language?: string; region?: string },
  ): Promise<{ [key: string]: LocalizedContentResponseDto }> {
    return this.localizationService.getLocalizedContentBatch(
      body.contentKeys,
      body.language,
      body.region,
    );
  }

  @Get('content/user/:userId')
  @UseGuards(JwtAuthGuard)
  async getLocalizedContentForUser(
    @Param('userId') userId: string,
    @Query('contentKeys') contentKeys: string,
  ): Promise<{ [key: string]: LocalizedContentResponseDto }> {
    const keys = contentKeys.split(',').map((key) => key.trim());
    return this.localizationService.getLocalizedContentForUser(userId, keys);
  }

  @Post('content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async createLocalizedContent(
    @Body() createDto: CreateLocalizedContentDto,
  ): Promise<LocalizedContentResponseDto> {
    return this.localizationService.createLocalizedContent(createDto);
  }

  @Put('content/:contentKey/:language/:region')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async updateLocalizedContent(
    @Param('contentKey') contentKey: string,
    @Param('language') language: string,
    @Param('region') region: string,
    @Body() updateDto: UpdateLocalizedContentDto,
  ): Promise<LocalizedContentResponseDto> {
    return this.localizationService.updateLocalizedContent(
      contentKey,
      language,
      region,
      updateDto,
    );
  }

  @Delete('content/:contentKey/:language/:region')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async deleteLocalizedContent(
    @Param('contentKey') contentKey: string,
    @Param('language') language: string,
    @Param('region') region: string,
  ): Promise<{ message: string }> {
    await this.localizationService.deleteLocalizedContent(
      contentKey,
      language,
      region,
    );
    return { message: 'Content deleted successfully' };
  }

  // Regional Configuration Endpoints
  @Get('regions')
  async getAllRegionalConfigs(): Promise<RegionalConfigResponseDto[]> {
    return this.localizationService.getAllRegionalConfigs();
  }

  @Get('regions/:regionCode')
  async getRegionalConfig(
    @Param('regionCode') regionCode: string,
  ): Promise<RegionalConfigResponseDto> {
    return this.localizationService.getRegionalConfig(regionCode);
  }

  @Post('regions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async createRegionalConfig(
    @Body() createDto: CreateRegionalConfigDto,
  ): Promise<RegionalConfigResponseDto> {
    return this.localizationService.createRegionalConfig(createDto);
  }

  @Put('regions/:regionCode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async updateRegionalConfig(
    @Param('regionCode') regionCode: string,
    @Body() updateDto: UpdateRegionalConfigDto,
  ): Promise<RegionalConfigResponseDto> {
    return this.localizationService.updateRegionalConfig(regionCode, updateDto);
  }

  // Utility Endpoints
  @Get('format/currency')
  @UseGuards(JwtAuthGuard)
  async formatCurrency(
    @Request() req,
    @Query('amount') amount: string,
  ): Promise<{ formatted: string }> {
    const formattedAmount = await this.localizationService.formatCurrency(
      parseFloat(amount),
      req.user.userId,
    );
    return { formatted: formattedAmount };
  }

  @Get('format/date')
  @UseGuards(JwtAuthGuard)
  async formatDate(
    @Request() req,
    @Query('date') dateString: string,
  ): Promise<{ formatted: string }> {
    const date = new Date(dateString);
    const formattedDate = await this.localizationService.formatDate(
      date,
      req.user.userId,
    );
    return { formatted: formattedDate };
  }
}
