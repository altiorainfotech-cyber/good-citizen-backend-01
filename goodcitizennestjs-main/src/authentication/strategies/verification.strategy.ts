/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Session } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from 'src/user/entities/user.entity';

@Injectable()
export class VerificationStrategy extends PassportStrategy(
  Strategy,
  'forgot-password-jwt',
) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('VERIFICATION_JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
// console.log removed
    const query = { _id: payload._id, is_deleted: false };
    const projection = { password: 0 };
    const option = { lean: true };
    const user = await this.userModel.findById(query, projection, option);
// console.log removed
    if (!user) return null;
    return user;
  }
}
