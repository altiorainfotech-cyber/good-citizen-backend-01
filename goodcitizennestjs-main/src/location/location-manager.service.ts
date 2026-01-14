import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserLocation, UserLocationDocument } from './entities/user-location.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationResponseDto } from './dto/location-response.dto';

export interface LocationData {
  userId: string;
  coordinates: [number, number]; // [longitude, latitude]
  accuracy: number;
  timestamp: Date;
  source: 'gps' | 'network' | 'manual';
}

@Injectable()
export class LocationManagerService {
  constructor(
    @InjectModel(UserLocation.name)
    private userLocationModel: Model<UserLocationDocument>,
  ) {}

  async updateUserLocation(locationData: LocationData): Promise<void> {
    try {
      // Validate coordinates
      const [longitude, latitude] = locationData.coordinates;
      if (longitude < -180 || longitude > 180) {
        throw new BadRequestException('Invalid longitude: must be between -180 and 180');
      }
      if (latitude < -90 || latitude > 90) {
        throw new BadRequestException('Invalid latitude: must be between -90 and 90');
      }

      // Deactivate previous locations for this user
      await this.userLocationModel.updateMany(
        { userId: new Types.ObjectId(locationData.userId), isActive: true },
        { isActive: false, updated_at: Date.now() }
      );

      // Create new location record
      const newLocation = new this.userLocationModel({
        userId: new Types.ObjectId(locationData.userId),
        coordinates: {
          type: 'Point',
          coordinates: locationData.coordinates,
        },
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp,
        source: locationData.source,
        isActive: true,
      });

      await newLocation.save();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update user location');
    }
  }

  async getUserLastLocation(userId: string): Promise<LocationResponseDto | null> {
    try {
      const location = await this.userLocationModel
        .findOne({ 
          userId: new Types.ObjectId(userId), 
          isActive: true 
        })
        .sort({ timestamp: -1 })
        .exec();

      if (!location) {
        return null;
      }

      return {
        userId: location.userId.toString(),
        coordinates: location.coordinates,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        source: location.source,
        isActive: location.isActive,
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve user location');
    }
  }

  async trackLocationHistory(userId: string, limit: number = 10): Promise<LocationResponseDto[]> {
    try {
      const locations = await this.userLocationModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      return locations.map(location => ({
        userId: location.userId.toString(),
        coordinates: location.coordinates,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        source: location.source,
        isActive: location.isActive,
      }));
    } catch (error) {
      throw new BadRequestException('Failed to retrieve location history');
    }
  }

  async updateLocationFromDto(userId: string, updateLocationDto: UpdateLocationDto): Promise<void> {
    const locationData: LocationData = {
      userId,
      coordinates: [updateLocationDto.longitude, updateLocationDto.latitude],
      accuracy: updateLocationDto.accuracy,
      timestamp: new Date(),
      source: updateLocationDto.source as 'gps' | 'network' | 'manual',
    };

    await this.updateUserLocation(locationData);
  }
}