/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable no-useless-catch */

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Add_Content,
  AdminLoginDto,
  GetContent,
  Listing,
  ListingDto,
  DashboardMetricsDto,
  SystemMonitoringDto,
  EmergencyBroadcastDto,
  ContentVersionDto,
  MultiLanguageContentDto,
} from './dto/create-admin.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { FilterQuery, Model, Types } from 'mongoose';
import { Session, SessionDocument } from '../user/entities/session.entity';
import {
  Notification,
  NotificationDocument,
} from '../entities/notification.entity';
import { CommonService } from '../common/common.service';
import { ConfigService } from '@nestjs/config';
import { Update, UserType, DriverApproval, RideStatus } from '../common/utils';
import {
  DriverRide,
  DriverRideDocument,
} from '../driver/entities/driver-ride.entity';
import { Approval } from './dto/driver.dto';
import { Content, ContentDocument } from './entities/content.entity';
import {
  ContentVersion,
  ContentVersionDocument,
} from './entities/content-version.entity';
import {
  MultiLanguageContent,
  MultiLanguageContentDocument,
} from './entities/multi-language-content.entity';
import {
  SystemMetrics,
  SystemMetricsDocument,
} from './entities/system-metrics.entity';
import {
  EmergencyBroadcast,
  EmergencyBroadcastDocument,
} from './entities/emergency-broadcast.entity';
import { Ride, RideDocument } from '../ride/entities/ride.entity';

@Injectable()
export class AdminService {
  private option = { lean: true } as const;
  private updateOption = { new: true } as const;
  private readonly ADMIN_EMAIL: string;
  private readonly PASSWORD: string;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
    @InjectModel(Content.name) private contentModel: Model<ContentDocument>,
    @InjectModel(ContentVersion.name)
    private contentVersionModel: Model<ContentVersionDocument>,
    @InjectModel(MultiLanguageContent.name)
    private multiLanguageContentModel: Model<MultiLanguageContentDocument>,
    @InjectModel(SystemMetrics.name)
    private systemMetricsModel: Model<SystemMetricsDocument>,
    @InjectModel(EmergencyBroadcast.name)
    private emergencyBroadcastModel: Model<EmergencyBroadcastDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,

