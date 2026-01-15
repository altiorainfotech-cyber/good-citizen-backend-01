/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Roles } from '../authentication/roles.decorator';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { UserType } from '../common/utils';
import { notification } from './dto/update-user.dto';

@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   *  Will handle the user notification controller logic
   * @returns
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('notification')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `User notification Api` })
  async notification(@Query() dto: notification, @Req() req: any) {
    const user = req.user;
    return await this.userService.notification(dto, user);
  }

  /**
   * Get user's ambulance assists history
   * @returns
   */
  @ApiBearerAuth('authorization')
  @Roles(UserType.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':userId/ambulance-assists')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: `Get user ambulance assists history` })
  async getAmbulanceAssists(@Param('userId') userId: string, @Req() req: any) {
    const user = req.user;
    return await this.userService.getAmbulanceAssists(userId, user);
  }
}
