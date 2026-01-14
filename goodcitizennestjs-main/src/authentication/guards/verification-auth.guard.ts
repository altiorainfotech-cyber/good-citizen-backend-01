/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class VerificationAuthGuard extends AuthGuard('forgot-password-jwt') {
  handleRequest(err, user, info, context: ExecutionContext) {
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException({
        message: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
      });
    }

    if (info?.name === 'JsonWebTokenError') {
      throw new UnauthorizedException({
        message: 'Invalid token',
        errorCode: 'INVALID_TOKEN',
      });
    }

    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
