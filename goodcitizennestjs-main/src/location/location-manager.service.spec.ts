import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LocationManagerService } from './location-manager.service';
import { UserLocation, UserLocationDocument } from './entities/user-location.entity';
import { BadRequestException } from '@nestjs/common';

describe('LocationManagerService', () => {
  let service: LocationManagerService;
  let model: Model<UserLocationDocument>;

  const mockUserLocationModel = {
    updateMany: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationManagerService,
        {
          provide: getModelToken(UserLocation.name),
          useValue: mockUserLocationModel,
        },
      ],
    }).compile();

    service = module.get<LocationManagerService>(LocationManagerService);
    model = module.get<Model<UserLocationDocument>>(getModelToken(UserLocation.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUserLocation', () => {
    it('should throw BadRequestException for invalid longitude', async () => {
      const locationData = {
        userId: '507f1f77bcf86cd799439011',
        coordinates: [181, 37.7749] as [number, number], // Invalid longitude
        accuracy: 10,
        timestamp: new Date(),
        source: 'gps' as const,
      };

      await expect(service.updateUserLocation(locationData)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid latitude', async () => {
      const locationData = {
        userId: '507f1f77bcf86cd799439011',
        coordinates: [-122.4194, 91] as [number, number], // Invalid latitude
        accuracy: 10,
        timestamp: new Date(),
        source: 'gps' as const,
      };

      await expect(service.updateUserLocation(locationData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserLastLocation', () => {
    it('should return user last location', async () => {
      const mockLocation = {
        userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
        coordinates: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        accuracy: 10,
        timestamp: new Date(),
        source: 'gps',
        isActive: true,
      };

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLocation),
      };

      mockUserLocationModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getUserLastLocation('507f1f77bcf86cd799439011');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('507f1f77bcf86cd799439011');
      expect(result?.coordinates.coordinates).toEqual([-122.4194, 37.7749]);
    });

    it('should return null when no location found', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockUserLocationModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getUserLastLocation('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });
  });

  describe('trackLocationHistory', () => {
    it('should return location history', async () => {
      const mockLocations = [
        {
          userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
          coordinates: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          accuracy: 10,
          timestamp: new Date(),
          source: 'gps',
          isActive: true,
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLocations),
      };

      mockUserLocationModel.find.mockReturnValue(mockQuery);

      const result = await service.trackLocationHistory('507f1f77bcf86cd799439011', 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe('507f1f77bcf86cd799439011');
    });
  });
});