import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
}

@Injectable()
export class Auth0ConfigService {
  constructor(private configService: ConfigService) {}

  getAuth0Config(): Auth0Config {
    return {
      domain: this.configService.get<string>('AUTH0_DOMAIN') || '',
      clientId: this.configService.get<string>('AUTH0_CLIENT_ID') || '',
      clientSecret: this.configService.get<string>('AUTH0_CLIENT_SECRET') || '',
      audience: this.configService.get<string>('AUTH0_AUDIENCE') || '',
      scope: 'openid profile email',
    };
  }

  getAuth0Domain(): string {
    return this.configService.get<string>('AUTH0_DOMAIN') || '';
  }

  getAuth0ClientId(): string {
    return this.configService.get<string>('AUTH0_CLIENT_ID') || '';
  }

  getAuth0ClientSecret(): string {
    return this.configService.get<string>('AUTH0_CLIENT_SECRET') || '';
  }

  getAuth0Audience(): string {
    return this.configService.get<string>('AUTH0_AUDIENCE') || '';
  }
}
