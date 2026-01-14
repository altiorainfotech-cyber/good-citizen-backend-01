/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import {
  RegionalCustomizationService,
  FormattedCurrency,
  FormattedDate,
  EmergencyContacts,
  RegionalPricing,
} from './regional-customization.service';

@Controller('localization/regional')
export class RegionalCustomizationController {
  constructor(
    private readonly regionalCustomizationService: RegionalCustomizationService,
  ) {}

  // Currency Formatting Endpoints
  @Get('currency/format')
  async formatCurrency(
    @Query('amount') amount: string,
    @Query('region') regionCode: string,
    @Query('language') language?: string,
  ): Promise<FormattedCurrency> {
    return this.regionalCustomizationService.formatCurrencyForRegion(
      parseFloat(amount),
      regionCode,
      language,
    );
  }

  @Get('currency/format/user')
  @UseGuards(JwtAuthGuard)
  async formatCurrencyForUser(
    @Request() req,
    @Query('amount') amount: string,
  ): Promise<FormattedCurrency> {
    return this.regionalCustomizationService.formatCurrencyForUser(
      parseFloat(amount),
      req.user.userId,
    );
  }

  // Emergency Contacts Endpoints
  @Get('emergency-contacts/:regionCode')
  async getEmergencyContacts(
    @Param('regionCode') regionCode: string,
  ): Promise<EmergencyContacts> {
    return this.regionalCustomizationService.getEmergencyContacts(regionCode);
  }

  @Get('emergency-contacts/user/current')
  @UseGuards(JwtAuthGuard)
  async getEmergencyContactsForUser(
    @Request() req,
  ): Promise<EmergencyContacts> {
    return this.regionalCustomizationService.getEmergencyContactsForUser(
      req.user.userId,
    );
  }

  @Get('emergency-contacts')
  async getAllEmergencyContacts(): Promise<EmergencyContacts[]> {
    return this.regionalCustomizationService.getAllEmergencyContacts();
  }

  // Regional Pricing Endpoints
  @Get('pricing/:regionCode')
  async getRegionalPricing(
    @Param('regionCode') regionCode: string,
    @Query('language') language?: string,
  ): Promise<RegionalPricing> {
    return this.regionalCustomizationService.getRegionalPricing(
      regionCode,
      language,
    );
  }

  @Get('pricing/user/current')
  @UseGuards(JwtAuthGuard)
  async getRegionalPricingForUser(@Request() req): Promise<RegionalPricing> {
    return this.regionalCustomizationService.getRegionalPricingForUser(
      req.user.userId,
    );
  }

  // Unit System Conversion Endpoints
  @Get('distance/convert')
  async convertDistance(
    @Query('distanceKm') distanceKm: string,
    @Query('region') regionCode: string,
  ): Promise<{ value: number; unit: string; formatted: string }> {
    return this.regionalCustomizationService.convertDistance(
      parseFloat(distanceKm),
      regionCode,
    );
  }

  @Get('distance/convert/user')
  @UseGuards(JwtAuthGuard)
  async convertDistanceForUser(
    @Request() req,
    @Query('distanceKm') distanceKm: string,
  ): Promise<{ value: number; unit: string; formatted: string }> {
    return this.regionalCustomizationService.convertDistanceForUser(
      parseFloat(distanceKm),
      req.user.userId,
    );
  }
}
