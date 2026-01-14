/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RewardsService } from './rewards.service';
import { AchievementService } from './achievement.service';
import { CommunityStatsService } from './community-stats.service';
import { User, UserDocument } from './entities/user.entity';
import { modelDefinitions } from './entities';
import { commonModelDefinitions } from '../entities';
import {
  DriverRide,
  DriverRideSchema,
} from '../driver/entities/driver-ride.entity';

describe('Ambulance Assistance Integration', () => {
  let rewardsService: RewardsService;
  let achievementService: AchievementService;
  let communityStatsService: CommunityStatsService;
  let userModel: Model<UserDocument>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(
          'mongodb://localhost:27017/test-ambulance-assistance',
        ),
        MongooseModule.forFeature([
          ...modelDefinitions,
          ...commonModelDefinitions,
          { name: DriverRide.name, schema: DriverRideSchema },
        ]),
      ],
      providers: [RewardsService, AchievementService, CommunityStatsService],
    }).compile();

    rewardsService = module.get<RewardsService>(RewardsService);
    achievementService = module.get<AchievementService>(AchievementService);
    communityStatsService = module.get<CommunityStatsService>(
      CommunityStatsService,
    );
    userModel = module.get<Model<UserDocument>>('UserModel');

    // Initialize default achievements
    await achievementService.initializeDefaultAchievements();
  });

  afterAll(async () => {
    await module.close();
  });

  // Helper function to create a test user
  const createTestUser = async (userId: string) => {
    const user = new userModel({
      _id: new Types.ObjectId(userId),
      first_name: 'Test',
      last_name: 'User',
      email: `test-${userId}@example.com`,
      country_code: '+91',
      phone_number: '9876543210',
      password: 'hashedpassword',
      role: 'USER',
      loyalty_point: 0,
      metadata: {},
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    await user.save();
    return user;
  };

  it('should track ambulance assistance and award points', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    const assistRecord = await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716], // Bangalore coordinates
      'successful',
    );

    expect(assistRecord).toBeDefined();
    expect(assistRecord.userId).toBe(userId);
    expect(assistRecord.assistType).toBe('navigation');
    expect(assistRecord.outcome).toBe('successful');
    expect(assistRecord.pointsEarned).toBe(10); // Navigation assistance points
    expect(assistRecord.location).toEqual([77.5946, 12.9716]);
  });

  it('should track different types of assistance with different points', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Emergency contact assistance (15 points)
    const emergencyAssist = await rewardsService.trackAmbulanceAssistance(
      userId,
      'emergency_contact',
      [77.5946, 12.9716],
      'successful',
    );
    expect(emergencyAssist.pointsEarned).toBe(15);

    // Facility info assistance (5 points)
    const facilityAssist = await rewardsService.trackAmbulanceAssistance(
      userId,
      'facility_info',
      [77.5946, 12.9716],
      'successful',
    );
    expect(facilityAssist.pointsEarned).toBe(5);

    // Cancelled assistance (0 points)
    const cancelledAssist = await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716],
      'cancelled',
    );
    expect(cancelledAssist.pointsEarned).toBe(0);
  });

  it('should retrieve user ambulance assistance history', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track some assistance
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716],
      'successful',
    );
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'emergency_contact',
      [77.5946, 12.9716],
      'successful',
    );

    const assists = await rewardsService.getUserAmbulanceAssists(userId);

    expect(assists).toBeDefined();
    expect(Array.isArray(assists)).toBe(true);
    expect(assists.length).toBeGreaterThanOrEqual(2);

    // Check that assists are sorted by timestamp (most recent first)
    if (assists.length > 1) {
      expect(new Date(assists[0]!.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(assists[1]!.timestamp).getTime(),
      );
    }
  });

  it('should include ambulance assists in rewards history', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track some assistance
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716],
      'successful',
    );

    const history = await rewardsService.getUserRewardsHistory(userId);

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);

    // Should include ambulance assists
    const ambulanceAssists = history.filter(
      (item) => item.action === 'ambulance_assist',
    );
    expect(ambulanceAssists.length).toBeGreaterThan(0);

    const assist = ambulanceAssists[0];
    expect(assist).toBeDefined();
    expect(assist!.points).toBe(10); // Navigation assistance points
    expect(assist!.description).toContain('navigation');
    expect(assist!.metadata.assistType).toBe('navigation');
  });

  it('should update achievement progress when tracking assistance', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track assistance to trigger achievement progress
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716],
      'successful',
    );

    const achievements = await achievementService.getUserAchievements(userId);

    expect(achievements).toBeDefined();
    expect(Array.isArray(achievements)).toBe(true);

    // Should have some progress on ambulance-related achievements
    const ambulanceAchievements = achievements.filter(
      (a) =>
        a.requirements.action === 'ambulance_assist' ||
        a.requirements.action === 'navigation_assist',
    );

    expect(ambulanceAchievements.length).toBeGreaterThan(0);

    // At least one achievement should have progress > 0
    const hasProgress = ambulanceAchievements.some((a) => a.progress > 0);
    expect(hasProgress).toBe(true);
  });

  it('should include assistance data in community stats', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track some assistance
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716],
      'successful',
    );
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'emergency_contact',
      [77.5946, 12.9716],
      'successful',
    );

    const stats = await communityStatsService.getCommunityStats();

    expect(stats).toBeDefined();
    expect(stats.total_ambulance_assists).toBeGreaterThanOrEqual(2);
    expect(stats.assists_by_type.navigation).toBeGreaterThanOrEqual(1);
    expect(stats.assists_by_type.emergency_contact).toBeGreaterThanOrEqual(1);
  });
});
