/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable no-useless-catch */

import { Injectable } from '@nestjs/common';
import { RideDto, UploadVerification } from './dto/driver.dto';
import { InjectModel } from '@nestjs/mongoose';
import { DriverRide, DriverRideDocument } from './entities/driver-ride.entity';
import {
  DriverEarnings,
  DriverEarningsDocument,
} from './entities/driver-earnings.entity';
import { Model, Types } from 'mongoose';
import { ResponseUserDto } from '../user/dto/create-user.dto';
import { validate } from 'class-validator';
import { DriverApproval, RideStatus, Update } from '../common/utils';
import {
  Notification,
  NotificationDocument,
} from '../entities/notification.entity';
import { WebSocketService } from '../web-socket/web-socket.service';
import { LocationService } from '../web-socket/location.service';
import { User, UserDocument } from '../user/entities/user.entity';

@Injectable()
export class DriverService {
  private options = { lean: true, sort: { _id: -1 } } as const;
  private newOptions = { new: true } as const;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
    @InjectModel(DriverEarnings.name)
    private driverEarningsModel: Model<DriverEarningsDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private readonly webSocketService: WebSocketService,
    private readonly locationService: LocationService,
  ) {}

  async profile(user) {
    try {
      const response = new ResponseUserDto(user);
      await validate(response, { whitelist: true });
      return { data: response };
    } catch (error) {
      throw error;
    }
  }

  async start_ride(dto: RideDto, user) {
    try {
      const user_id = user._id;
      const { pickup_location, drop_location, pickup_address, drop_address } =
        dto;
      const pickup = {
        latitude: +pickup_location.latitude,
        longitude: +pickup_location.longitude,
      };
      const drop = {
        latitude: +drop_location.latitude,
        longitude: +drop_location.longitude,
      };
      const data = {
        driver_id: user_id,
        pickup_location: pickup,
        drop_location: drop,
        pickup_address,
        drop_address,
        last_notification: new Date(),
        created_at: Date.now(),
        status: RideStatus.IN_PROGRESS,
      };
      const ride = await this.driverRideModel.create(data);
      const payload = {
        lat: pickup_location.latitude,
        long: pickup_location.longitude,
      };
// console.log removed
      const driver = await this.locationService.save_coordinates(user, payload);
// console.log removed
      if (!driver) return { message: 'Driver not found', data: null };
      await this.locationService.findUsersAhead(driver, ride, 5);
      return { message: 'Ride Started', data: ride };
    } catch (error) {
      throw error;
    }
  }

  async ride_detail(id: string, user) {
    try {
      const query = {
        _id: new Types.ObjectId(id),
        driver_id: new Types.ObjectId(user._id),
      };
      const ride = await this.driverRideModel.findOne(query, {}, this.options);
      return { data: ride };
    } catch (error) {
      throw error;
    }
  }

  async end_ride(id: string, user) {
    try {
      const query = {
        _id: new Types.ObjectId(id),
        driver_id: new Types.ObjectId(user._id),
        status: RideStatus.IN_PROGRESS,
      };
      const update = { status: RideStatus.COMPLETED };
      const ride = await this.driverRideModel.findOneAndUpdate(
        query,
        update,
        this.newOptions,
      );
      await this.notificationModel.updateMany(query, update);
      if (!ride) return { message: 'Ride not found' };
      return {
        message: 'Your Ride ends here. Thank you for tarveling with us!',
      };
    } catch (error) {
      throw error;
    }
  }

  async verification(dto: UploadVerification, user) {
    try {
      const { aadhar_front, aadhar_back, dl_front, dl_back, profile_image } =
        dto;
      const query = { _id: user._id };
      const update: Update = {
        approval: DriverApproval.PENDING,
        documents_uploaded_at: new Date(),
        updated_at: Date.now(),
      };

      if (aadhar_front) update.aadhar_front = aadhar_front;
      if (aadhar_back) update.aadhar_back = aadhar_back;
      if (dl_front) update.dl_front = dl_front;
      if (dl_back) update.dl_back = dl_back;
      if (profile_image) update.profile_image = profile_image;

      await this.userModel.updateOne(query, update);
      return {
        message:
          'Documents uploaded successfully. Your application is under review.',
      };
    } catch (error) {
      throw error;
    }
  }

  async getDriverProfile(user) {
    try {
      const query = { _id: user._id };
      const projection = {
        password: 0,
        otp: 0,
        otp_expire_at: 0,
        socket_id: 0,
      };

      const driver = await this.userModel.findOne(
        query,
        projection,
        this.options,
      );
      if (!driver) {
        throw new Error('Driver not found');
      }

      return {
        data: {
          ...driver,
          documents_status: this.getDocumentsStatus(driver),
          earnings_summary: {
            total_earnings: driver.total_earnings || 0,
            total_rides: driver.total_rides || 0,
            average_rating: driver.driver_rating || 0,
            acceptance_rate: driver.acceptance_rate || 0,
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getDriverEarnings(user, startDate?: Date, endDate?: Date) {
    try {
      const query: any = {
        driver_id: new Types.ObjectId(user._id),
      };

      if (startDate && endDate) {
        query.earned_at = {
          $gte: startDate,
          $lte: endDate,
        };
      }

      // Get earnings from the earnings collection
      const earnings = await this.driverEarningsModel.find(
        query,
        {},
        this.options,
      );

      // Calculate totals
      const totalEarnings = earnings.reduce(
        (sum, earning) => sum + earning.driver_earnings,
        0,
      );
      const paidEarnings = earnings
        .filter((earning) => earning.payment_status === 'PAID')
        .reduce((sum, earning) => sum + earning.driver_earnings, 0);
      const pendingEarnings = earnings
        .filter((earning) => earning.payment_status === 'PENDING')
        .reduce((sum, earning) => sum + earning.driver_earnings, 0);

      // Calculate today's earnings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayEarnings = earnings
        .filter((earning) => {
          const earningDate = new Date(earning.earned_at);
          return earningDate >= today && earningDate < tomorrow;
        })
        .reduce((sum, earning) => sum + earning.driver_earnings, 0);

      // Get ride statistics
      const totalRides = await this.driverRideModel.countDocuments({
        driver_id: new Types.ObjectId(user._id),
      });

      const completedRides = await this.driverRideModel.countDocuments({
        driver_id: new Types.ObjectId(user._id),
        status: RideStatus.COMPLETED,
      });

      return {
        data: {
          total_earnings: totalEarnings,
          paid_earnings: paidEarnings,
          pending_earnings: pendingEarnings,
          today_earnings: todayEarnings,
          total_rides: totalRides,
          completed_rides: completedRides,
          earnings_detail: earnings.map((earning) => ({
            ride_id: earning.ride_id,
            total_fare: earning.total_fare,
            driver_earnings: earning.driver_earnings,
            platform_fee: earning.platform_fee,
            payment_status: earning.payment_status,
            earned_at: earning.earned_at,
            paid_at: earning.paid_at,
          })),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getDriverStatistics(user) {
    try {
      const driverId = new Types.ObjectId(user._id);

      // Get basic ride statistics
      const totalRides = await this.driverRideModel.countDocuments({
        driver_id: driverId,
      });
      const completedRides = await this.driverRideModel.countDocuments({
        driver_id: driverId,
        status: RideStatus.COMPLETED,
      });
      const cancelledRides = await this.driverRideModel.countDocuments({
        driver_id: driverId,
        status: RideStatus.CANCELLED,
      });

      // Calculate completion rate
      const completionRate =
        totalRides > 0 ? (completedRides / totalRides) * 100 : 0;

      // Calculate cancellation rate
      const cancellationRate =
        totalRides > 0 ? (cancelledRides / totalRides) * 100 : 0;

      // Get earnings statistics
      const earningsStats = await this.driverEarningsModel.aggregate([
        { $match: { driver_id: driverId } },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$driver_earnings' },
            averageEarningsPerRide: { $avg: '$driver_earnings' },
            totalPlatformFees: { $sum: '$platform_fee' },
            paidEarnings: {
              $sum: {
                $cond: [
                  { $eq: ['$payment_status', 'PAID'] },
                  '$driver_earnings',
                  0,
                ],
              },
            },
            pendingEarnings: {
              $sum: {
                $cond: [
                  { $eq: ['$payment_status', 'PENDING'] },
                  '$driver_earnings',
                  0,
                ],
              },
            },
          },
        },
      ]);

      const earnings = earningsStats[0] || {
        totalEarnings: 0,
        averageEarningsPerRide: 0,
        totalPlatformFees: 0,
        paidEarnings: 0,
        pendingEarnings: 0,
      };

      // Get weekly earnings trend (last 4 weeks)
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const weeklyEarnings = await this.driverEarningsModel.aggregate([
        {
          $match: {
            driver_id: driverId,
            earned_at: { $gte: fourWeeksAgo },
          },
        },
        {
          $group: {
            _id: {
              week: { $week: '$earned_at' },
              year: { $year: '$earned_at' },
            },
            weeklyEarnings: { $sum: '$driver_earnings' },
            ridesCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
      ]);

      // Get current driver rating from user document
      const driverInfo = await this.userModel.findById(user._id, {
        driver_rating: 1,
        total_rides: 1,
        total_earnings: 1,
        acceptance_rate: 1,
      });

      return {
        data: {
          ride_statistics: {
            total_rides: totalRides,
            completed_rides: completedRides,
            cancelled_rides: cancelledRides,
            completion_rate: Math.round(completionRate * 100) / 100,
            cancellation_rate: Math.round(cancellationRate * 100) / 100,
          },
          earnings_statistics: {
            total_earnings: earnings.totalEarnings,
            paid_earnings: earnings.paidEarnings,
            pending_earnings: earnings.pendingEarnings,
            average_earnings_per_ride:
              Math.round(earnings.averageEarningsPerRide * 100) / 100,
            total_platform_fees: earnings.totalPlatformFees,
          },
          performance_metrics: {
            driver_rating: driverInfo?.driver_rating || 0,
            acceptance_rate: driverInfo?.acceptance_rate || 0,
            total_rides_from_profile: driverInfo?.total_rides || 0,
            total_earnings_from_profile: driverInfo?.total_earnings || 0,
          },
          weekly_earnings_trend: weeklyEarnings.map((week) => ({
            week: week._id.week,
            year: week._id.year,
            earnings: week.weeklyEarnings,
            rides_count: week.ridesCount,
            average_per_ride:
              week.ridesCount > 0
                ? Math.round((week.weeklyEarnings / week.ridesCount) * 100) /
                  100
                : 0,
          })),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getDriverEarningsHistory(
    user,
    pagination: number = 1,
    limit: number = 20,
  ) {
    try {
      const skip = (pagination - 1) * limit;
      const query = { driver_id: new Types.ObjectId(user._id) };

      // Get total count for pagination
      const totalCount = await this.driverEarningsModel.countDocuments(query);

      // Get earnings with pagination
      const earnings = await this.driverEarningsModel
        .find(query)
        .sort({ earned_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ride_id', 'pickup_location destination_location')
        .lean();

      // Privacy control: Only show earnings to the driver themselves
      const sanitizedEarnings = earnings.map((earning) => ({
        ride_id: earning.ride_id,
        total_fare: earning.total_fare,
        driver_earnings: earning.driver_earnings,
        platform_fee: earning.platform_fee,
        payment_status: earning.payment_status,
        earned_at: earning.earned_at,
        paid_at: earning.paid_at,
        payment_method: earning.payment_method,
        // Include ride details for context
        ride_details:
          earning.ride_id && typeof earning.ride_id === 'object'
            ? {
                pickup_address: (earning.ride_id as any).pickup_location
                  ?.address,
                drop_address: (earning.ride_id as any).destination_location
                  ?.address,
              }
            : null,
      }));

      return {
        data: {
          earnings: sanitizedEarnings,
          pagination: {
            current_page: pagination,
            total_pages: Math.ceil(totalCount / limit),
            total_count: totalCount,
            per_page: limit,
            has_next: pagination < Math.ceil(totalCount / limit),
            has_prev: pagination > 1,
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async updateDriverRating(driverId: string, newRating: number) {
    try {
      // Validate rating range
      if (newRating < 1 || newRating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const driver = await this.userModel.findById(driverId);
      if (!driver) {
        throw new Error('Driver not found');
      }

      // Calculate new average rating
      const currentRating = driver.driver_rating || 0;
      const totalRides = driver.total_rides || 0;

      let newAverageRating: number;
      if (totalRides === 0) {
        newAverageRating = newRating;
      } else {
        // Calculate weighted average
        const totalRatingPoints = currentRating * totalRides;
        newAverageRating = (totalRatingPoints + newRating) / (totalRides + 1);
      }

      // Update driver rating and increment ride count
      await this.userModel.findByIdAndUpdate(driverId, {
        driver_rating: Math.round(newAverageRating * 100) / 100, // Round to 2 decimal places
        $inc: { total_rides: 1 },
        updated_at: Date.now(),
      });

      return {
        message: 'Driver rating updated successfully',
        new_rating: Math.round(newAverageRating * 100) / 100,
        total_rides: totalRides + 1,
      };
    } catch (error) {
      throw error;
    }
  }

  async updateDriverAcceptanceRate(driverId: string, accepted: boolean) {
    try {
      const driver = await this.userModel.findById(driverId);
      if (!driver) {
        throw new Error('Driver not found');
      }

      // Simple acceptance rate calculation (this could be enhanced with more sophisticated tracking)
      const currentRate = driver.acceptance_rate || 0;
      const totalOffers = driver.total_rides || 0; // Using total_rides as proxy for offers

      let newAcceptanceRate: number;
      if (totalOffers === 0) {
        newAcceptanceRate = accepted ? 1 : 0;
      } else {
        const totalAccepted = currentRate * totalOffers;
        const newTotalAccepted = accepted ? totalAccepted + 1 : totalAccepted;
        newAcceptanceRate = newTotalAccepted / (totalOffers + 1);
      }

      await this.userModel.findByIdAndUpdate(driverId, {
        acceptance_rate: Math.round(newAcceptanceRate * 10000) / 10000, // Round to 4 decimal places
        updated_at: Date.now(),
      });

      return {
        message: 'Acceptance rate updated',
        new_acceptance_rate: Math.round(newAcceptanceRate * 100 * 100) / 100, // Convert to percentage
      };
    } catch (error) {
      throw error;
    }
  }

  async createEarningsRecord(rideId: string, fareDetails: any) {
    try {
      const ride = await this.driverRideModel.findById(rideId);
      if (!ride || !ride.driver_id) {
        throw new Error('Ride or driver not found');
      }

      const platformFeeRate = 0.15; // 15% platform fee
      const platformFee = fareDetails.total_fare * platformFeeRate;
      const driverEarnings = fareDetails.total_fare - platformFee;

      const earningsRecord = new this.driverEarningsModel({
        driver_id: ride.driver_id,
        ride_id: rideId,
        base_fare: fareDetails.base_fare || 0,
        distance_fare: fareDetails.distance_fare || 0,
        time_fare: fareDetails.time_fare || 0,
        surge_multiplier: fareDetails.surge_multiplier || 1,
        platform_fee: platformFee,
        total_fare: fareDetails.total_fare,
        driver_earnings: driverEarnings,
        payment_status: 'PENDING',
        earned_at: new Date(),
      });

      await earningsRecord.save();

      // Update driver's total earnings
      await this.userModel.findByIdAndUpdate(ride.driver_id, {
        $inc: { total_earnings: driverEarnings },
      });

      return earningsRecord;
    } catch (error) {
      throw error;
    }
  }

  async updateDriverAvailability(user, isOnline: boolean) {
    try {
      const query = { _id: user._id };
      const update = {
        is_online: isOnline,
        updated_at: Date.now(),
      };

      await this.userModel.updateOne(query, update);
      return {
        message: `Driver status updated to ${isOnline ? 'online' : 'offline'}`,
        is_online: isOnline,
      };
    } catch (error) {
      throw error;
    }
  }

  private getDocumentsStatus(driver: any) {
    const requiredDocs = ['aadhar_front', 'aadhar_back', 'dl_front', 'dl_back'];
    const uploadedDocs = requiredDocs.filter((doc) => driver[doc]);

    return {
      total_required: requiredDocs.length,
      uploaded: uploadedDocs.length,
      missing: requiredDocs.filter((doc) => !driver[doc]),
      is_complete: uploadedDocs.length === requiredDocs.length,
    };
  }
}