    private commonServices: CommonService,
    private readonly configService: ConfigService,
  ) {
    // this.ADMIN_EMAIL = this.configService.get<string>("ADMIN_EMAIL")!
    // this.PASSWORD = this.configService.get<string>("PASSWORD")!

    this.create_admin();
  }

  async create_admin() {
    const query = { email: 'admin@gmail.com' };
    const is_admin = await this.userModel.findOne(query, {}, { lean: true });
    if (!is_admin) {
      const hashPassword =
        await this.commonServices.hashPassword('Asdfghjkl@1');
      const data = {
        email: 'admin@gmail.com',
        password: hashPassword,
        role: UserType.ADMIN,
        createdAt: Date.now(),
      };
      await this.userModel.create(data);
    }
  }

  createSession = async (user_id: string | Types.ObjectId, role: string) => {
    await this.sessionModel.deleteMany({ user_id });
    return await this.sessionModel.create({ user_id, role });
  };

  async login(dto: AdminLoginDto) {
    try {
      const { email, password } = dto;
      const query = { email: email.toLowerCase() };
      const is_admin = await this.userModel.findOne(query, {}, this.option);
      if (!is_admin) throw new BadRequestException('User not found');
      const is_password = await this.commonServices.compareHash(
        password,
        is_admin.password,
      );
      if (!is_password) throw new BadRequestException('Incorrect password');
      const session = await this.createSession(is_admin._id, is_admin.role);
      const access_token = await this.commonServices.generateToken(
        is_admin._id,
        session._id,
        is_admin.email,
        is_admin.role,
      );
      const data = { message: 'Login SuccesFully', access_token };
      return data;
    } catch (error) {
      throw error;
    }
  }

  async userList(dto: Listing) {
    try {
      const { pagination, limit, search } = dto;
      const options = await this.commonServices.setOptions(pagination, limit);
      const query: FilterQuery<UserDocument> = { role: UserType.USER };
      const count = await this.userModel.countDocuments(query);
      const projection = { password: 0, role: 0 };
      if (search) {
        query.$or = [
          { first_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone_number: { $regex: search, $options: 'i' } },
        ];
      }
      const users = await this.userModel.find(query, projection, options);
      const result = { count, data: users };
      return result;
    } catch (error) {
      throw error;
    }
  }

  async user_detail(id: string) {
    try {
      const query = { _id: new Types.ObjectId(id) };
      const projection = { password: 0, otp: 0, otp_expire_at: 0 };
      const user = await this.userModel.findById(
        query,
        projection,
        this.option,
      );
      return { data: user };
    } catch (error) {
      throw error;
    }
  }

  async driver_approval(driver_id: string, dto: Approval) {
    try {
      const { approval, rejection_reason } = dto;
      const query = { _id: new Types.ObjectId(driver_id) };
      const update: Update = {
        approval,
        updated_at: Date.now(),
      };

      if (approval === DriverApproval.APPROVED) {
        update.approved_at = new Date();
        update.rejection_reason = null; // Clear any previous rejection reason
      } else if (approval === DriverApproval.REJECTED && rejection_reason) {
        update.rejection_reason = rejection_reason;
        update.approved_at = null;
      }

      const driver = await this.userModel.findOneAndUpdate(
        query,
        update,
        this.updateOption,
      );
      if (!driver) {
        throw new BadRequestException('Driver not found');
      }

      // TODO: Send notification to driver about approval/rejection
      // await this.notificationService.sendDriverApprovalNotification(driver, approval, rejection_reason);

      return {
        message: `Driver ${approval.toLowerCase()} successfully.`,
        driver: {
          _id: driver._id,
          name: `${driver.first_name} ${driver.last_name}`,
          email: driver.email,
          approval: driver.approval,
          approved_at: driver.approved_at,
          rejection_reason: driver.rejection_reason,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getDriverDetails(driver_id: string) {
    try {
      const query = {
        _id: new Types.ObjectId(driver_id),
        role: UserType.DRIVER,
      };
      const projection = { password: 0, otp: 0, otp_expire_at: 0 };

      const driver = await this.userModel.findOne(
        query,
        projection,
        this.option,
      );
      if (!driver) {
        throw new BadRequestException('Driver not found');
      }

      // Get driver's ride statistics
      const rideStats = await this.getDriverRideStats(driver_id);

      return {
        data: {
          ...driver,
          ride_statistics: rideStats,
          documents_status: this.getDriverDocumentsStatus(driver),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getPendingDriverApprovals(dto: Listing) {
    try {
      const { pagination, limit, search } = dto;
      const options = await this.commonServices.setOptions(pagination, limit);
      const query: FilterQuery<UserDocument> = {
        role: UserType.DRIVER,
        approval: DriverApproval.PENDING,
      };

      const count = await this.userModel.countDocuments(query);
      const projection = { password: 0, role: 0, otp: 0, otp_expire_at: 0 };

      if (search) {
        query.$or = [
          { first_name: { $regex: search, $options: 'i' } },
          { last_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone_number: { $regex: search, $options: 'i' } },
        ];
      }

      const drivers = await this.userModel.find(query, projection, options);

      // Add documents status for each driver
      const driversWithStatus = drivers.map((driver) => ({
        ...driver,
        documents_status: this.getDriverDocumentsStatus(driver),
      }));

      const result = { count, data: driversWithStatus };
      return result;
    } catch (error) {
      throw error;
    }
  }

  private async getDriverRideStats(driver_id: string) {
    try {
      const query = { driver_id: new Types.ObjectId(driver_id) };

      const totalRides = await this.driverRideModel.countDocuments(query);
      const completedRides = await this.driverRideModel.countDocuments({
        ...query,
        status: RideStatus.COMPLETED,
      });

      // Calculate basic statistics
      const completionRate =
        totalRides > 0 ? (completedRides / totalRides) * 100 : 0;

      return {
        total_rides: totalRides,
        completed_rides: completedRides,
        completion_rate: Math.round(completionRate * 100) / 100,
        // TODO: Add more statistics like average rating, earnings, etc.
      };
    } catch (error) {
      console.error('Error getting driver ride stats:', error);
      return {
        total_rides: 0,
        completed_rides: 0,
        completion_rate: 0,
      };
    }
  }

  private getDriverDocumentsStatus(driver: any) {
    const requiredDocs = ['aadhar_front', 'aadhar_back', 'dl_front', 'dl_back'];
    const uploadedDocs = requiredDocs.filter((doc) => driver[doc]);

    return {
      total_required: requiredDocs.length,
      uploaded: uploadedDocs.length,
      missing: requiredDocs.filter((doc) => !driver[doc]),
      is_complete: uploadedDocs.length === requiredDocs.length,
      documents_uploaded_at: driver.documents_uploaded_at,
    };
  }
  async driverList(dto: Listing) {
    try {
      const { pagination, limit, search } = dto;
      const options = await this.commonServices.setOptions(pagination, limit);
      const query: FilterQuery<UserDocument> = { role: UserType.DRIVER };
      const count = await this.userModel.countDocuments(query);
      const projection = { password: 0, role: 0 };
      if (search) {
        query.$or = [
          { first_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone_number: { $regex: search, $options: 'i' } },
        ];
      }
      const drivers = await this.userModel.find(query, projection, options);
      const result = { count, data: drivers };
      return result;
    } catch (error) {
      throw error;
    }
  }

  async driver_ride_list(driver_id: string, dto: ListingDto) {
    try {
      const { pagination, limit } = dto;
      const options = await this.commonServices.setOptions(pagination, limit);
      const query: FilterQuery<DriverRideDocument> = {
        driver_id: new Types.ObjectId(driver_id),
      };
      const count = await this.driverRideModel.countDocuments(query);
      const projection = {};
      const rides = await this.driverRideModel.find(query, projection, options);
      const result = { count, data: rides };
      return result;
    } catch (error) {
      throw error;
    }
  }

  async addContent(body: Add_Content) {
    try {
      const { type, image, title, content, description, page_url } = body;
      const data_to_save: Update = {};
      if (type) data_to_save.type = type;
      if (image) data_to_save.image = image;
      if (title) data_to_save.title = title;
      if (content) data_to_save.content = content;
      if (description) data_to_save.description = description;
      if (page_url) data_to_save.page_url = page_url;

      const query = { type };
      const getContent = await this.contentModel.findOne(
        query,
        {},
        this.option,
      );
      let savedContent;

      if (getContent) {
        // Create version before updating
        await this.createContentVersion(
          getContent,
          'Content updated via admin panel',
        );

        // Update existing content
        data_to_save.updated_at = new Date();
        savedContent = await this.contentModel.findByIdAndUpdate(
          { _id: getContent._id },
          data_to_save,
          this.updateOption,
        );
      } else {
        // Create new content
        data_to_save.created_at = new Date();
        savedContent = await this.contentModel.create(data_to_save);

        // Create initial version
        await this.createContentVersion(
          savedContent,
          'Initial content creation',
        );
      }

      return {
        data: savedContent,
        message: getContent
          ? 'Content updated successfully'
          : 'Content created successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async content(dto: GetContent) {
    try {
      const { type } = dto;
      let query = {};
      if (type) query = { type };
// console.log removed
// console.log removed
      const content = await this.contentModel.find(query, {}, this.option);
      return { data: content };
    } catch (error) {
      throw error;
    }
  }

  // Enhanced Dashboard Metrics
  async getDashboardMetrics(dto: DashboardMetricsDto) {
    try {
      const { timeframe = 'today' } = dto;
      const timeFilter = this.getTimeFilter(timeframe);

      // Get real-time metrics
      const [
        totalUsers,
        totalDrivers,
        activeUsers,
        activeDrivers,
        totalRides,
        activeRides,
        completedRides,
        emergencyRides,
        pendingDriverApprovals,
        systemHealth,
      ] = await Promise.all([
        this.userModel.countDocuments({
          role: UserType.USER,
          is_deleted: false,
        }),
        this.userModel.countDocuments({
          role: UserType.DRIVER,
          is_deleted: false,
        }),
        this.userModel.countDocuments({ role: UserType.USER, is_online: true }),
        this.userModel.countDocuments({
          role: UserType.DRIVER,
          is_online: true,
        }),
        this.rideModel.countDocuments(timeFilter),
        this.rideModel.countDocuments({
          status: {
            $in: [
              RideStatus.REQUESTED,
              RideStatus.DRIVER_ASSIGNED,
              RideStatus.DRIVER_ARRIVING,
              RideStatus.IN_PROGRESS,
            ],
          },
        }),
        this.rideModel.countDocuments({
          ...timeFilter,
          status: RideStatus.COMPLETED,
        }),
        this.rideModel.countDocuments({
          ...timeFilter,
          vehicle_type: 'EMERGENCY',
        }),
        this.userModel.countDocuments({
          role: UserType.DRIVER,
          approval: DriverApproval.PENDING,
        }),
        this.getSystemHealthMetrics(),
      ]);

      // Calculate ride completion rate
      const rideCompletionRate =
        totalRides > 0 ? (completedRides / totalRides) * 100 : 0;

      // Get revenue metrics (if available)
      const revenueMetrics = await this.getRevenueMetrics(timeFilter);

      // Get hourly ride distribution for charts
      const hourlyRideData = await this.getHourlyRideDistribution(timeFilter);

      return {
        overview: {
          total_users: totalUsers,
          total_drivers: totalDrivers,
          active_users: activeUsers,
          active_drivers: activeDrivers,
          total_rides: totalRides,
          active_rides: activeRides,
          completed_rides: completedRides,
          emergency_rides: emergencyRides,
          pending_approvals: pendingDriverApprovals,
          ride_completion_rate: Math.round(rideCompletionRate * 100) / 100,
        },
        revenue: revenueMetrics,
        system_health: systemHealth,
        charts: {
          hourly_rides: hourlyRideData,
          ride_status_distribution:
            await this.getRideStatusDistribution(timeFilter),
          user_growth: await this.getUserGrowthData(timeframe),
          driver_performance:
            await this.getDriverPerformanceMetrics(timeFilter),
        },
        timeframe,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async getSystemMonitoring(dto: SystemMonitoringDto) {
    try {
      const { metric_type = 'all' } = dto;

      const query: any = {};
      if (metric_type !== 'all') {
        query.metric_type = metric_type;
      }

      // Get recent metrics (last 24 hours)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.timestamp = { $gte: last24Hours };

      const metrics = await this.systemMetricsModel.find(
        query,
        {},
        {
          ...this.option,
          sort: { timestamp: -1 },
          limit: 1000,
        },
      );

      // Group metrics by type
      const groupedMetrics = metrics.reduce((acc, metric) => {
        if (!acc[metric.metric_type]) {
          acc[metric.metric_type] = [];
        }
        acc[metric.metric_type].push(metric);
        return acc;
      }, {});

      // Calculate averages and trends
      const summary = {};
      for (const [type, typeMetrics] of Object.entries(groupedMetrics)) {
        summary[type] = this.calculateMetricsSummary(typeMetrics as any[]);
      }

      return {
        summary,
        detailed_metrics: groupedMetrics,
        monitoring_period: '24_hours',
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async getAnalytics(dto: DashboardMetricsDto) {
    try {
      const { timeframe = 'month' } = dto;
      const timeFilter = this.getTimeFilter(timeframe);

      // Get comprehensive analytics
      const [
        userBehavior,
        ridePatterns,
        driverAnalytics,
        geographicData,
        emergencyAnalytics,
      ] = await Promise.all([
        this.getUserBehaviorAnalytics(timeFilter),
        this.getRidePatternAnalytics(timeFilter),
        this.getDriverAnalytics(timeFilter),
        this.getGeographicAnalytics(timeFilter),
        this.getEmergencyAnalytics(timeFilter),
      ]);

      return {
        user_behavior: userBehavior,
        ride_patterns: ridePatterns,
        driver_analytics: driverAnalytics,
        geographic_data: geographicData,
        emergency_analytics: emergencyAnalytics,
        timeframe,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async getRideAnalytics(dto: DashboardMetricsDto) {
    try {
      const { timeframe = 'month' } = dto;
      const timeFilter = this.getTimeFilter(timeframe);

      // Detailed ride analytics
      const [
        rideVolume,
        averageRideMetrics,
        peakHours,
        cancellationAnalysis,
        fareAnalysis,
        durationAnalysis,
      ] = await Promise.all([
        this.getRideVolumeAnalytics(timeFilter),
        this.getAverageRideMetrics(timeFilter),
        this.getPeakHoursAnalysis(timeFilter),
        this.getCancellationAnalysis(timeFilter),
        this.getFareAnalysis(timeFilter),
        this.getRideDurationAnalysis(timeFilter),
      ]);

      return {
        volume: rideVolume,
        averages: averageRideMetrics,
        peak_hours: peakHours,
        cancellations: cancellationAnalysis,
        fare_analysis: fareAnalysis,
        duration_analysis: durationAnalysis,
        timeframe,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  // Content Management with Versioning
  async getContentVersions(contentId: string) {
    try {
      const query = { content_id: new Types.ObjectId(contentId) };
      const versions = await this.contentVersionModel.find(
        query,
        {},
        {
          ...this.option,
          sort: { created_at: -1 },
        },
      );

      const content = await this.contentModel.findById(
        contentId,
        {},
        this.option,
      );
      if (!content) {
        throw new BadRequestException('Content not found');
      }

      return {
        content,
        versions,
        total_versions: versions.length,
      };
    } catch (error) {
      throw error;
    }
  }

  async restoreContentVersion(dto: ContentVersionDto) {
    try {
      const { content_id, version } = dto;

      const contentVersion = await this.contentVersionModel.findOne(
        {
          content_id: new Types.ObjectId(content_id),
          version,
        },
        {},
        this.option,
      );

      if (!contentVersion) {
        throw new BadRequestException('Content version not found');
      }

      // Create new version from current content before restoring
      const currentContent = await this.contentModel.findById(
        content_id,
        {},
        this.option,
      );
      if (currentContent) {
        await this.createContentVersion(
          currentContent,
          'auto-backup-before-restore',
        );
      }

      // Restore the version
      const updateData = {
        title: contentVersion.title,
        description: contentVersion.description,
        content: contentVersion.content,
        page_url: contentVersion.page_url,
        image: contentVersion.image,
        updated_at: new Date(),
      };

      const restoredContent = await this.contentModel.findByIdAndUpdate(
        content_id,
        updateData,
        this.updateOption,
      );

      return {
        message: 'Content version restored successfully',
        restored_version: version,
        content: restoredContent,
      };
    } catch (error) {
      throw error;
    }
  }

  // Multi-language Content Support
  async addMultiLanguageContent(dto: MultiLanguageContentDto) {
    try {
      const { type, language_code, title, content, description } = dto;

      // Find the base content
      const baseContent = await this.contentModel.findOne(
        { type },
        {},
        this.option,
      );
      if (!baseContent) {
        throw new BadRequestException('Base content not found for this type');
      }

      // Check if translation already exists
      const existingTranslation = await this.multiLanguageContentModel.findOne(
        {
          content_id: baseContent._id,
          language_code,
        },
        {},
        this.option,
      );

      let translation;
      if (existingTranslation) {
        // Update existing translation
        translation = await this.multiLanguageContentModel.findByIdAndUpdate(
          existingTranslation._id,
          {
            title,
            content,
            description,
            updated_at: new Date(),
          },
          this.updateOption,
        );
      } else {
        // Create new translation
        translation = await this.multiLanguageContentModel.create({
          content_id: baseContent._id,
          type,
          language_code,
          title,
          content,
          description,
        });
      }

      return {
        message: 'Multi-language content saved successfully',
        translation,
      };
    } catch (error) {
      throw error;
    }
  }

  async getContentByLanguage(languageCode: string, dto: GetContent) {
    try {
      const { type } = dto;

      const query: any = { language_code: languageCode, is_active: true };
      if (type) {
        query.type = type;
      }

      const translations = await this.multiLanguageContentModel.find(
        query,
        {},
        this.option,
      );

      // If no translations found, return default content
      if (translations.length === 0) {
        const defaultQuery = type ? { type } : {};
        const defaultContent = await this.contentModel.find(
          defaultQuery,
          {},
          this.option,
        );
        return {
          data: defaultContent,
          language: 'default',
          message: 'No translations found, returning default content',
        };
      }

      return {
        data: translations,
        language: languageCode,
        total: translations.length,
      };
    } catch (error) {
      throw error;
    }
  }

  // Emergency Broadcast System
  async sendEmergencyBroadcast(dto: EmergencyBroadcastDto) {
    try {
      const {
        title,
        message,
        priority = 'medium',
        user_type = 'all',
        target_area,
      } = dto;

      // Create broadcast record
      const broadcast = await this.emergencyBroadcastModel.create({
        title,
        message,
        priority,
        target_audience: user_type,
        target_area,
        created_by: 'admin', // TODO: Get from JWT token
        status: 'draft',
      });

      // Get target users
      const targetUsers = await this.getTargetUsersForBroadcast(
        user_type,
        target_area,
      );

      // Send notifications to target users
      const deliveryResults = await this.deliverEmergencyBroadcast(
        broadcast,
        targetUsers,
      );

      // Update broadcast with delivery statistics
      await this.emergencyBroadcastModel.findByIdAndUpdate(broadcast._id, {
        recipients_count: targetUsers.length,
        delivered_count: deliveryResults.delivered,
        failed_count: deliveryResults.failed,
        status: deliveryResults.failed === 0 ? 'sent' : 'failed',
        sent_at: new Date(),
      });

      return {
        message: 'Emergency broadcast sent successfully',
        broadcast_id: broadcast._id,
        recipients: targetUsers.length,
        delivered: deliveryResults.delivered,
        failed: deliveryResults.failed,
      };
    } catch (error) {
      throw error;
    }
  }

  async getEmergencyBroadcasts(dto: Listing) {
    try {
      const { pagination, limit, search } = dto;
      const options = await this.commonServices.setOptions(pagination, limit);

      const query: any = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
        ];
      }

      const count = await this.emergencyBroadcastModel.countDocuments(query);
      const broadcasts = await this.emergencyBroadcastModel.find(
        query,
        {},
        {
          ...options,
          sort: { created_at: -1 },
        },
      );

      return {
        count,
        data: broadcasts,
      };
    } catch (error) {
      throw error;
    }
  }

  async getEmergencyBroadcastDetails(broadcastId: string) {
    try {
      const broadcast = await this.emergencyBroadcastModel.findById(
        broadcastId,
        {},
        this.option,
      );
      if (!broadcast) {
        throw new BadRequestException('Emergency broadcast not found');
      }

      // Get delivery statistics and details
      const deliveryStats = {
        total_recipients: broadcast.recipients_count,
        delivered: broadcast.delivered_count,
        failed: broadcast.failed_count,
        delivery_rate:
          broadcast.recipients_count > 0
            ? (broadcast.delivered_count / broadcast.recipients_count) * 100
            : 0,
      };

      return {
        broadcast,
        delivery_statistics: deliveryStats,
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper Methods for Analytics and Metrics

  private getTimeFilter(timeframe: string) {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { created_at: { $gte: startDate } };
  }

  private async getSystemHealthMetrics() {
    try {
      // Get recent system metrics
      const recentMetrics = await this.systemMetricsModel.find(
        {
          timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
        {},
        this.option,
      );

      // Calculate health scores
      const healthMetrics = {
        overall_health: 'good', // 'excellent', 'good', 'warning', 'critical'
        response_time: this.calculateAverageMetric(
          recentMetrics,
          'response_time',
        ),
        error_rate: this.calculateAverageMetric(recentMetrics, 'error_rate'),
        active_connections: this.getLatestMetric(
          recentMetrics,
          'active_connections',
        ),
        database_health: 'good',
        websocket_health: 'good',
      };

      return healthMetrics;
    } catch (error) {
      return {
        overall_health: 'unknown',
        response_time: 0,
        error_rate: 0,
        active_connections: 0,
        database_health: 'unknown',
        websocket_health: 'unknown',
      };
    }
  }

  private async getRevenueMetrics(timeFilter: any) {
    try {
      const revenueData = await this.rideModel.aggregate([
        {
          $match: {
            ...timeFilter,
            status: RideStatus.COMPLETED,
            final_fare: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            total_revenue: { $sum: '$final_fare' },
            average_fare: { $avg: '$final_fare' },
            total_rides: { $sum: 1 },
          },
        },
      ]);

      return (
        revenueData[0] || {
          total_revenue: 0,
          average_fare: 0,
          total_rides: 0,
        }
      );
    } catch (error) {
      return {
        total_revenue: 0,
        average_fare: 0,
        total_rides: 0,
      };
    }
  }

  private async getHourlyRideDistribution(timeFilter: any) {
    try {
      const hourlyData = await this.rideModel.aggregate([
        { $match: timeFilter },
        {
          $group: {
            _id: { $hour: '$created_at' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Fill in missing hours with 0
      const result = Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyData.find((item) => item._id === hour);
        return {
          hour,
          rides: data ? data.count : 0,
        };
      });

      return result;
    } catch (error) {
      return [];
    }
  }

  private async getRideStatusDistribution(timeFilter: any) {
    try {
      const statusData = await this.rideModel.aggregate([
        { $match: timeFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      return statusData.map((item) => ({
        status: item._id,
        count: item.count,
      }));
    } catch (error) {
      return [];
    }
  }

  private async getUserGrowthData(timeframe: string) {
    try {
      const groupBy =
        timeframe === 'year'
          ? { year: { $year: '$created_at' }, month: { $month: '$created_at' } }
          : { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } };

      const growthData = await this.userModel.aggregate([
        { $match: { is_deleted: false } },
        {
          $group: {
            _id: groupBy,
            users: {
              $sum: { $cond: [{ $eq: ['$role', UserType.USER] }, 1, 0] },
            },
            drivers: {
              $sum: { $cond: [{ $eq: ['$role', UserType.DRIVER] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return growthData;
    } catch (error) {
      return [];
    }
  }

  private async getDriverPerformanceMetrics(timeFilter: any) {
    try {
      const performanceData = await this.userModel.aggregate([
        {
          $match: { role: UserType.DRIVER, approval: DriverApproval.APPROVED },
        },
        {
          $group: {
            _id: null,
            average_rating: { $avg: '$driver_rating' },
            total_drivers: { $sum: 1 },
            active_drivers: { $sum: { $cond: ['$is_online', 1, 0] } },
          },
        },
      ]);

      return (
        performanceData[0] || {
          average_rating: 0,
          total_drivers: 0,
          active_drivers: 0,
        }
      );
    } catch (error) {
      return {
        average_rating: 0,
        total_drivers: 0,
        active_drivers: 0,
      };
    }
  }

  private calculateMetricsSummary(metrics: any[]) {
    if (metrics.length === 0) return {};

    const summary = {};
    const metricsByName = metrics.reduce((acc, metric) => {
      if (!acc[metric.metric_name]) {
        acc[metric.metric_name] = [];
      }
      acc[metric.metric_name].push(metric.value);
      return acc;
    }, {});

    for (const [name, values] of Object.entries(metricsByName)) {
      const numValues = values as number[];
      summary[name] = {
        current: numValues[0], // Most recent
        average: numValues.reduce((a, b) => a + b, 0) / numValues.length,
        min: Math.min(...numValues),
        max: Math.max(...numValues),
        trend: this.calculateTrend(numValues),
      };
    }

    return summary;
  }

  private calculateAverageMetric(metrics: any[], metricName: string): number {
    const relevantMetrics = metrics.filter((m) => m.metric_name === metricName);
    if (relevantMetrics.length === 0) return 0;

    const sum = relevantMetrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / relevantMetrics.length;
  }

  private getLatestMetric(metrics: any[], metricName: string): number {
    const relevantMetrics = metrics.filter((m) => m.metric_name === metricName);
    if (relevantMetrics.length === 0) return 0;

    // Metrics are sorted by timestamp desc, so first is latest
    return relevantMetrics[0].value;
  }

  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(0, Math.ceil(values.length / 2));
    const older = values.slice(Math.ceil(values.length / 2));

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const threshold = 0.05; // 5% threshold
    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > threshold) return 'up';
    if (change < -threshold) return 'down';
    return 'stable';
  }

  // Analytics Helper Methods
  private async getUserBehaviorAnalytics(timeFilter: any) {
    try {
      const behaviorData = await this.userModel.aggregate([
        { $match: { ...timeFilter, role: UserType.USER } },
        {
          $group: {
            _id: null,
            total_users: { $sum: 1 },
            verified_users: { $sum: { $cond: ['$is_email_verified', 1, 0] } },
            active_users: { $sum: { $cond: ['$is_online', 1, 0] } },
          },
        },
      ]);

      return (
        behaviorData[0] || {
          total_users: 0,
          verified_users: 0,
          active_users: 0,
        }
      );
    } catch (error) {
      return {
        total_users: 0,
        verified_users: 0,
        active_users: 0,
      };
    }
  }

  private async getRidePatternAnalytics(timeFilter: any) {
    try {
      const patternData = await this.rideModel.aggregate([
        { $match: timeFilter },
        {
          $group: {
            _id: null,
            total_rides: { $sum: 1 },
            emergency_rides: {
              $sum: { $cond: [{ $eq: ['$vehicle_type', 'EMERGENCY'] }, 1, 0] },
            },
            completed_rides: {
              $sum: {
                $cond: [{ $eq: ['$status', RideStatus.COMPLETED] }, 1, 0],
              },
            },
            cancelled_rides: {
              $sum: {
                $cond: [{ $eq: ['$status', RideStatus.CANCELLED] }, 1, 0],
              },
            },
            average_distance: { $avg: '$distance_km' },
            average_duration: { $avg: '$duration_minutes' },
          },
        },
      ]);

      return (
        patternData[0] || {
          total_rides: 0,
          emergency_rides: 0,
          completed_rides: 0,
          cancelled_rides: 0,
          average_distance: 0,
          average_duration: 0,
        }
      );
    } catch (error) {
      return {
        total_rides: 0,
        emergency_rides: 0,
        completed_rides: 0,
        cancelled_rides: 0,
        average_distance: 0,
        average_duration: 0,
      };
    }
  }

  private async getDriverAnalytics(timeFilter: any) {
    try {
      const driverData = await this.userModel.aggregate([
        { $match: { role: UserType.DRIVER } },
        {
          $group: {
            _id: null,
            total_drivers: { $sum: 1 },
            approved_drivers: {
              $sum: {
                $cond: [{ $eq: ['$approval', DriverApproval.APPROVED] }, 1, 0],
              },
            },
            pending_drivers: {
              $sum: {
                $cond: [{ $eq: ['$approval', DriverApproval.PENDING] }, 1, 0],
              },
            },
            active_drivers: { $sum: { $cond: ['$is_online', 1, 0] } },
            average_rating: { $avg: '$driver_rating' },
          },
        },
      ]);

      return (
        driverData[0] || {
          total_drivers: 0,
          approved_drivers: 0,
          pending_drivers: 0,
          active_drivers: 0,
          average_rating: 0,
        }
      );
    } catch (error) {
      return {
        total_drivers: 0,
        approved_drivers: 0,
        pending_drivers: 0,
        active_drivers: 0,
        average_rating: 0,
      };
    }
  }

  private async getGeographicAnalytics(timeFilter: any) {
    try {
      // This would require more complex geospatial analysis
      // For now, return basic location-based metrics
      const geoData = await this.rideModel.aggregate([
        { $match: timeFilter },
        {
          $group: {
            _id: null,
            total_rides: { $sum: 1 },
            // Add more geographic analysis as needed
          },
        },
      ]);

      return {
        total_rides: geoData[0]?.total_rides || 0,
        // Add more geographic metrics
        popular_areas: [],
        coverage_zones: [],
      };
    } catch (error) {
      return {
        total_rides: 0,
        popular_areas: [],
        coverage_zones: [],
      };
    }
  }

  private async getEmergencyAnalytics(timeFilter: any) {
    try {
      const emergencyData = await this.rideModel.aggregate([
        { $match: { ...timeFilter, vehicle_type: 'EMERGENCY' } },
        {
          $group: {
            _id: null,
            total_emergency_rides: { $sum: 1 },
            completed_emergency_rides: {
              $sum: {
                $cond: [{ $eq: ['$status', RideStatus.COMPLETED] }, 1, 0],
              },
            },
            average_response_time: {
              $avg: { $subtract: ['$driver_assigned_at', '$requested_at'] },
            },
          },
        },
      ]);

      return (
        emergencyData[0] || {
          total_emergency_rides: 0,
          completed_emergency_rides: 0,
          average_response_time: 0,
        }
      );
    } catch (error) {
      return {
        total_emergency_rides: 0,
        completed_emergency_rides: 0,
        average_response_time: 0,
      };
    }
  }

  // Additional analytics methods
  private async getRideVolumeAnalytics(timeFilter: any) {
    try {
      const volumeData = await this.rideModel.aggregate([
        { $match: timeFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return volumeData;
    } catch (error) {
      return [];
    }
  }

  private async getAverageRideMetrics(timeFilter: any) {
    try {
      const avgData = await this.rideModel.aggregate([
        { $match: { ...timeFilter, status: RideStatus.COMPLETED } },
        {
          $group: {
            _id: null,
            average_fare: { $avg: '$final_fare' },
            average_distance: { $avg: '$distance_km' },
            average_duration: { $avg: '$duration_minutes' },
          },
        },
      ]);

      return (
        avgData[0] || {
          average_fare: 0,
          average_distance: 0,
          average_duration: 0,
        }
      );
    } catch (error) {
      return {
        average_fare: 0,
        average_distance: 0,
        average_duration: 0,
      };
    }
  }

  private async getPeakHoursAnalysis(timeFilter: any) {
    try {
      const peakData = await this.rideModel.aggregate([
        { $match: timeFilter },
        {
          $group: {
            _id: { $hour: '$created_at' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      return peakData.map((item) => ({
        hour: item._id,
        rides: item.count,
      }));
    } catch (error) {
      return [];
    }
  }

  private async getCancellationAnalysis(timeFilter: any) {
    try {
      const cancellationData = await this.rideModel.aggregate([
        { $match: { ...timeFilter, status: RideStatus.CANCELLED } },
        {
          $group: {
            _id: null,
            total_cancelled: { $sum: 1 },
            // Add more cancellation analysis
          },
        },
      ]);

      const totalRides = await this.rideModel.countDocuments(timeFilter);
      const cancelled = cancellationData[0]?.total_cancelled || 0;
      const cancellationRate =
        totalRides > 0 ? (cancelled / totalRides) * 100 : 0;

      return {
        total_cancelled: cancelled,
        cancellation_rate: Math.round(cancellationRate * 100) / 100,
        total_rides: totalRides,
      };
    } catch (error) {
      return {
        total_cancelled: 0,
        cancellation_rate: 0,
        total_rides: 0,
      };
    }
  }

  private async getFareAnalysis(timeFilter: any) {
    try {
      const fareData = await this.rideModel.aggregate([
        {
          $match: {
            ...timeFilter,
            status: RideStatus.COMPLETED,
            final_fare: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            min_fare: { $min: '$final_fare' },
            max_fare: { $max: '$final_fare' },
            average_fare: { $avg: '$final_fare' },
            total_revenue: { $sum: '$final_fare' },
          },
        },
      ]);

      return (
        fareData[0] || {
          min_fare: 0,
          max_fare: 0,
          average_fare: 0,
          total_revenue: 0,
        }
      );
    } catch (error) {
      return {
        min_fare: 0,
        max_fare: 0,
        average_fare: 0,
        total_revenue: 0,
      };
    }
  }

  private async getRideDurationAnalysis(timeFilter: any) {
    try {
      const durationData = await this.rideModel.aggregate([
        {
          $match: {
            ...timeFilter,
            status: RideStatus.COMPLETED,
            duration_minutes: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            min_duration: { $min: '$duration_minutes' },
            max_duration: { $max: '$duration_minutes' },
            average_duration: { $avg: '$duration_minutes' },
          },
        },
      ]);

      return (
        durationData[0] || {
          min_duration: 0,
          max_duration: 0,
          average_duration: 0,
        }
      );
    } catch (error) {
      return {
        min_duration: 0,
        max_duration: 0,
        average_duration: 0,
      };
    }
  }

  // Content versioning helper
  private async createContentVersion(content: any, changeNotes: string = '') {
    try {
      const latestVersion = await this.contentVersionModel.findOne(
        { content_id: content._id },
        {},
        { sort: { created_at: -1 }, lean: true },
      );

      const versionNumber = latestVersion
        ? this.incrementVersion(latestVersion.version)
        : '1.0.0';

      await this.contentVersionModel.create({
        content_id: content._id,
        version: versionNumber,
        type: content.type,
        title: content.title,
        description: content.description,
        content: content.content,
        page_url: content.page_url,
        image: content.image,
        created_by: 'admin', // TODO: Get from JWT token
        change_notes: changeNotes,
      });

      return versionNumber;
    } catch (error) {
      console.error('Error creating content version:', error);
      return null;
    }
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Increment patch version
    return parts.join('.');
  }

  // Emergency broadcast helpers
  private async getTargetUsersForBroadcast(
    targetAudience: string,
    targetArea?: string,
  ) {
    try {
      const query: any = { is_deleted: false };

      // Filter by user type
      if (targetAudience === 'users') {
        query.role = UserType.USER;
      } else if (targetAudience === 'drivers') {
        query.role = UserType.DRIVER;
        query.approval = DriverApproval.APPROVED;
      }
      // 'all' includes both users and drivers

      // TODO: Add geographic filtering based on targetArea
      // This would require geospatial queries based on user locations

      const users = await this.userModel.find(
        query,
        { _id: 1, role: 1 },
        this.option,
      );
      return users;
    } catch (error) {
      console.error('Error getting target users:', error);
      return [];
    }
  }

  private async deliverEmergencyBroadcast(broadcast: any, targetUsers: any[]) {
    try {
      let delivered = 0;
      const failed = 0;

      // Create notifications for all target users
      const notifications = targetUsers.map((user) => ({
        user_id: user._id,
        title: broadcast.title,
        message: broadcast.message,
        type: 'EMERGENCY_ALERT',
        data: {
          broadcast_id: broadcast._id,
          priority: broadcast.priority,
        },
      }));

      // Batch insert notifications
      if (notifications.length > 0) {
        await this.notificationModel.insertMany(notifications);
        delivered = notifications.length;
      }

      // TODO: Send push notifications via FCM/APNS
      // TODO: Send WebSocket notifications to online users

      return { delivered, failed };
    } catch (error) {
      console.error('Error delivering emergency broadcast:', error);
      return { delivered: 0, failed: targetUsers.length };
    }
  }

  // Additional Content Management Methods

  async deleteContent(contentId: string) {
    try {
      const content = await this.contentModel.findById(
        contentId,
        {},
        this.option,
      );
      if (!content) {
        throw new BadRequestException('Content not found');
      }

      // Create final version before deletion
      await this.createContentVersion(content, 'Content deleted');

      // Delete content and related data
      await Promise.all([
        this.contentModel.findByIdAndDelete(contentId),
        this.multiLanguageContentModel.deleteMany({
          content_id: new Types.ObjectId(contentId),
        }),
        // Keep versions for audit trail - don't delete them
      ]);

      return {
        message: 'Content deleted successfully',
        deleted_content: {
          id: contentId,
          type: content.type,
          title: content.title,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getSupportedLanguages() {
    try {
      // Get all unique language codes from multi-language content
      const languages =
        await this.multiLanguageContentModel.distinct('language_code');

      // Define language mappings
      const languageMap = {
        en: { name: 'English', native_name: 'English', is_default: true },
        hi: { name: 'Hindi', native_name: 'हिन्दी', is_default: false },
        es: { name: 'Spanish', native_name: 'Español', is_default: false },
        fr: { name: 'French', native_name: 'Français', is_default: false },
        de: { name: 'German', native_name: 'Deutsch', is_default: false },
        pt: { name: 'Portuguese', native_name: 'Português', is_default: false },
        ar: { name: 'Arabic', native_name: 'العربية', is_default: false },
        zh: { name: 'Chinese', native_name: '中文', is_default: false },
        ja: { name: 'Japanese', native_name: '日本語', is_default: false },
        ko: { name: 'Korean', native_name: '한국어', is_default: false },
      };

      const supportedLanguages = languages.map((code) => ({
        code,
        ...(languageMap[code] || {
          name: code.toUpperCase(),
          native_name: code.toUpperCase(),
          is_default: false,
        }),
      }));

      // Always include English as default if not present
      if (!languages.includes('en')) {
        supportedLanguages.unshift({
          code: 'en',
          ...languageMap['en'],
        });
      }

      return {
        languages: supportedLanguages,
        total: supportedLanguages.length,
        default_language: 'en',
      };
    } catch (error) {
      throw error;
    }
  }

  async getContentTranslationStatus() {
    try {
      // Get all content types
      const allContent = await this.contentModel.find(
        {},
        { type: 1, title: 1 },
        this.option,
      );

      // Get all translations
      const translations = await this.multiLanguageContentModel.find(
        {},
        {},
        this.option,
      );

      // Get unique languages
      const languages =
        await this.multiLanguageContentModel.distinct('language_code');

      // Build translation status matrix
      const translationStatus = allContent.map((content) => {
        const contentTranslations = translations.filter(
          (t) => t.content_id.toString() === content._id.toString(),
        );

        const languageStatus = {};
        languages.forEach((lang) => {
          const translation = contentTranslations.find(
            (t) => t.language_code === lang,
          );
          languageStatus[lang] = {
            exists: !!translation,
            is_active: translation?.is_active || false,
            last_updated: translation?.updated_at || null,
          };
        });

        return {
          content_id: content._id,
          content_type: content.type,
          content_title: content.title,
          translations: languageStatus,
          translation_count: contentTranslations.length,
          completion_rate:
            languages.length > 0
              ? (contentTranslations.length / languages.length) * 100
              : 0,
        };
      });

      // Calculate overall statistics
      const totalTranslations = translations.length;
      const totalPossibleTranslations = allContent.length * languages.length;
      const overallCompletionRate =
        totalPossibleTranslations > 0
          ? (totalTranslations / totalPossibleTranslations) * 100
          : 0;

      return {
        content_status: translationStatus,
        summary: {
          total_content_items: allContent.length,
          supported_languages: languages.length,
          total_translations: totalTranslations,
          possible_translations: totalPossibleTranslations,
          completion_rate: Math.round(overallCompletionRate * 100) / 100,
        },
        languages: languages,
      };
    } catch (error) {
      throw error;
    }
  }

  async bulkTranslateContent(dto: {
    language_code: string;
    content_ids: string[];
  }) {
    try {
      const { language_code, content_ids } = dto;

      if (!content_ids || content_ids.length === 0) {
        throw new BadRequestException('Content IDs are required');
      }

      const results: {
        success: Array<{
          content_id: string;
          translation_id: any;
          language_code: string;
        }>;
        failed: Array<{ content_id: string; reason: string }>;
        skipped: Array<{ content_id: string; reason: string }>;
      } = {
        success: [],
        failed: [],
        skipped: [],
      };

      for (const contentId of content_ids) {
        try {
          // Get base content
          const content = await this.contentModel.findById(
            contentId,
            {},
            this.option,
          );
          if (!content) {
            results.failed.push({
              content_id: contentId,
              reason: 'Content not found',
            });
            continue;
          }

          // Check if translation already exists
          const existingTranslation =
            await this.multiLanguageContentModel.findOne(
              {
                content_id: new Types.ObjectId(contentId),
                language_code,
              },
              {},
              this.option,
            );

          if (existingTranslation) {
            results.skipped.push({
              content_id: contentId,
              reason: 'Translation already exists',
            });
            continue;
          }

          // Create placeholder translation (in real implementation, this would call a translation service)
          const translation = await this.multiLanguageContentModel.create({
            content_id: content._id,
            type: content.type,
            language_code,
            title: `[${language_code.toUpperCase()}] ${content.title}`,
            description: content.description
              ? `[${language_code.toUpperCase()}] ${content.description}`
              : null,
            content: content.content
              ? `[${language_code.toUpperCase()}] ${content.content}`
              : null,
            translated_by: 'bulk-translate-system',
          });

          results.success.push({
            content_id: contentId,
            translation_id: translation._id,
            language_code,
          });
        } catch (error) {
          results.failed.push({
            content_id: contentId,
            reason:
              error instanceof Error ? error.message : 'Unknown error occurred',
          });
        }
      }

      return {
        message: 'Bulk translation completed',
        results,
        summary: {
          total_requested: content_ids.length,
          successful: results.success.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Enhanced content retrieval with language fallback
  async getContentWithLanguageFallback(
    type: string,
    languageCode: string = 'en',
  ) {
    try {
      // First try to get content in requested language
      const translation = await this.multiLanguageContentModel.findOne(
        {
          type,
          language_code: languageCode,
          is_active: true,
        },
        {},
        this.option,
      );

      if (translation) {
        return {
          data: translation,
          language: languageCode,
          is_translation: true,
        };
      }

      // Fallback to default language (English)
      if (languageCode !== 'en') {
        const englishTranslation = await this.multiLanguageContentModel.findOne(
          {
            type,
            language_code: 'en',
            is_active: true,
          },
          {},
          this.option,
        );

        if (englishTranslation) {
          return {
            data: englishTranslation,
            language: 'en',
            is_translation: true,
            fallback_used: true,
          };
        }
      }

      // Final fallback to base content
      const baseContent = await this.contentModel.findOne(
        { type },
        {},
        this.option,
      );
      if (baseContent) {
        return {
          data: baseContent,
          language: 'default',
          is_translation: false,
          fallback_used: true,
        };
      }

      throw new BadRequestException('Content not found');
    } catch (error) {
      throw error;
    }
  }

  // Content analytics
  async getContentAnalytics() {
    try {
      const [
        totalContent,
        totalTranslations,
        contentByType,
        translationsByLanguage,
        recentActivity,
      ] = await Promise.all([
        this.contentModel.countDocuments({}),
        this.multiLanguageContentModel.countDocuments({ is_active: true }),
        this.getContentByType(),
        this.getTranslationsByLanguage(),
        this.getRecentContentActivity(),
      ]);

      return {
        overview: {
          total_content: totalContent,
          total_translations: totalTranslations,
          content_types: contentByType.length,
          supported_languages: translationsByLanguage.length,
        },
        content_by_type: contentByType,
        translations_by_language: translationsByLanguage,
        recent_activity: recentActivity,
      };
    } catch (error) {
      throw error;
    }
  }

  private async getContentByType() {
    try {
      const contentByType = await this.contentModel.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            last_updated: { $max: '$updated_at' },
          },
        },
        { $sort: { count: -1 } },
      ]);

      return contentByType.map((item) => ({
        type: item._id,
        count: item.count,
        last_updated: item.last_updated,
      }));
    } catch (error) {
      return [];
    }
  }

  private async getTranslationsByLanguage() {
    try {
      const translationsByLanguage =
        await this.multiLanguageContentModel.aggregate([
          { $match: { is_active: true } },
          {
            $group: {
              _id: '$language_code',
              count: { $sum: 1 },
              last_updated: { $max: '$updated_at' },
            },
          },
          { $sort: { count: -1 } },
        ]);

      return translationsByLanguage.map((item) => ({
        language_code: item._id,
        count: item.count,
        last_updated: item.last_updated,
      }));
    } catch (error) {
      return [];
    }
  }

  private async getRecentContentActivity() {
    try {
      const recentContent = await this.contentModel.find(
        {},
        {},
        {
          sort: { updated_at: -1 },
          limit: 10,
          lean: true,
        },
      );

      const recentTranslations = await this.multiLanguageContentModel.find(
        {},
        {},
        {
          sort: { updated_at: -1 },
          limit: 10,
          lean: true,
        },
      );

      return {
        recent_content_updates: recentContent,
        recent_translations: recentTranslations,
      };
    } catch (error) {
      return {
        recent_content_updates: [],
        recent_translations: [],
      };
    }
  }
}
