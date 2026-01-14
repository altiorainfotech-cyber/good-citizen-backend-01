/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  Auth0AuthDto,
  DriverSignupDto,
  DriverLoginDto,
  RefreshTokenDto,
  AuthResponseDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  FrontendIntegrationService,
  AuthSliceResponse,
} from '../common/frontend-integration.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly frontendIntegration: FrontendIntegrationService,
  ) {}

  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with Auth0 (Google/Apple)' })
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  @ApiResponse({ status: 400, description: 'Authentication failed' })
  async authenticateWithAuth0(
    @Body() authDto: Auth0AuthDto,
  ): Promise<AuthSliceResponse> {
    const authResponse = await this.authService.authenticateWithAuth0(authDto);
    return this.frontendIntegration.formatAuthResponse(authResponse.user, {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
    });
  }

  @Post('driver/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new driver with email/password' })
  @ApiResponse({ status: 201, description: 'Driver registered successfully' })
  @ApiResponse({ status: 400, description: 'Registration failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async registerDriver(
    @Body() signupDto: DriverSignupDto,
  ): Promise<AuthSliceResponse> {
    const authResponse = await this.authService.registerDriver(signupDto);
    return this.frontendIntegration.formatAuthResponse(authResponse.user, {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
    });
  }

  @Post('driver/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login driver with email/password' })
  @ApiResponse({ status: 200, description: 'Driver logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginDriver(
    @Body() loginDto: DriverLoginDto,
  ): Promise<AuthSliceResponse> {
    const authResponse = await this.authService.loginDriver(loginDto);
    return this.frontendIntegration.formatAuthResponse(authResponse.user, {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshDto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and invalidate session' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.session_id);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout all sessions for current user' })
  @ApiResponse({
    status: 200,
    description: 'All sessions logged out successfully',
  })
  async logoutAllSessions(@Req() req: any) {
    await this.authService.logoutAllSessions(req.user._id);
    return { message: 'All sessions logged out successfully' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@Req() req: any) {
    return this.frontendIntegration.formatAuthResponse(
      {
        _id: req.user._id,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        email: req.user.email,
        phone_number: req.user.phone_number,
        role: req.user.role,
        loyalty_points: req.user.loyalty_point || 0,
        is_email_verified: req.user.is_email_verified,
      },
      { access_token: '', refresh_token: '' }, // Profile endpoint doesn't need tokens
    );
  }
}
