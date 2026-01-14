import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { RewardsService } from './rewards.service';
import { modelDefinitions } from './entities';
import { rideModelDefinitions } from '../ride/entities';

describe('RewardsService Integration', () => {
  let service: RewardsService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot('mongodb://localhost:27017/test-rewards-integration'),
        MongooseModule.forFeature([
          ...modelDefinitions,
          ...rideModelDefinitions,
        ]),
      ],
      providers: [RewardsService],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should track ride completion', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const rideData = {
      ride_id: '507f1f77bcf86cd799439012',
      final_fare: 25.50,
      distance_km: 5.2,
      duration_minutes: 15,
      vehicle_type: 'REGULAR',
      completed_at: new Date(),
    };

    await expect(service.trackRideCompletion(userId, rideData)).resolves.not.toThrow();
  });

  it('should track emergency assist', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const assistData = {
      assist_id: 'assist-123',
      emergency_type: 'AMBULANCE' as const,
      time_saved_seconds: 45,
      location: [-74.006, 40.7128] as [number, number],
      impact_metrics: {
        lives_affected: 1,
        response_time_improvement: 20,
      },
    };

    await expect(service.trackEmergencyAssist(userId, assistData)).resolves.not.toThrow();
  });

  it('should calculate bonus points correctly', () => {
    const impactMetrics = {
      timeSaved: 60,
      livesAffected: 2,
      responseTimeImprovement: 25,
    };

    const bonusPoints = service.calculateBonusPoints(impactMetrics);
    expect(bonusPoints).toBeGreaterThan(0);
    expect(typeof bonusPoints).toBe('number');
  });

  it('should get user rewards history', async () => {
    const userId = '507f1f77bcf86cd799439011';
    
    const history = await service.getUserRewardsHistory(userId, 10);
    expect(Array.isArray(history)).toBe(true);
  });

  it('should get user achievements', async () => {
    const userId = '507f1f77bcf86cd799439011';
    
    const achievements = await service.getUserAchievements(userId);
    expect(Array.isArray(achievements)).toBe(true);
    expect(achievements.length).toBeGreaterThan(0);
  });
});