/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommonService } from '../common/common.service';
import {
  EmergencyNotificationService,
  EmergencyNotificationData,
} from './emergency-notification.service';
import {
  CreateEmergencyRequestDto,
  UpdateEmergencyRequestDto,
  EmergencyRequestQueryDto,
  EmergencyContactQueryDto,
  AmbulanceAvailabilityUpdateDto,
} from './dto/emergency-service.dto';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../entities/emergency-request.entity';
import {
  EmergencyContact,
  EmergencyContactDocument,
} from '../entities/emergency-contact.entity';
import {
  AmbulanceProvider,
  AmbulanceProviderDocument,
} from './entities/ambulance-provider.entity';
import { User, UserDocument } from '../user/entities/user.entity';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  private option = { lean: true } as const;

  constructor(
    @InjectModel(EmergencyRequest.name)
    private emergencyRequestModel: Model<EmergencyRequestDocument>,
    @InjectModel(EmergencyContact.name)
    private emergencyContactModel: Model<EmergencyContactDocument>,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private commonService: CommonService,
    private emergencyNotificationService: EmergencyNotificationService,
  ) {}

  /**
   * Create a new emergency request
   */
  async createEmergencyRequest(dto: CreateEmergencyRequestDto, user: any) {
    try {
      this.logger.log(
        `Creating emergency request for user ${user._id}, type: ${dto.emergencyType}`,
      );

      const emergencyRequest = new this.emergencyRequestModel({
        userId: user._id,
        emergencyType: dto.emergencyType,
        location: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        },
        address: dto.address,
        priority: dto.priority,
        description: dto.description,
        contactNumber: dto.contactNumber || user.phone,
        status: 'pending',
        metadata: {
          userAgent: user.userAgent || 'mobile-app',
          requestSource: 'mobile',
        },
      });

      const savedRequest = await emergencyRequest.save();

      // Find and assign nearest available ambulance provider if it's an ambulance request
      if (dto.emergencyType === 'ambulance') {
        await this.assignNearestAmbulance(savedRequest);
      }

      // Log the emergency request creation
      this.logger.log(`Emergency request created: ${savedRequest._id}`);

      // Send notifications about the emergency request
      const notificationData: EmergencyNotificationData = {
        emergencyRequestId: (savedRequest._id as any).toString(),
        emergencyType: savedRequest.emergencyType,
        priority: savedRequest.priority,
        location: {
          latitude: savedRequest.location.coordinates[1],
          longitude: savedRequest.location.coordinates[0],
        },
        address: savedRequest.address,
        description: savedRequest.description,
        userId: savedRequest.userId.toString(),
      };

      if (savedRequest.assignedProviderId) {
        notificationData.assignedProviderId =
          savedRequest.assignedProviderId.toString();
      }

      await this.emergencyNotificationService.notifyEmergencyRequest(
        notificationData,
      );

      return {
        id: savedRequest._id,
        emergencyType: savedRequest.emergencyType,
        status: savedRequest.status,
        priority: savedRequest.priority,
        location: {
          latitude: savedRequest.location.coordinates[1],
          longitude: savedRequest.location.coordinates[0],
        },
        address: savedRequest.address,
        estimatedResponseTime: savedRequest.estimatedResponseTime,
        assignedProviderId: savedRequest.assignedProviderId,
        createdAt: (savedRequest as any).createdAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create emergency request: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Update emergency request status
   */
  async updateEmergencyRequest(
    requestId: string,
    dto: UpdateEmergencyRequestDto,
    user: any,
  ) {
    try {
      if (!Types.ObjectId.isValid(requestId)) {
        throw new BadRequestException('Invalid emergency request ID');
      }

      const updateData: any = { ...dto };

      // Set timestamps based on status changes
      if (dto.status === 'assigned' && dto.assignedProviderId) {
        updateData.assignedAt = new Date();
      } else if (dto.status === 'in_progress') {
        updateData.respondedAt = new Date();
      } else if (dto.status === 'completed') {
        updateData.completedAt = new Date();

        // Calculate actual response time if we have both created and completed times
        const request = await this.emergencyRequestModel.findById(requestId);
        if (request && (request as any).createdAt) {
          const responseTimeMs =
            new Date().getTime() - (request as any).createdAt.getTime();
          updateData.actualResponseTime = Math.round(
            responseTimeMs / (1000 * 60),
          ); // Convert to minutes
        }
      }

      const updatedRequest = await this.emergencyRequestModel.findByIdAndUpdate(
        requestId,
        updateData,
        { new: true, lean: true },
      );

      if (!updatedRequest) {
        throw new NotFoundException('Emergency request not found');
      }

      this.logger.log(
        `Emergency request updated: ${requestId}, status: ${dto.status}`,
      );

      // Send status update notifications
      if (dto.status) {
        const originalRequest = await this.emergencyRequestModel
          .findById(requestId)
          .lean();
        if (originalRequest) {
          await this.emergencyNotificationService.notifyEmergencyStatusUpdate(
            requestId,
            originalRequest.status,
            dto.status,
            {
              assignedProviderId: dto.assignedProviderId,
              estimatedResponseTime: dto.estimatedResponseTime,
            },
          );
        }
      }

      return {
        id: updatedRequest._id,
        status: updatedRequest.status,
        assignedProviderId: updatedRequest.assignedProviderId,
        estimatedResponseTime: updatedRequest.estimatedResponseTime,
        actualResponseTime: updatedRequest.actualResponseTime,
        updatedAt: (updatedRequest as any).updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update emergency request ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get emergency requests with filtering
   */
  async getEmergencyRequests(dto: EmergencyRequestQueryDto, user: any) {
    try {
      const {
        emergencyType,
        status,
        priority,
        latitude,
        longitude,
        radius = 20,
        pagination = 1,
        limit = 10,
      } = dto;

      const setOptions = await this.commonService.setOptions(pagination, limit);

      const query: any = {
        isActive: true,
      };

      // Add user-specific filtering (users can only see their own requests unless admin)
      if (user.role !== 'ADMIN') {
        query.userId = user._id;
      }

      // Add filters
      if (emergencyType) {
        query.emergencyType = emergencyType;
      }
      if (status) {
        query.status = status;
      }
      if (priority) {
        query.priority = priority;
      }

      // Add location-based filtering if coordinates provided
      if (latitude && longitude) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius * 1000, // Convert km to meters
          },
        };
      }

      const count = await this.emergencyRequestModel.countDocuments(query);
      const requests = await this.emergencyRequestModel
        .find(query, {}, setOptions)
        .populate('assignedProviderId', 'name contactNumber vehicleType')
        .sort({ createdAt: -1 })
        .exec();

      return {
        count,
        emergencyRequests: requests.map((request) => ({
          id: request._id,
          emergencyType: request.emergencyType,
          status: request.status,
          priority: request.priority,
          location: {
            latitude: request.location.coordinates[1],
            longitude: request.location.coordinates[0],
          },
          address: request.address,
          description: request.description,
          contactNumber: request.contactNumber,
          assignedProvider: request.assignedProviderId,
          estimatedResponseTime: request.estimatedResponseTime,
          actualResponseTime: request.actualResponseTime,
          createdAt: (request as any).createdAt,
          updatedAt: (request as any).updatedAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get emergency requests: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get location-specific emergency contacts
   */
  async getEmergencyContacts(dto: EmergencyContactQueryDto, user: any) {
    try {
      const {
        serviceType,
        scope,
        state,
        city,
        latitude,
        longitude,
        radius = 50,
      } = dto;

      const query: any = {
        isActive: true,
        status: 'active',
      };

      // Add filters
      if (serviceType) {
        query.serviceType = serviceType;
      }
      if (scope) {
        query.scope = scope;
      }
      if (state) {
        query.state = new RegExp(state, 'i');
      }
      if (city) {
        query.city = new RegExp(city, 'i');
      }

      // Add location-based filtering if coordinates provided
      if (latitude && longitude) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius * 1000, // Convert km to meters
          },
        };
      }

      const contacts = await this.emergencyContactModel
        .find(query, {}, this.option)
        .sort({ scope: 1, serviceType: 1 })
        .exec();

      return {
        count: contacts.length,
        emergencyContacts: contacts.map((contact) => ({
          id: contact._id,
          name: contact.name,
          serviceType: contact.serviceType,
          contactNumber: contact.contactNumber,
          alternateNumber: contact.alternateNumber,
          email: contact.email,
          description: contact.description,
          scope: contact.scope,
          state: contact.state,
          city: contact.city,
          availability: contact.availability,
          languages: contact.languages,
          operatingHours: contact.operatingHours,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get emergency contacts: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Update ambulance availability in real-time
   */
  async updateAmbulanceAvailability(dto: AmbulanceAvailabilityUpdateDto) {
    try {
      if (!Types.ObjectId.isValid(dto.providerId)) {
        throw new BadRequestException('Invalid provider ID');
      }

      const updateData: any = {
        availability: dto.availability,
      };

      // Update location if provided
      if (dto.latitude && dto.longitude) {
        updateData.location = {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        };
      }

      // Update response time if provided
      if (dto.responseTime !== undefined) {
        updateData.responseTime = dto.responseTime;
      }

      // Update metadata if provided
      if (dto.metadata) {
        updateData.metadata = { ...updateData.metadata, ...dto.metadata };
      }

      const updatedProvider =
        await this.ambulanceProviderModel.findByIdAndUpdate(
          dto.providerId,
          updateData,
          { new: true, lean: true },
        );

      if (!updatedProvider) {
        throw new NotFoundException('Ambulance provider not found');
      }

      this.logger.log(
        `Ambulance availability updated: ${dto.providerId}, available: ${dto.availability}`,
      );

      // Send ambulance status update notifications
      const statusUpdate: any = {
        providerId: dto.providerId,
        availability: dto.availability,
      };

      if (dto.latitude && dto.longitude) {
        statusUpdate.location = {
          latitude: dto.latitude,
          longitude: dto.longitude,
        };
      }

      if (dto.responseTime !== undefined) {
        statusUpdate.responseTime = dto.responseTime;
      }

      if (dto.metadata) {
        statusUpdate.metadata = dto.metadata;
      }

      await this.emergencyNotificationService.notifyAmbulanceStatusUpdate(
        statusUpdate,
      );

      return {
        id: updatedProvider._id,
        name: updatedProvider.name,
        availability: updatedProvider.availability,
        location: updatedProvider.location.coordinates,
        responseTime: updatedProvider.responseTime,
        vehicleType: updatedProvider.vehicleType,
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update ambulance availability: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get real-time ambulance availability
   */
  async getAmbulanceAvailability(
    latitude?: number,
    longitude?: number,
    radius: number = 20,
  ) {
    try {
      const query: any = {
        isActive: true,
        availability: true,
      };

      // Add location-based filtering if coordinates provided
      if (latitude && longitude) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius * 1000, // Convert km to meters
          },
        };
      }

      const availableAmbulances = await this.ambulanceProviderModel
        .find(query, {}, this.option)
        .sort({ responseTime: 1 }) // Sort by fastest response time
        .exec();

      return {
        count: availableAmbulances.length,
        availableAmbulances: availableAmbulances.map((ambulance) => ({
          id: ambulance._id,
          name: ambulance.name,
          location: ambulance.location.coordinates,
          responseTime: ambulance.responseTime,
          vehicleType: ambulance.vehicleType,
          contactNumber: ambulance.contactNumber,
          services: ambulance.services,
          lastUpdated: (ambulance as any).updatedAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get ambulance availability: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Assign nearest available ambulance to emergency request
   */
  private async assignNearestAmbulance(
    emergencyRequest: EmergencyRequestDocument,
  ) {
    try {
      const [longitude, latitude] = emergencyRequest.location.coordinates;

      const nearestAmbulance = await this.ambulanceProviderModel.findOne({
        isActive: true,
        availability: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
          },
        },
      });

      if (nearestAmbulance) {
        await this.emergencyRequestModel.findByIdAndUpdate(
          emergencyRequest._id,
          {
            assignedProviderId: nearestAmbulance._id,
            status: 'assigned',
            assignedAt: new Date(),
            estimatedResponseTime: nearestAmbulance.responseTime,
          },
        );

        // Mark ambulance as unavailable
        await this.ambulanceProviderModel.findByIdAndUpdate(
          nearestAmbulance._id,
          {
            availability: false,
          },
        );

        this.logger.log(
          `Assigned ambulance ${nearestAmbulance._id} to emergency request ${emergencyRequest._id}`,
        );
      } else {
        this.logger.warn(
          `No available ambulances found for emergency request ${emergencyRequest._id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to assign ambulance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get emergency request by ID
   */
  async getEmergencyRequestById(requestId: string, user: any) {
    try {
      if (!Types.ObjectId.isValid(requestId)) {
        throw new BadRequestException('Invalid emergency request ID');
      }

      const query: any = { _id: requestId, isActive: true };

      // Users can only see their own requests unless admin
      if (user.role !== 'ADMIN') {
        query.userId = user._id;
      }

      const request = await this.emergencyRequestModel
        .findOne(query)
        .populate(
          'assignedProviderId',
          'name contactNumber vehicleType location',
        )
        .populate('userId', 'name phone email')
        .lean();

      if (!request) {
        throw new NotFoundException('Emergency request not found');
      }

      return {
        id: request._id,
        emergencyType: request.emergencyType,
        status: request.status,
        priority: request.priority,
        location: {
          latitude: request.location.coordinates[1],
          longitude: request.location.coordinates[0],
        },
        address: request.address,
        description: request.description,
        contactNumber: request.contactNumber,
        user: request.userId,
        assignedProvider: request.assignedProviderId,
        estimatedResponseTime: request.estimatedResponseTime,
        actualResponseTime: request.actualResponseTime,
        assignedAt: request.assignedAt,
        respondedAt: request.respondedAt,
        completedAt: request.completedAt,
        createdAt: (request as any).createdAt,
        updatedAt: (request as any).updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get emergency request ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
