/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FacilityDetail,
  FacilityDetailDocument,
} from './entities/facility-detail.entity';
import {
  FacilityDetailQueryDto,
  StationDetailQueryDto,
  HospitalDetailQueryDto,
} from './dto/detail-query.dto';
import { RealTimeUpdatesService } from '../web-socket/real-time-updates.service';

@Injectable()
export class FacilityDetailService {
  private readonly logger = new Logger(FacilityDetailService.name);

  constructor(
    @InjectModel(FacilityDetail.name)
    private facilityDetailModel: Model<FacilityDetailDocument>,
    @Inject(forwardRef(() => RealTimeUpdatesService))
    private realTimeUpdatesService: RealTimeUpdatesService,
  ) {}

  /**
   * Get comprehensive station information
   * @param stationId Station ID
   * @param dto Station detail query parameters
   * @param user Current user
   * @returns Detailed station information
   */
  async getStationDetail(
    stationId: string,
    dto: StationDetailQueryDto,
    user: any,
  ) {
    try {
      this.logger.log(`Getting station detail for ID: ${stationId}`);

      const facility = await this.facilityDetailModel
        .findOne({
          facilityId: stationId,
          type: 'station',
          isActive: true,
          isVerified: true,
        })
        .exec();

      if (!facility) {
        throw new NotFoundException(`Station with ID ${stationId} not found`);
      }

      return this.formatStationResponse(facility, dto);
    } catch (error) {
      this.logger.error(
        `Error getting station detail for ID ${stationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get comprehensive hospital information
   * @param hospitalId Hospital ID
   * @param dto Hospital detail query parameters
   * @param user Current user
   * @returns Detailed hospital information
   */
  async getHospitalDetail(
    hospitalId: string,
    dto: HospitalDetailQueryDto,
    user: any,
  ) {
    try {
      this.logger.log(`Getting hospital detail for ID: ${hospitalId}`);

      const facility = await this.facilityDetailModel
        .findOne({
          facilityId: hospitalId,
          type: { $in: ['hospital', 'clinic', 'emergency_center'] },
          isActive: true,
          isVerified: true,
        })
        .exec();

      if (!facility) {
        throw new NotFoundException(`Hospital with ID ${hospitalId} not found`);
      }

      // Update real-time capacity if requested
      if (dto.includeCapacity) {
        await this.updateRealTimeCapacity(facility);
      }

      return this.formatHospitalResponse(facility, dto);
    } catch (error) {
      this.logger.error(
        `Error getting hospital detail for ID ${hospitalId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get general facility information
   * @param facilityId Facility ID
   * @param dto Facility detail query parameters
   * @param user Current user
   * @returns Detailed facility information
   */
  async getFacilityDetail(
    facilityId: string,
    dto: FacilityDetailQueryDto,
    user: any,
  ) {
    try {
      this.logger.log(`Getting facility detail for ID: ${facilityId}`);

      const facility = await this.facilityDetailModel
        .findOne({
          facilityId: facilityId,
          isActive: true,
          isVerified: true,
        })
        .exec();

      if (!facility) {
        throw new NotFoundException(`Facility with ID ${facilityId} not found`);
      }

      // Update real-time capacity if requested
      if (dto.includeCapacity) {
        await this.updateRealTimeCapacity(facility);
      }

      return this.formatFacilityResponse(facility, dto);
    } catch (error) {
      this.logger.error(
        `Error getting facility detail for ID ${facilityId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update real-time capacity information
   * @param facility Facility document
   */
  private async updateRealTimeCapacity(
    facility: FacilityDetailDocument,
  ): Promise<void> {
    // This would typically integrate with hospital management systems
    // For now, we'll simulate capacity based on time and facility type
    const currentHour = new Date().getHours();
    let capacity = 80; // Default 80% available

    // Simulate capacity variations based on time of day
    if (currentHour >= 8 && currentHour <= 12) {
      capacity = Math.floor(Math.random() * 30) + 50; // 50-80% during morning hours
    } else if (currentHour >= 13 && currentHour <= 17) {
      capacity = Math.floor(Math.random() * 40) + 40; // 40-80% during afternoon
    } else if (currentHour >= 18 && currentHour <= 22) {
      capacity = Math.floor(Math.random() * 20) + 30; // 30-50% during evening
    } else {
      capacity = Math.floor(Math.random() * 50) + 50; // 50-100% during night/early morning
    }

    const previousCapacity = facility.realTimeCapacity;
    facility.realTimeCapacity = capacity;
    await facility.save();

    // Trigger real-time update if capacity changed significantly
    if (Math.abs((previousCapacity || 80) - capacity) > 10) {
      try {
        if (
          facility.location &&
          facility.location.coordinates &&
          facility.location.coordinates.length >= 2
        ) {
          await this.realTimeUpdatesService.broadcastEmergencyServiceStatusUpdate(
            {
              serviceId: facility.facilityId,
              serviceType:
                facility.type === 'hospital' ? 'hospital' : 'hospital',
              status:
                capacity > 70
                  ? 'available'
                  : capacity > 30
                    ? 'busy'
                    : 'emergency',
              capacity,
              estimatedWaitTime: capacity > 70 ? 5 : capacity > 30 ? 15 : 30,
              location: {
                latitude: facility.location.coordinates[1],
                longitude: facility.location.coordinates[0],
              },
              lastUpdated: new Date(),
            },
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to broadcast capacity update for facility ${facility.facilityId}:`,
          error,
        );
      }
    }
  }

  /**
   * Format station response
   * @param facility Facility document
   * @param dto Query parameters
   * @returns Formatted station response
   */
  private formatStationResponse(
    facility: FacilityDetailDocument,
    dto: StationDetailQueryDto,
  ) {
    const response: any = {
      id: facility.facilityId,
      name: facility.name,
      type: facility.type,
      address: facility.address,
      location: {
        latitude: facility.location.coordinates[1],
        longitude: facility.location.coordinates[0],
      },
      isVerified: facility.isVerified,
    };

    if (dto.includeServices !== false) {
      response.services = facility.services;
      response.operatingHours = facility.operatingHours;
    }

    if (dto.includeContact !== false) {
      response.contactInfo = facility.contactInfo;
    }

    if (facility.ratings && facility.ratings.rating) {
      response.ratings = facility.ratings;
    }

    return response;
  }

  /**
   * Format hospital response
   * @param facility Facility document
   * @param dto Query parameters
   * @returns Formatted hospital response
   */
  private formatHospitalResponse(
    facility: FacilityDetailDocument,
    dto: HospitalDetailQueryDto,
  ) {
    const response: any = {
      id: facility.facilityId,
      name: facility.name,
      type: facility.type,
      address: facility.address,
      location: {
        latitude: facility.location.coordinates[1],
        longitude: facility.location.coordinates[0],
      },
      isVerified: facility.isVerified,
      contactInfo: facility.contactInfo,
      operatingHours: facility.operatingHours,
    };

    if (dto.includeSpecialties !== false) {
      response.specializations = facility.specializations;
      response.services = facility.services;
    }

    if (dto.includeCapacity && facility.realTimeCapacity !== undefined) {
      response.realTimeCapacity = facility.realTimeCapacity;
      response.capacityLastUpdated = (facility as any).updatedAt || new Date();
    }

    if (dto.includeEmergency !== false) {
      response.emergencyServices = facility.emergencyServices;
    }

    if (facility.ratings && facility.ratings.rating) {
      response.ratings = facility.ratings;
    }

    return response;
  }

  /**
   * Format general facility response
   * @param facility Facility document
   * @param dto Query parameters
   * @returns Formatted facility response
   */
  private formatFacilityResponse(
    facility: FacilityDetailDocument,
    dto: FacilityDetailQueryDto,
  ) {
    const response: any = {
      id: facility.facilityId,
      name: facility.name,
      type: facility.type,
      address: facility.address,
      location: {
        latitude: facility.location.coordinates[1],
        longitude: facility.location.coordinates[0],
      },
      services: facility.services,
      contactInfo: facility.contactInfo,
      isVerified: facility.isVerified,
    };

    if (dto.includeHours !== false) {
      response.operatingHours = facility.operatingHours;
    }

    if (dto.includeCapacity && facility.realTimeCapacity !== undefined) {
      response.realTimeCapacity = facility.realTimeCapacity;
      response.capacityLastUpdated = (facility as any).updatedAt || new Date();
    }

    if (facility.specializations && facility.specializations.length > 0) {
      response.specializations = facility.specializations;
    }

    if (facility.emergencyServices) {
      response.emergencyServices = facility.emergencyServices;
    }

    if (facility.ratings && facility.ratings.rating) {
      response.ratings = facility.ratings;
    }

    return response;
  }

  /**
   * Create or update facility detail
   * @param facilityData Facility data
   * @returns Created/updated facility
   */
  async createOrUpdateFacility(
    facilityData: any,
  ): Promise<FacilityDetailDocument> {
    const existingFacility = await this.facilityDetailModel
      .findOne({
        facilityId: facilityData.facilityId,
      })
      .exec();

    if (existingFacility) {
      Object.assign(existingFacility, facilityData);
      return await existingFacility.save();
    } else {
      const newFacility = new this.facilityDetailModel(facilityData);
      return await newFacility.save();
    }
  }

  /**
   * Get facilities by type and location
   * @param type Facility type
   * @param latitude User latitude
   * @param longitude User longitude
   * @param radius Search radius in kilometers
   * @returns List of nearby facilities
   */
  async getFacilitiesByLocation(
    type: string,
    latitude: number,
    longitude: number,
    radius: number = 10,
  ) {
    return await this.facilityDetailModel
      .find({
        type: type,
        isActive: true,
        isVerified: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius * 1000, // Convert km to meters
          },
        },
      })
      .limit(20)
      .exec();
  }
}
