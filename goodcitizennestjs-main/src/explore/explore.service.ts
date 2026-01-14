/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable no-useless-catch */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommonService } from '../common/common.service';
import {
  HospitalQueryDto,
  AmbulanceQueryDto,
  BloodBankQueryDto,
  EmergencyServicesQueryDto,
  HealthTipsQueryDto,
  CommunityStatsQueryDto,
} from './dto/explore-query.dto';
import {
  HealthcareFacility,
  HealthcareFacilityDocument,
} from './entities/healthcare-facility.entity';
import { BloodBank, BloodBankDocument } from './entities/blood-bank.entity';
import {
  AmbulanceProvider,
  AmbulanceProviderDocument,
} from './entities/ambulance-provider.entity';

@Injectable()
export class ExploreService {
  private option = { lean: true } as const;

  constructor(
    @InjectModel(HealthcareFacility.name)
    private healthcareFacilityModel: Model<HealthcareFacilityDocument>,
    @InjectModel(BloodBank.name)
    private bloodBankModel: Model<BloodBankDocument>,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
    private commonService: CommonService,
  ) {}

  /**
   * Get nearby hospitals with location filtering
   */
  async getHospitals(dto: HospitalQueryDto, user: any) {
    try {
      const {
        latitude,
        longitude,
        radius = 10,
        specialties,
        pagination,
        limit,
      } = dto;
      const setOptions = await this.commonService.setOptions(pagination, limit);

      const query: any = {
        type: 'hospital',
        isActive: true,
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

      // Add specialty filtering if provided
      if (specialties && specialties.length > 0) {
        query.services = { $in: specialties };
      }

      const count = await this.healthcareFacilityModel.countDocuments(query);
      const hospitals = await this.healthcareFacilityModel
        .find(query, {}, setOptions)
        .exec();

      return {
        count,
        hospitals: hospitals.map((hospital) => ({
          id: hospital._id,
          name: hospital.name,
          address: hospital.address,
          coordinates: hospital.location.coordinates,
          specialties: hospital.services,
          availability: hospital.metadata?.availability || 'available',
          distance: hospital.metadata?.distance || 0,
          estimatedWaitTime: hospital.metadata?.estimatedWaitTime || 0,
          contactInfo: hospital.contactInfo,
        })),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get available ambulance services
   */
  async getAmbulances(dto: AmbulanceQueryDto, user: any) {
    try {
      const {
        latitude,
        longitude,
        radius = 20,
        vehicleType,
        pagination,
        limit,
      } = dto;
      const setOptions = await this.commonService.setOptions(pagination, limit);

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

      // Add vehicle type filtering if provided
      if (vehicleType) {
        query.vehicleType = vehicleType;
      }

      const count = await this.ambulanceProviderModel.countDocuments(query);
      const ambulances = await this.ambulanceProviderModel
        .find(query, {}, setOptions)
        .exec();

      return {
        count,
        ambulances: ambulances.map((ambulance) => ({
          id: ambulance._id,
          name: ambulance.name,
          location: ambulance.location.coordinates,
          responseTime: ambulance.responseTime,
          vehicleType: ambulance.vehicleType,
          availability: ambulance.availability,
          contactNumber: ambulance.contactNumber,
          services: ambulance.services,
        })),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get nearby blood banks with availability
   */
  async getBloodBanks(dto: BloodBankQueryDto, user: any) {
    try {
      const {
        latitude,
        longitude,
        radius = 15,
        bloodType,
        pagination,
        limit,
      } = dto;
      const setOptions = await this.commonService.setOptions(pagination, limit);

      const query: any = {
        isActive: true,
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

      // Add blood type availability filtering if provided
      if (bloodType) {
        query[`bloodTypes.${bloodType}`] = { $gt: 0 };
      }

      const count = await this.bloodBankModel.countDocuments(query);
      const bloodBanks = await this.bloodBankModel
        .find(query, {}, setOptions)
        .exec();

      return {
        count,
        bloodBanks: bloodBanks.map((bank) => ({
          id: bank._id,
          name: bank.name,
          address: bank.address,
          coordinates: bank.location.coordinates,
          bloodTypes: bank.bloodTypes,
          operatingHours: bank.operatingHours,
          emergencyContact: bank.emergencyContact,
          contactInfo: bank.contactInfo,
        })),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get emergency services contact information
   */
  async getEmergencyServices(dto: EmergencyServicesQueryDto, user: any) {
    try {
      const { latitude, longitude, serviceType } = dto;

      // Mock emergency services data - in production this would come from a database
      const emergencyServices = [
        {
          id: 'emergency-1',
          name: 'National Emergency Services',
          type: 'general',
          contactNumber: '112',
          description: 'National emergency helpline for all emergencies',
          availability: '24/7',
        },
        {
          id: 'emergency-2',
          name: 'Police Emergency',
          type: 'police',
          contactNumber: '100',
          description: 'Police emergency services',
          availability: '24/7',
        },
        {
          id: 'emergency-3',
          name: 'Fire Emergency',
          type: 'fire',
          contactNumber: '101',
          description: 'Fire department emergency services',
          availability: '24/7',
        },
        {
          id: 'emergency-4',
          name: 'Medical Emergency',
          type: 'medical',
          contactNumber: '108',
          description: 'Medical emergency and ambulance services',
          availability: '24/7',
        },
      ];

      let filteredServices = emergencyServices;
      if (serviceType) {
        filteredServices = emergencyServices.filter(
          (service) => service.type === serviceType,
        );
      }

      return {
        count: filteredServices.length,
        emergencyServices: filteredServices,
        location: latitude && longitude ? { latitude, longitude } : null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get health tips and safety information
   */
  async getHealthTips(dto: HealthTipsQueryDto, user: any) {
    try {
      const { category, pagination, limit } = dto;
      const setOptions = await this.commonService.setOptions(pagination, limit);

      // Mock health tips data - in production this would come from a database
      const healthTips = [
        {
          id: 'tip-1',
          title: 'Emergency First Aid',
          category: 'emergency',
          content: 'Learn basic first aid techniques for common emergencies',
          priority: 'high',
          createdAt: new Date(),
        },
        {
          id: 'tip-2',
          title: 'Road Safety Guidelines',
          category: 'safety',
          content: 'Important road safety tips for drivers and passengers',
          priority: 'medium',
          createdAt: new Date(),
        },
        {
          id: 'tip-3',
          title: 'Health Checkup Reminders',
          category: 'health',
          content: 'Regular health checkup schedule and importance',
          priority: 'low',
          createdAt: new Date(),
        },
      ];

      let filteredTips = healthTips;
      if (category) {
        filteredTips = healthTips.filter((tip) => tip.category === category);
      }

      return {
        count: filteredTips.length,
        healthTips: filteredTips,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get community statistics and metrics
   */
  async getCommunityStats(dto: CommunityStatsQueryDto, user: any) {
    try {
      const { timeframe = '30d' } = dto;

      // Mock community statistics - in production this would be calculated from actual data
      const stats = {
        totalUsers: 15420,
        totalRides: 89650,
        emergencyAssists: 1250,
        communityPoints: 245800,
        activeDrivers: 3200,
        timeframe,
        lastUpdated: new Date(),
        breakdown: {
          ridesThisMonth: 12450,
          emergencyAssistsThisMonth: 180,
          newUsersThisMonth: 890,
          topContributors: [
            { userId: 'user-1', points: 2500, assists: 45 },
            { userId: 'user-2', points: 2200, assists: 38 },
            { userId: 'user-3', points: 1980, assists: 32 },
          ],
        },
      };

      return {
        communityStats: stats,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update ambulance availability (simplified version without real-time updates)
   */
  async updateAmbulanceAvailability(
    ambulanceId: string,
    availability: boolean,
    location?: { latitude: number; longitude: number },
    responseTime?: number,
  ): Promise<void> {
    try {
      const updateData: any = {
        availability,
        updatedAt: new Date(),
      };

      if (location) {
        updateData.location = {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        };
      }

      if (responseTime !== undefined) {
        updateData.responseTime = responseTime;
      }

      await this.ambulanceProviderModel.findByIdAndUpdate(
        ambulanceId,
        updateData,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update emergency service status (simplified version)
   */
  async updateEmergencyServiceStatus(
    serviceId: string,
    serviceType: 'ambulance' | 'hospital' | 'blood_bank' | 'emergency_contact',
    status: 'available' | 'busy' | 'offline' | 'emergency',
    additionalData?: {
      capacity?: number;
      estimatedWaitTime?: number;
      location?: { latitude: number; longitude: number };
    },
  ): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };

      switch (serviceType) {
        case 'ambulance':
          updateData.availability = status === 'available';
          if (additionalData?.location) {
            updateData.location = {
              type: 'Point',
              coordinates: [
                additionalData.location.longitude,
                additionalData.location.latitude,
              ],
            };
          }
          if (additionalData?.estimatedWaitTime !== undefined) {
            updateData.responseTime = additionalData.estimatedWaitTime;
          }
          await this.ambulanceProviderModel.findByIdAndUpdate(
            serviceId,
            updateData,
          );
          break;

        case 'hospital':
          updateData.isActive = status !== 'offline';
          if (additionalData?.capacity !== undefined) {
            updateData['metadata.capacity'] = additionalData.capacity;
          }
          await this.healthcareFacilityModel.findByIdAndUpdate(
            serviceId,
            updateData,
          );
          break;

        case 'blood_bank':
          updateData.isActive = status !== 'offline';
          await this.bloodBankModel.findByIdAndUpdate(serviceId, updateData);
          break;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update healthcare facility location (simplified version)
   */
  async updateHealthcareFacilityLocation(
    facilityId: string,
    location: { latitude: number; longitude: number },
    metadata?: any,
  ): Promise<void> {
    try {
      const updateData = {
        location: {
          type: 'Point' as const,
          coordinates: [location.longitude, location.latitude],
        },
        updatedAt: new Date(),
        ...(metadata || {}),
      };

      await this.healthcareFacilityModel.findByIdAndUpdate(
        facilityId,
        updateData,
      );
    } catch (error) {
      throw error;
    }
  }
}
