/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable no-useless-catch */

import { BadRequestException, Injectable } from '@nestjs/common';
import { User, UserDocument } from './user/entities/user.entity';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Session, SessionDocument } from './user/entities/session.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CommonService } from './common/common.service';
import moment from 'moment';
import {
  ForgotPassword,
  GetContent,
  LoginDto,
  OtpDto,
  ResendOtp,
  ResetForgotPassword,
  ResponseUserDto,
  SignupDto,
  VerifyForgotPassword,
} from './user/dto/create-user.dto';
import { validate } from 'class-validator';
import { Query, RideStatus, UserType } from './common/utils';
import { UpdateUserDto } from './user/dto/update-user.dto';
import {
  DriverRide,
  DriverRideDocument,
} from './driver/entities/driver-ride.entity';
import { Content, ContentDocument } from './admin/entities/content.entity';

@Injectable()
export class AppService {
  private option = { lean: true } as const;
  private updateOption = { new: true } as const;
  private VERIFICATION_JWT_SECRET: string;
  private VERIFICATION_JWT_EXPIRY: string;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
    @InjectModel(Content.name) private contentModel: Model<ContentDocument>,

    private commonService: CommonService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    (this.VERIFICATION_JWT_SECRET = this.configService.get<string>(
      'VERIFICATION_JWT_SECRET',
    )!),
      (this.VERIFICATION_JWT_EXPIRY = this.configService.get<string>(
        'VERIFICATION_JWT_EXPIRY',
      )!);
  }

  private async generateForgotPasswordToken(
    _id: Types.ObjectId | string,
    email: string,
    role: string,
  ) {
    return await this.jwtService.sign(
      { _id, email, role },
      {
        secret: this.VERIFICATION_JWT_SECRET,
        expiresIn: this.VERIFICATION_JWT_EXPIRY,
      },
    );
  }

  async signup(dto: SignupDto): Promise<any> {
    try {
      const { email, password, role, lat, long } = dto;
      const query = { email: email.toLowerCase(), is_deleted: false };
      const projection = { email: 1 };
      const isUser = await this.userModel.findOne(
        query,
        projection,
        this.option,
      );
      if (isUser) throw new BadRequestException('Email already exist');
      const hashPassword = await this.commonService.hashPassword(password);
      const otp = '123456';
      const data = {
        ...dto,
        role: dto.role,
        email: email.toLowerCase(),
        password: hashPassword,
        otp,
        loyalty_point: role === UserType.USER ? 5 : 0,
        otp_expire_at: new Date(new Date().getTime() + 1 * 60000),
        pre_location: {
          type: 'Point',
          coordinates: [parseFloat(lat), parseFloat(long)],
        },
        location: {
          type: 'Point',
          coordinates: [parseFloat(lat), parseFloat(long)],
        },
        latitude: parseFloat(lat),
        longitude: parseFloat(long),
        created_at: moment().utc().valueOf(),
      };
      const user = await this.userModel.create(data);
      const access_token = await this.commonService.generateTempToken(
        user._id,
        user.email,
        user.role,
      );
      return { access_token };
    } catch (error) {
      throw error;
    }
  }

  async verify_otp(dto: OtpDto, user: any): Promise<any> {
    try {
      const { otp, fcm_token, device_type } = dto;
      const query = { _id: user._id };
      const projection = { otp_expire_at: 1, otp: 1 };
      const fetch_user = await this.userModel.findById(
        query,
        projection,
        this.option,
      );
      if (!fetch_user) throw new BadRequestException('User not found');
      if (new Date(fetch_user.otp_expire_at) < new Date())
        throw new BadRequestException('Otp expired');
      if (+fetch_user.otp !== +otp)
        throw new BadRequestException('Invalid otp');
      const update = {
        otp_expire_at: null,
        otp: null,
        is_email_verified: true,
      };
      const update_user = await this.userModel.findByIdAndUpdate(
        query,
        update,
        this.updateOption,
      );
      if (!update_user) throw new BadRequestException('Failed to update user');
      const session = await this.createSession(
        update_user._id,
        update_user.role,
        fcm_token,
        device_type,
      );
      const access_token = await this.commonService.generateToken(
        update_user._id,
        session._id,
        update_user.email,
        update_user.role,
      );
      const userData = { ...update_user.toObject(), access_token };
      const response = new ResponseUserDto(userData);
      await validate(response, { whitelist: true });
      const data = { message: 'Otp verified successfully.', ...response };
      return { data };
    } catch (error) {
// console.log removed
      throw error;
    }
  }

  async profile(user: any) {
    try {
      let userData = { ...user };
      if (user.role === UserType.DRIVER) {
        const query = {
          driver_id: new Types.ObjectId(user._id),
          status: RideStatus.IN_PROGRESS,
        };
        const ride = await this.driverRideModel.findOne(query, {}, this.option);
        const distance = ride
          ? await this.calculateDistance(
              ride.pickup_location,
              ride?.drop_location,
            )
          : null;
        userData = { ...user, ride_id: ride?._id ?? null, distance };
      }
      const response = new ResponseUserDto(userData);
      await validate(response, { whitelist: true });
      return { data: response };
    } catch (error) {
      throw error;
    }
  }

  async calculateDistance(
    pickup_location: { latitude: number; longitude: number },
    drop_location: { latitude: number; longitude: number },
  ): Promise<number> {
    try {
// console.log removed
// console.log removed
      const lat1 = pickup_location.latitude;
      const lon1 = pickup_location.longitude;
      const lat2 = drop_location.latitude;
      const lon2 = drop_location.longitude;

      const toRad = (value: number) => (value * Math.PI) / 180;

      const R = 6371; // Radius of the Earth in km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return distance; // in kilometers
    } catch (error) {
      throw error;
    }
  }

  async update_profile(dto: UpdateUserDto, user: any) {
    try {
      const {
        old_password,
        new_password,
        first_name,
        last_name,
        phone_number,
        country_code,
      } = dto;
      const update: Query = {};
      if (old_password && new_password) {
        const is_password = await this.commonService.compareHash(
          old_password,
          user.password,
        );
        if (!is_password) throw new BadRequestException('Incorrect password');
        const hashedPassword =
          await this.commonService.hashPassword(new_password);
        update.password = hashedPassword;
      }
      if (first_name) {
        update.first_name = first_name;
      }
      if (last_name) {
        update.last_name = last_name;
      }
      if (country_code) {
        update.country_code = country_code;
      }
      if (phone_number) {
        update.phone_number = phone_number;
      }
      const query = { _id: user._id };
      const result = await this.userModel
        .findByIdAndUpdate(query, update, { new: true })
        .lean();
      const response = new ResponseUserDto(result ?? {});
      await validate(response, { whitelist: true });
      return { data: response };
    } catch (error) {
      throw error;
    }
  }

  createSession = async (
    user_id: string | Types.ObjectId,
    role: string,
    fcm_token: string,
    device_type: string,
  ) => {
    await this.sessionModel.deleteMany({ user_id });
    return await this.sessionModel.create({
      user_id,
      role,
      fcm_token,
      device_type,
    });
  };

  async login(dto: LoginDto, _res: Response) {
    try {
      const { email, password, fcm_token, device_type, lat, long } = dto;
      const query = { email: email.toLowerCase(), is_deleted: false };
      const projection = {
        email: 1,
        password: 1,
        role: 1,
        is_email_verified: 1,
      };
      const isUser = await this.userModel.findOne(
        query,
        projection,
        this.option,
      );
      if (!isUser)
        throw new BadRequestException("User doesn't exist. Please sign-up.");
      const is_password = await this.commonService.compareHash(
        password,
        isUser.password,
      );
      if (!is_password) throw new BadRequestException('Incorrect password');
      if (isUser.is_email_verified === false) {
        const access_token = await this.commonService.generateTempToken(
          isUser._id,
          isUser.email,
          isUser.role,
        );
        await this.generate_otp(isUser._id);
        const data = {
          is_email_verified: isUser.is_email_verified,
          access_token,
        };
        return { data };
      }
      const isPassword = await this.commonService.compareHash(
        password,
        isUser.password,
      );
      if (!isPassword)
        throw new BadRequestException('Incorrect email or password!.');
      const session = await this.createSession(
        isUser._id,
        isUser.role,
        fcm_token,
        device_type,
      );
      const access_token = await this.commonService.generateToken(
        isUser._id,
        session._id,
        isUser.email,
        isUser.role,
      );
      const update = {
        $set: {
          pre_location: {
            type: 'Point',
            coordinates: [parseFloat(lat), parseFloat(long)],
          },
          location: {
            type: 'Point',
            coordinates: [parseFloat(lat), parseFloat(long)],
          },
          latitude: parseFloat(lat),
          longitude: parseFloat(long),
        },
      };
      await this.userModel.updateOne({ _id: isUser._id }, update);
      const userData = { ...isUser, access_token };
      const response = new ResponseUserDto(userData);
      await validate(response, { whitelist: true });
      const data = { message: 'Login successfully.', ...response };
      return { data };
    } catch (error) {
      throw error;
    }
  }

  async generate_otp(user_id: string | Types.ObjectId) {
    try {
      const otp = '123456';
      const otpDetails = {
        otp,
        otp_expire_at: new Date(new Date().getTime() + 1 * 60000),
      };
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(user_id) },
        otpDetails,
      );
    } catch (error) {
      throw error;
    }
  }

  async save_coordinates(user: any, lat: string, long: string): Promise<any> {
    try {
      const query = { _id: new Types.ObjectId(user._id) };
      const location = {
        type: 'Point',
        coordinates: [+long, +lat], // Note: MongoDB stores coordinates as [longitude, latitude]
      };
      // let direction = await this.calculatDirection(user.latitude, user.longitude, +lat, +long);
      const update = {
        $set: {
          pre_location: location,
          location,
          latitude: +lat,
          longitude: +long,
        },
      };
      return await this.userModel.findByIdAndUpdate(query, update, {
        new: true,
      });
    } catch (error) {
      throw error;
    }
  }

  async forgot_password(dto: ForgotPassword) {
    try {
      const { email } = dto;
      const query = { email: email.toLowerCase(), is_deleted: false };
      const projection = { email: 1 };
      const isUser = await this.userModel.findOne(
        query,
        projection,
        this.option,
      );
      if (!isUser)
        throw new BadRequestException("User doesn't exist. Please sign-up.");
      await this.generate_otp(isUser._id);
      return { message: 'Otp sent successfully.' };
    } catch (error) {
      throw error;
    }
  }

  async verify_forgot_password(dto: VerifyForgotPassword) {
    try {
      const { email, otp } = dto;
      const query = { email: email.toLowerCase(), is_deleted: false };
      const projection = { otp: 1, otp_expire_at: 1 };
      const isUser = await this.userModel.findOne(
        query,
        projection,
        this.option,
      );
      if (!isUser)
        throw new BadRequestException("User doesn't exist. Please sign-up.");
      if (new Date(isUser.otp_expire_at) < new Date())
        throw new BadRequestException('Otp expired');
      if (+isUser.otp !== +otp) throw new BadRequestException('Invalid otp');
      const access_token = await this.generateForgotPasswordToken(
        isUser._id,
        isUser.email,
        isUser.role,
      );
      return { access_token };
    } catch (error) {
      throw error;
    }
  }

  async reset_forgot_password(dto: ResetForgotPassword, user: any) {
    try {
      const { password } = dto;
      const hashPassword = await this.commonService.hashPassword(password);
      const query = { _id: user._id };
      const update = { password: hashPassword };
      await this.userModel.findByIdAndUpdate(query, update, this.updateOption);
      return { message: 'Password reset successfully.' };
    } catch (error) {
      throw error;
    }
  }

  async logout(dto: any) {
    try {
      await this.sessionModel.findByIdAndDelete({ _id: dto.session_id });
      return { message: 'Logout Successfully.' };
    } catch (error) {
      throw error;
    }
  }

  async delete_account(user: any) {
    try {
      const query = { _id: user._id };
      const update = { is_deleted: true };
      await this.userModel.updateOne(query, update);
      await this.sessionModel.deleteMany({ user_id: user._id });
      return { message: 'Account Deleted Successfully.' };
    } catch (error) {
      throw error;
    }
  }

  async resend_otp(dto: ResendOtp) {
    try {
      const { email } = dto;
      const query = { email: email.toLowerCase(), is_deleted: false };
      const projection = { email: 1 };
      const isUser = await this.userModel.findOne(
        query,
        projection,
        this.option,
      );
      if (!isUser)
        throw new BadRequestException("User doesn't exist. Please sign-up.");
      const access_token = await this.commonService.generateTempToken(
        isUser._id,
        isUser.email,
        isUser.role,
      );
      await this.generate_otp(isUser._id);
      const data = {
        message: 'Otp sent successfully.',
        access_token,
      };
      return { data };
    } catch (error) {
      throw error;
    }
  }

  async content(dto: GetContent) {
    try {
      const { type } = dto;
      let query = {};
      if (type) query = { type };
      const content = await this.contentModel.find(query, {}, this.option);
      return { data: content };
    } catch (error) {
      throw error;
    }
  }
}
