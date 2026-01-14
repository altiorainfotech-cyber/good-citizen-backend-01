/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable no-useless-catch */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.entity';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './entities/session.entity';
import { CommonService } from '../common/common.service';
import { Query } from '../common/utils';
import { notification } from './dto/update-user.dto';
import {
  Notification,
  NotificationDocument,
} from '../entities/notification.entity';

@Injectable()
export class UserService {
  private option = { lean: true } as const;
  private updateOption = { new: true } as const;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private commonService: CommonService,
  ) {}

  async notification(dto: notification, user) {
    try {
      const { status, pagination, limit } = dto;
      const user_id = user._id;
      const setOptions = await this.commonService.setOptions(pagination, limit);
      const query: Query = { user_id: new Types.ObjectId(user_id) };
      const count = await this.notificationModel.countDocuments(query);
      if (status) {
        query.status = status;
      }
// console.log removed
      const population = [
        { path: 'driver_id', select: 'first_name last_name email' },
      ];
      const notification = await this.notificationModel
        .find(query, {}, setOptions)
        .populate(population);
      const data = { count, notification };
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getAmbulanceAssists(userId: string, user: any) {
    try {
      // Mock ambulance assists data - in production this would come from a database
      const ambulanceAssists = [
        {
          id: 'assist-1',
          requestId: 'req-001',
          type: 'emergency_transport',
          status: 'completed',
          requestedAt: new Date('2024-01-15T10:30:00Z'),
          completedAt: new Date('2024-01-15T11:15:00Z'),
          location: {
            pickup: { latitude: 28.6139, longitude: 77.209, address: 'Connaught Place, New Delhi' },
            destination: { latitude: 28.6289, longitude: 77.2065, address: 'AIIMS Hospital, New Delhi' }
          },
          ambulanceProvider: {
            id: 'provider-1',
            name: 'Delhi Emergency Services',
            vehicleNumber: 'DL-01-AB-1234',
            driverName: 'Rajesh Kumar'
          },
          responseTime: 8, // minutes
          totalTime: 45, // minutes
          cost: 850, // INR
          rating: 5
        },
        {
          id: 'assist-2',
          requestId: 'req-002',
          type: 'medical_emergency',
          status: 'completed',
          requestedAt: new Date('2024-01-10T14:20:00Z'),
          completedAt: new Date('2024-01-10T15:05:00Z'),
          location: {
            pickup: { latitude: 28.5355, longitude: 77.391, address: 'Sector 18, Noida' },
            destination: { latitude: 28.5672, longitude: 77.3507, address: 'Fortis Hospital, Noida' }
          },
          ambulanceProvider: {
            id: 'provider-2',
            name: 'Noida Medical Transport',
            vehicleNumber: 'UP-16-CD-5678',
            driverName: 'Suresh Singh'
          },
          responseTime: 12, // minutes
          totalTime: 45, // minutes
          cost: 1200, // INR
          rating: 4
        }
      ];

      return {
        count: ambulanceAssists.length,
        ambulanceAssists,
        summary: {
          totalRequests: ambulanceAssists.length,
          completedRequests: ambulanceAssists.filter(a => a.status === 'completed').length,
          averageResponseTime: ambulanceAssists.reduce((sum, a) => sum + a.responseTime, 0) / ambulanceAssists.length,
          totalCost: ambulanceAssists.reduce((sum, a) => sum + a.cost, 0),
          averageRating: ambulanceAssists.reduce((sum, a) => sum + a.rating, 0) / ambulanceAssists.length
        }
      };
    } catch (error) {
      throw error;
    }
  }
}
