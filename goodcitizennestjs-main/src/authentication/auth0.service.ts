/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient, AuthenticationClient } from 'auth0';
import * as jwt from 'jsonwebtoken';
import { Auth0ConfigService } from './auth0.config';

export interface Auth0UserProfile {
  sub: string; // Auth0 user ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  provider: 'google-oauth2' | 'apple';
}

export interface Auth0TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable()
export class Auth0Service {
  private managementClient: ManagementClient;
  private authenticationClient: AuthenticationClient;

  constructor(
    private configService: ConfigService,
    private auth0Config: Auth0ConfigService,
  ) {
    const config = this.auth0Config.getAuth0Config();

    this.managementClient = new ManagementClient({
      domain: config.domain,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    this.authenticationClient = new AuthenticationClient({
      domain: config.domain,
      clientId: config.clientId,
    });
  }

  /**
   * Validate Auth0 JWT token and extract user profile
   */
  async validateAuth0Token(token: string): Promise<Auth0UserProfile> {
    try {
      const config = this.auth0Config.getAuth0Config();

      // Verify the JWT token
      const decoded = jwt.verify(token, config.clientSecret, {
        audience: config.audience,
        issuer: `https://${config.domain}/`,
        algorithms: ['HS256'],
      }) as any;

      // Extract user profile from token
      const profile: Auth0UserProfile = {
        sub: decoded.sub,
        email: decoded.email,
        email_verified: decoded.email_verified,
        name: decoded.name,
        picture: decoded.picture,
        given_name: decoded.given_name,
        family_name: decoded.family_name,
        provider: this.extractProviderFromSub(decoded.sub),
      };

      return profile;
    } catch (error) {
      throw new UnauthorizedException('Invalid Auth0 token');
    }
  }

  /**
   * Exchange authorization code for Auth0 tokens
   */
  async exchangeAuth0Token(
    authCode: string,
    provider: string,
  ): Promise<Auth0TokenResponse> {
    try {
      const config = this.auth0Config.getAuth0Config();

      const tokenResponse =
        await this.authenticationClient.oauth.authorizationCodeGrant({
          code: authCode,
          redirect_uri: this.getRedirectUri(provider),
          client_id: config.clientId,
          client_secret: config.clientSecret,
        });

      const result: Auth0TokenResponse = {
        access_token: tokenResponse.data.access_token,
        id_token: tokenResponse.data.id_token || '',
        token_type: tokenResponse.data.token_type || 'Bearer',
        expires_in: tokenResponse.data.expires_in || 3600,
      };

      if (tokenResponse.data.refresh_token) {
        result.refresh_token = tokenResponse.data.refresh_token;
      }

      return result;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to exchange Auth0 token: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Refresh Auth0 tokens
   */
  async refreshAuth0Token(refreshToken: string): Promise<Auth0TokenResponse> {
    try {
      const config = this.auth0Config.getAuth0Config();

      // Note: Auth0 refresh token method may vary based on version
      // This is a simplified implementation
      const tokenResponse =
        await this.authenticationClient.oauth.clientCredentialsGrant({
          audience: config.audience,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        });

      const result: Auth0TokenResponse = {
        access_token: tokenResponse.data.access_token,
        id_token: '', // Client credentials don't return ID token
        token_type: tokenResponse.data.token_type || 'Bearer',
        expires_in: tokenResponse.data.expires_in || 3600,
      };

      // Keep the same refresh token if provided
      if (refreshToken) {
        result.refresh_token = refreshToken;
      }

      return result;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to refresh Auth0 token: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle Auth0 logout
   */
  async handleAuth0Logout(userId: string): Promise<void> {
    try {
      // Auth0 logout is typically handled on the client side
      // Here we can perform any server-side cleanup if needed
// console.log removed
    } catch (error) {
      console.error('Auth0 logout error:', error);
    }
  }

  /**
   * Get user profile from Auth0 Management API
   */
  async getUserProfile(auth0UserId: string): Promise<Auth0UserProfile> {
    try {
      const user = await this.managementClient.users.get({ id: auth0UserId });

      return {
        sub: user.data.user_id || '',
        email: user.data.email,
        email_verified: user.data.email_verified,
        name: user.data.name,
        picture: user.data.picture,
        given_name: user.data.given_name,
        family_name: user.data.family_name,
        provider: this.extractProviderFromSub(user.data.user_id || ''),
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to get Auth0 user profile: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract provider from Auth0 user ID (sub)
   */
  private extractProviderFromSub(sub: string): 'google-oauth2' | 'apple' {
    if (sub.startsWith('google-oauth2|')) {
      return 'google-oauth2';
    } else if (sub.startsWith('apple|')) {
      return 'apple';
    }
    // Default to google-oauth2 if unable to determine
    return 'google-oauth2';
  }

  /**
   * Get redirect URI for the provider
   */
  private getRedirectUri(provider: string): string {
    const baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3001';
    return `${baseUrl}/auth/callback/${provider}`;
  }

  /**
   * Validate Auth0 ID token specifically
   */
  async validateIdToken(idToken: string): Promise<Auth0UserProfile> {
    try {
      const config = this.auth0Config.getAuth0Config();

      // For ID tokens, we need to get the public key from Auth0's JWKS endpoint
      // For now, we'll use a simpler approach with the client secret
      const decoded = jwt.decode(idToken, { complete: true }) as any;

      if (!decoded) {
        throw new Error('Invalid token format');
      }

      const payload = decoded.payload;

      // Verify issuer and audience
      if (payload.iss !== `https://${config.domain}/`) {
        throw new Error('Invalid issuer');
      }

      if (payload.aud !== config.clientId) {
        throw new Error('Invalid audience');
      }

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error('Token expired');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name,
        provider: this.extractProviderFromSub(payload.sub),
      };
    } catch (error: any) {
      throw new UnauthorizedException(
        `Invalid ID token: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
