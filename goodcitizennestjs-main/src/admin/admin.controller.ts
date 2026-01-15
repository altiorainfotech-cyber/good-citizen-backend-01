import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import {
  Add_Content,
  AdminLoginDto,
  GetContent,
  Idto,
  Listing,
  ListingDto,
  DashboardMetricsDto,
  SystemMonitoringDto,
  EmergencyBroadcastDto,
  ContentVersionDto,
  MultiLanguageContentDto,
} from './dto/create-admin.dto';
import { UserType } from '../common/utils';
import { Roles } from '../authentication/roles.decorator';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Approval } from './dto/driver.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin login Api` })
  @Post('login')
  async login(@Body() dto: AdminLoginDto): Promise<any> {
    return await this.adminService.login(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin user list Api` })
  @Get('usersList')
  async usersList(@Query() dto: Listing): Promise<any> {
    return await this.adminService.userList(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin user/driver detail pi` })
  @Get('user/detail/:id')
  async user_detail(@Param() ID: Idto): Promise<any> {
    return await this.adminService.user_detail(ID.id);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin approve driver Api` })
  @Patch('driver-approval/:id')
  async driver_approval(
    @Param() ID: Idto,
    @Body() dto: Approval,
  ): Promise<any> {
    return await this.adminService.driver_approval(ID.id, dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get driver details for approval Api` })
  @Get('driver/details/:id')
  async getDriverDetails(@Param() ID: Idto): Promise<any> {
    return await this.adminService.getDriverDetails(ID.id);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get pending driver approvals Api` })
  @Get('pending-drivers')
  async getPendingDriverApprovals(@Query() dto: Listing): Promise<any> {
    return await this.adminService.getPendingDriverApprovals(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin driver list Api` })
  @Get('driverList')
  async driverList(@Query() dto: Listing): Promise<any> {
    return await this.adminService.driverList(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin driver list Api` })
  @Get('driver-ride/List/:id')
  async driver_ride_list(
    @Param() ID: Idto,
    @Query() dto: ListingDto,
  ): Promise<any> {
    return await this.adminService.driver_ride_list(ID.id, dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin add content Api` })
  @Post('content')
  async add_content(@Query() dto: Add_Content): Promise<any> {
    return await this.adminService.addContent(dto);
  }

  @ApiBearerAuth('authorization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @Get('content')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Admin get content Api` })
  async content(@Query() dto: GetContent) {
    return await this.adminService.content(dto);
  }

  // Enhanced Admin Dashboard Endpoints

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get real-time dashboard metrics` })
  @Get('dashboard/metrics')
  async getDashboardMetrics(@Query() dto: DashboardMetricsDto): Promise<any> {
    return await this.adminService.getDashboardMetrics(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get system monitoring data` })
  @Get('system/monitoring')
  async getSystemMonitoring(@Query() dto: SystemMonitoringDto): Promise<any> {
    return await this.adminService.getSystemMonitoring(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get platform analytics` })
  @Get('analytics')
  async getAnalytics(@Query() dto: DashboardMetricsDto): Promise<any> {
    return await this.adminService.getAnalytics(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get ride patterns and statistics` })
  @Get('rides/analytics')
  async getRideAnalytics(@Query() dto: DashboardMetricsDto): Promise<any> {
    return await this.adminService.getRideAnalytics(dto);
  }

  // Content Management with Versioning

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get content versions` })
  @Get('content/versions/:contentId')
  async getContentVersions(
    @Param('contentId') contentId: string,
  ): Promise<any> {
    return await this.adminService.getContentVersions(contentId);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Restore content version` })
  @Post('content/restore-version')
  async restoreContentVersion(@Body() dto: ContentVersionDto): Promise<any> {
    return await this.adminService.restoreContentVersion(dto);
  }

  // Multi-language Content Support

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Add multi-language content` })
  @Post('content/multi-language')
  async addMultiLanguageContent(
    @Body() dto: MultiLanguageContentDto,
  ): Promise<any> {
    return await this.adminService.addMultiLanguageContent(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get content by language` })
  @Get('content/language/:languageCode')
  async getContentByLanguage(
    @Param('languageCode') languageCode: string,
    @Query() dto: GetContent,
  ): Promise<any> {
    return await this.adminService.getContentByLanguage(languageCode, dto);
  }

  // Emergency Broadcast System

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Send emergency broadcast` })
  @Post('emergency/broadcast')
  async sendEmergencyBroadcast(
    @Body() dto: EmergencyBroadcastDto,
  ): Promise<any> {
    return await this.adminService.sendEmergencyBroadcast(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get emergency broadcast history` })
  @Get('emergency/broadcasts')
  async getEmergencyBroadcasts(@Query() dto: Listing): Promise<any> {
    return await this.adminService.getEmergencyBroadcasts(dto);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get emergency broadcast details` })
  @Get('emergency/broadcast/:id')
  async getEmergencyBroadcastDetails(@Param() ID: Idto): Promise<any> {
    return await this.adminService.getEmergencyBroadcastDetails(ID.id);
  }

  // Additional Content Management Endpoints

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Delete content` })
  @Delete('content/:id')
  async deleteContent(@Param() ID: Idto): Promise<any> {
    return await this.adminService.deleteContent(ID.id);
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get all supported languages` })
  @Get('content/languages')
  async getSupportedLanguages(): Promise<any> {
    return await this.adminService.getSupportedLanguages();
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get content translation status` })
  @Get('content/translation-status')
  async getContentTranslationStatus(): Promise<any> {
    return await this.adminService.getContentTranslationStatus();
  }

  @ApiBearerAuth('authorization')
  @Roles(UserType.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Bulk update content translations` })
  @Post('content/bulk-translate')
  async bulkTranslateContent(
    @Body() dto: { language_code: string; content_ids: string[] },
  ): Promise<any> {
    return await this.adminService.bulkTranslateContent(dto);
  }
}
