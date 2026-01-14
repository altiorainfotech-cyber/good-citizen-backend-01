/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import {
  BloodType,
  EmergencyServiceType,
  HealthTipCategory,
  StatsTimeframe,
} from './dto/explore-query.dto';

describe('ExploreController', () => {
  let controller: ExploreController;
  let service: ExploreService;

  const mockExploreService = {
    getHospitals: jest.fn(),
    getAmbulances: jest.fn(),
    getBloodBanks: jest.fn(),
    getEmergencyServices: jest.fn(),
    getHealthTips: jest.fn(),
    getCommunityStats: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    role: 'USER',
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExploreController],
      providers: [
        {
          provide: ExploreService,
          useValue: mockExploreService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExploreController>(ExploreController);
    service = module.get<ExploreService>(ExploreService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHospitals', () => {
    it('should return hospitals data', async () => {
      const mockHospitals = {
        count: 2,
        hospitals: [
          {
            id: 'hospital-1',
            name: 'Test Hospital',
            address: '123 Test St',
            coordinates: [77.1025, 28.7041],
            specialties: ['cardiology', 'neurology'],
            availability: 'available',
            distance: 2.5,
            estimatedWaitTime: 15,
            contactInfo: {
              phone: '+91-11-12345678',
              emergency: '+91-11-87654321',
            },
          },
        ],
      };

      mockExploreService.getHospitals.mockResolvedValue(mockHospitals);

      const dto = { latitude: 28.7041, longitude: 77.1025, radius: 10 };
      const result = await controller.getHospitals(dto, mockRequest);

      expect(result).toEqual(mockHospitals);
      expect(service.getHospitals).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('getAmbulances', () => {
    it('should return ambulances data', async () => {
      const mockAmbulances = {
        count: 1,
        ambulances: [
          {
            id: 'ambulance-1',
            name: 'Emergency Ambulance Service',
            location: [77.1025, 28.7041],
            responseTime: 8,
            vehicleType: 'advanced',
            availability: true,
            contactNumber: '+91-11-98765432',
            services: ['emergency', 'critical care'],
          },
        ],
      };

      mockExploreService.getAmbulances.mockResolvedValue(mockAmbulances);

      const dto = { latitude: 28.7041, longitude: 77.1025, radius: 20 };
      const result = await controller.getAmbulances(dto, mockRequest);

      expect(result).toEqual(mockAmbulances);
      expect(service.getAmbulances).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('getBloodBanks', () => {
    it('should return blood banks data', async () => {
      const mockBloodBanks = {
        count: 1,
        bloodBanks: [
          {
            id: 'bloodbank-1',
            name: 'City Blood Bank',
            address: '456 Health Ave',
            coordinates: [77.1025, 28.7041],
            bloodTypes: {
              'A+': 10,
              'B+': 5,
              'O+': 15,
              'AB+': 3,
            },
            operatingHours: {
              monday: '9:00-17:00',
              tuesday: '9:00-17:00',
            },
            emergencyContact: '+91-11-11111111',
            contactInfo: {
              phone: '+91-11-22222222',
              emergency: '+91-11-11111111',
            },
          },
        ],
      };

      mockExploreService.getBloodBanks.mockResolvedValue(mockBloodBanks);

      const dto = {
        latitude: 28.7041,
        longitude: 77.1025,
        bloodType: BloodType.A_POSITIVE,
      };
      const result = await controller.getBloodBanks(dto, mockRequest);

      expect(result).toEqual(mockBloodBanks);
      expect(service.getBloodBanks).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('getEmergencyServices', () => {
    it('should return emergency services data', async () => {
      const mockEmergencyServices = {
        count: 4,
        emergencyServices: [
          {
            id: 'emergency-1',
            name: 'National Emergency Services',
            type: 'general',
            contactNumber: '112',
            description: 'National emergency helpline for all emergencies',
            availability: '24/7',
          },
        ],
        location: { latitude: 28.7041, longitude: 77.1025 },
      };

      mockExploreService.getEmergencyServices.mockResolvedValue(
        mockEmergencyServices,
      );

      const dto = {
        latitude: 28.7041,
        longitude: 77.1025,
        serviceType: EmergencyServiceType.GENERAL,
      };
      const result = await controller.getEmergencyServices(dto, mockRequest);

      expect(result).toEqual(mockEmergencyServices);
      expect(service.getEmergencyServices).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('getHealthTips', () => {
    it('should return health tips data', async () => {
      const mockHealthTips = {
        count: 3,
        healthTips: [
          {
            id: 'tip-1',
            title: 'Emergency First Aid',
            category: 'emergency',
            content: 'Learn basic first aid techniques for common emergencies',
            priority: 'high',
            createdAt: new Date(),
          },
        ],
      };

      mockExploreService.getHealthTips.mockResolvedValue(mockHealthTips);

      const dto = {
        category: HealthTipCategory.EMERGENCY,
        pagination: 0,
        limit: 20,
      };
      const result = await controller.getHealthTips(dto, mockRequest);

      expect(result).toEqual(mockHealthTips);
      expect(service.getHealthTips).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('getCommunityStats', () => {
    it('should return community stats data', async () => {
      const mockCommunityStats = {
        communityStats: {
          totalUsers: 15420,
          totalRides: 89650,
          emergencyAssists: 1250,
          communityPoints: 245800,
          activeDrivers: 3200,
          timeframe: '30d',
          lastUpdated: new Date(),
          breakdown: {
            ridesThisMonth: 12450,
            emergencyAssistsThisMonth: 180,
            newUsersThisMonth: 890,
            topContributors: [{ userId: 'user-1', points: 2500, assists: 45 }],
          },
        },
      };

      mockExploreService.getCommunityStats.mockResolvedValue(
        mockCommunityStats,
      );

      const dto = { timeframe: StatsTimeframe.MONTH };
      const result = await controller.getCommunityStats(dto, mockRequest);

      expect(result).toEqual(mockCommunityStats);
      expect(service.getCommunityStats).toHaveBeenCalledWith(dto, mockUser);
    });
  });
});
