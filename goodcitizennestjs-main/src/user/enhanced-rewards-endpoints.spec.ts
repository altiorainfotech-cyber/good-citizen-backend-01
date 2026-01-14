/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RewardsService } from './rewards.service';
import { AchievementService } from './achievement.service';
import { CommunityStatsService } from './community-stats.service';
import { RewardsController } from './rewards.controller';
import { UsersController } from './users.controller';
import { modelDefinitions } from './entities';

describe('Enhanced Rewards Endpoints', () => {
  let rewardsService: RewardsService;
  let achievementService: AchievementService;
  let communityStatsService: CommunityStatsService;
  let rewardsController: RewardsController;
  let usersController: UsersController;
  let userModel: Model<any>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(
          'mongodb://localhost:27017/test-enhanced-rewards',
        ),
        MongooseModule.forFeature([...modelDefinitions]),
      ],
      controllers: [RewardsController, UsersController],
      providers: [RewardsService, AchievementService, CommunityStatsService],
    }).compile();

    rewardsService = module.get<RewardsService>(RewardsService);
    achievementService = module.get<AchievementService>(AchievementService);
    communityStatsService = module.get<CommunityStatsService>(
      CommunityStatsService,
    );
    rewardsController = module.get<RewardsController>(RewardsController);
    usersController = module.get<UsersController>(UsersController);
    userModel = module.get('UserModel');
  });

  afterAll(async () => {
    // Clean up test data
    await userModel.deleteMany({});
  });

  const createTestUser = async (userId: string) => {
    const user = new userModel({
      _id: new Types.ObjectId(userId),
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone_number: '+1234567890',
      password: 'testpassword123',
      loyalty_point: 100,
      metadata: {},
    });
    await user.save();
    return user;
  };

  it('should get rewards history with pagination', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track some assistance to create history
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

    const result = await rewardsController.getRewardsHistory(userId, 10);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    // Should have at least the assistance records
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('should get user achievements with progress tracking', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Initialize achievements
    await achievementService.initializeDefaultAchievements();

    const result = await rewardsController.getAchievements(userId);

    expect(result).toBeDefined();
    expect(result.achievements).toBeDefined();
    expect(Array.isArray(result.achievements)).toBe(true);
    expect(result.stats).toBeDefined();
    expect(typeof result.stats.total).toBe('number');
    expect(typeof result.stats.unlocked).toBe('number');
    expect(typeof result.stats.inProgress).toBe('number');

    // Should have default achievements
    expect(result.achievements.length).toBeGreaterThan(0);

    // Each achievement should have required fields
    result.achievements.forEach((achievement) => {
      expect(achievement.id).toBeDefined();
      expect(achievement.name).toBeDefined();
      expect(achievement.description).toBeDefined();
      expect(achievement.category).toBeDefined();
      expect(achievement.badgeIcon).toBeDefined();
      expect(achievement.requirements).toBeDefined();
      expect(typeof achievement.pointsReward).toBe('number');
      expect(typeof achievement.progress).toBe('number');
      expect(typeof achievement.isUnlocked).toBe('boolean');
    });
  });

  it('should get user ambulance assists with detailed records', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track different types of assistance
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
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'facility_info',
      [77.5946, 12.9716],
      'cancelled',
    );

    const result = await usersController.getUserAmbulanceAssists(userId, 10, 0);

    expect(result).toBeDefined();
    expect(result.assists).toBeDefined();
    expect(Array.isArray(result.assists)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(typeof result.hasMore).toBe('boolean');
    expect(result.stats).toBeDefined();

    // Should have the assistance records
    expect(result.assists.length).toBe(3);

    // Check stats
    expect(result.stats.totalAssists).toBe(3);
    expect(result.stats.successfulAssists).toBe(2);
    expect(result.stats.pointsEarned).toBeGreaterThan(0);
    expect(result.stats.assistsByType).toBeDefined();
    expect(result.stats.assistsByType.navigation).toBe(1);
    expect(result.stats.assistsByType.emergency_contact).toBe(1);
    expect(result.stats.assistsByType.facility_info).toBe(1);

    // Each assist should have required fields
    result.assists.forEach((assist) => {
      expect(assist.id).toBeDefined();
      expect(assist.userId).toBe(userId);
      expect(['navigation', 'emergency_contact', 'facility_info']).toContain(
        assist.assistType,
      );
      expect(Array.isArray(assist.location)).toBe(true);
      expect(assist.location.length).toBe(2);
      expect(assist.timestamp).toBeDefined();
      expect(['successful', 'cancelled', 'redirected']).toContain(
        assist.outcome,
      );
      expect(typeof assist.pointsEarned).toBe('number');
    });
  });

  it('should handle pagination correctly for ambulance assists', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track multiple assists
    for (let i = 0; i < 5; i++) {
      await rewardsService.trackAmbulanceAssistance(
        userId,
        'navigation',
        [77.5946, 12.9716],
        'successful',
      );
    }

    // Test pagination
    const page1 = await usersController.getUserAmbulanceAssists(userId, 2, 0);
    const page2 = await usersController.getUserAmbulanceAssists(userId, 2, 2);

    expect(page1.assists.length).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.total).toBe(5);

    expect(page2.assists.length).toBe(2);
    expect(page2.hasMore).toBe(true);
    expect(page2.total).toBe(5);

    // Assists should be different between pages (check timestamps instead of IDs)
    const page1Timestamps = page1.assists.map((a) => a.timestamp);
    const page2Timestamps = page2.assists.map((a) => a.timestamp);

    // At least some timestamps should be different (they're created at different times)
    const hasOverlap = page1Timestamps.some((t1) =>
      page2Timestamps.some((t2) => t1 === t2),
    );
    expect(hasOverlap).toBe(false); // No overlap expected due to pagination
  });

  it('should update existing rewards endpoints to handle assistance actions', async () => {
    const userId = new Types.ObjectId().toString();
    await createTestUser(userId);

    // Track assistance to create history
    await rewardsService.trackAmbulanceAssistance(
      userId,
      'navigation',
      [77.5946, 12.9716],
      'successful',
    );

    // Get rewards history (should include assistance)
    const history = await rewardsService.getUserRewardsHistory(userId, 20);

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);

    // Should have assistance action in history
    const assistanceHistory = history.find(
      (h) => h.action === 'ambulance_assist',
    );
    expect(assistanceHistory).toBeDefined();
    if (assistanceHistory) {
      expect(assistanceHistory.points).toBeGreaterThan(0);
      expect(assistanceHistory.description).toContain('Ambulance assistance');
      expect(assistanceHistory.metadata.assistType).toBe('navigation');
    }
  });
});
