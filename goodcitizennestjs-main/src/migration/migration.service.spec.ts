/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  MigrationService,
  LegacyUserData,
  LegacyRideData,
} from './migration.service';
import { User } from '../user/entities/user.entity';
import { Session } from '../user/entities/session.entity';
import { Ride } from '../ride/entities/ride.entity';
import { Types } from 'mongoose';

describe('MigrationService', () => {
  let service: MigrationService;
  let userModel: any;
  let sessionModel: any;
  let rideModel: any;

  const mockModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateOne: jest.fn(),
    aggregate: jest.fn(),
    collection: {
      createIndex: jest.fn(),
    },
  };

  const createMockModelConstructor = () => {
    const MockModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    }));

    // Add static methods to the constructor
    Object.assign(MockModel, mockModel);

    return MockModel;
  };

  const mockLegacyUsers: LegacyUserData[] = [
    {
      _id: '507f1f77bcf86cd799439011',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone_number: '1234567890',
      country_code: '+1',
      password: '$2b$10$hashedpassword123',
      role: 'USER',
      latitude: 37.7749,
      longitude: -122.4194,
      is_online: false,
      is_email_verified: true,
      loyalty_point: 25,
      created_at: 1640995200000,
      updated_at: 1640995200000,
    },
  ];

  const mockLegacyRides: LegacyRideData[] = [
    {
      _id: '507f1f77bcf86cd799439021',
      user_id: '507f1f77bcf86cd799439011',
      driver_id: '507f1f77bcf86cd799439012',
      pickup_location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: '123 Main St, San Francisco, CA',
      },
      destination_location: {
        latitude: 37.7849,
        longitude: -122.4094,
        address: '456 Oak Ave, San Francisco, CA',
      },
      status: 'COMPLETED',
      vehicle_type: 'AMBULANCE',
      estimated_fare: 25.5,
      final_fare: 27.75,
      requested_at: new Date('2024-01-01T10:00:00.000Z'),
      completed_at: new Date('2024-01-01T10:30:00.000Z'),
      created_at: new Date('2024-01-01T10:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: getModelToken(User.name),
          useValue: createMockModelConstructor(),
        },
        {
          provide: getModelToken(Session.name),
          useValue: createMockModelConstructor(),
        },
        {
          provide: getModelToken(Ride.name),
          useValue: createMockModelConstructor(),
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
    userModel = module.get(getModelToken(User.name));
    sessionModel = module.get(getModelToken(Session.name));
    rideModel = module.get(getModelToken(Ride.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('migrateUserData', () => {
    it('should successfully migrate user data', async () => {
      // Mock no existing user
      userModel.findOne.mockResolvedValue(null);

      const result = await service.migrateUserData(mockLegacyUsers);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(userModel).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          role: 'USER',
        }),
      );
    });

    it('should skip existing users', async () => {
      // Mock existing user
      userModel.findOne.mockResolvedValue({ email: 'john.doe@example.com' });

      const result = await service.migrateUserData(mockLegacyUsers);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(userModel).not.toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.migrateUserData(mockLegacyUsers);

      expect(result.success).toBe(false);
      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('migrateRideHistory', () => {
    it('should successfully migrate ride data', async () => {
      // Mock no existing ride
      rideModel.findById.mockResolvedValue(null);
      // Mock user exists
      userModel.findById.mockResolvedValue({
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      });

      const result = await service.migrateRideHistory(mockLegacyRides);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(rideModel).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: expect.any(Types.ObjectId),
          status: 'COMPLETED',
          vehicle_type: 'EMERGENCY', // Should map AMBULANCE to EMERGENCY
        }),
      );
    });

    it('should skip existing rides', async () => {
      rideModel.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439021' });

      const result = await service.migrateRideHistory(mockLegacyRides);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(rideModel).not.toHaveBeenCalled();
    });

    it('should handle missing user error', async () => {
      rideModel.findById.mockResolvedValue(null);
      userModel.findById.mockResolvedValue(null); // User not found

      const result = await service.migrateRideHistory(mockLegacyRides);

      expect(result.success).toBe(false);
      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors && result.errors[0]).toContain('User not found');
    });
  });

  describe('createGeospatialIndexes', () => {
    it('should successfully create geospatial indexes', async () => {
      userModel.collection.createIndex.mockResolvedValue(true);
      rideModel.collection.createIndex.mockResolvedValue(true);
      sessionModel.collection.createIndex.mockResolvedValue(true);

      const result = await service.createGeospatialIndexes();

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(userModel.collection.createIndex).toHaveBeenCalledWith({
        location: '2dsphere',
      });
      expect(userModel.collection.createIndex).toHaveBeenCalledWith({
        location: '2dsphere',
        role: 1,
        is_online: 1,
        approval: 1,
      });
    });

    it('should handle index creation errors', async () => {
      userModel.collection.createIndex.mockRejectedValue(
        new Error('Index creation failed'),
      );

      const result = await service.createGeospatialIndexes();

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors && result.errors[0]).toContain(
        'Index creation failed',
      );
    });
  });

  describe('migrateLocationData', () => {
    it('should successfully migrate location data to GeoJSON format', async () => {
      const mockUsers = [
        {
          _id: new Types.ObjectId(),
          latitude: 37.7749,
          longitude: -122.4194,
        },
      ];

      userModel.find.mockResolvedValue(mockUsers);
      userModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.migrateLocationData();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: mockUsers[0]!._id },
        {
          $set: {
            location: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749], // [longitude, latitude]
            },
            pre_location: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749],
            },
          },
        },
      );
    });

    it('should skip users with invalid coordinates', async () => {
      const mockUsers = [
        {
          _id: new Types.ObjectId(),
          latitude: 200, // Invalid latitude
          longitude: -122.4194,
        },
      ];

      userModel.find.mockResolvedValue(mockUsers);

      const result = await service.migrateLocationData();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('validateMigration', () => {
    it('should validate migration successfully with no issues', async () => {
      userModel.countDocuments.mockResolvedValue(0);
      rideModel.aggregate.mockResolvedValue([]);
      userModel.aggregate.mockResolvedValue([]);

      const result = await service.validateMigration();

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect validation issues', async () => {
      userModel.countDocuments.mockResolvedValue(5); // Users with invalid location
      rideModel.aggregate.mockResolvedValue([{ count: 3 }]); // Rides with invalid users
      userModel.aggregate.mockResolvedValue([{ count: 2 }]); // Duplicate users

      const result = await service.validateMigration();

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(3);
      expect(result.issues[0]).toContain('invalid location data');
      expect(result.issues[1]).toContain('reference non-existent users');
      expect(result.issues[2]).toContain('duplicate user records');
    });
  });

  describe('mapLegacyRideStatus', () => {
    it('should map legacy ride statuses correctly', async () => {
      // Test the private method through migrateRideHistory
      const legacyRide = {
        ...mockLegacyRides[0],
        status: 'PENDING',
      };

      rideModel.findById.mockResolvedValue(null);
      userModel.findById.mockResolvedValue({ _id: new Types.ObjectId() });

      await service.migrateRideHistory([legacyRide]);

      expect(rideModel).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REQUESTED', // PENDING should map to REQUESTED
        }),
      );
    });
  });

  describe('runAllMigrations', () => {
    it('should run all migrations in sequence', async () => {
      // Mock all methods to succeed
      userModel.collection.createIndex.mockResolvedValue(true);
      rideModel.collection.createIndex.mockResolvedValue(true);
      sessionModel.collection.createIndex.mockResolvedValue(true);
      userModel.find.mockResolvedValue([]);
      userModel.findOne.mockResolvedValue(null);
      rideModel.findById.mockResolvedValue(null);
      userModel.findById.mockResolvedValue({ _id: new Types.ObjectId() });

      const results = await service.runAllMigrations({
        users: mockLegacyUsers,
        rides: mockLegacyRides,
      });

      expect(results).toHaveLength(4); // indexes, location, users, rides
      expect(results.every((result) => result.success)).toBe(true);
    });
  });
});
