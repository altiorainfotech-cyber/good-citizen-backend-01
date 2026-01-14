import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AchievementService } from './achievement.service';
import { modelDefinitions } from './entities';

describe('AchievementService', () => {
  let service: AchievementService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot('mongodb://localhost:27017/test-achievements'),
        MongooseModule.forFeature(modelDefinitions),
      ],
      providers: [AchievementService],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize default achievements', async () => {
    await service.initializeDefaultAchievements();
    // Should not throw an error
    expect(true).toBe(true);
  });

  it('should get user achievements', async () => {
    const userId = new Types.ObjectId().toString();
    const achievements = await service.getUserAchievements(userId);

    expect(achievements).toBeDefined();
    expect(Array.isArray(achievements)).toBe(true);
  });

  it('should update user progress', async () => {
    const userId = new Types.ObjectId().toString();

    // Should not throw an error
    await service.updateUserProgress(userId, 'ambulance_assist', 1);
    expect(true).toBe(true);
  });

  it('should get achievement stats', async () => {
    const stats = await service.getAchievementStats();

    expect(stats).toBeDefined();
    expect(typeof stats.total_achievements).toBe('number');
    expect(typeof stats.total_unlocked).toBe('number');
    expect(typeof stats.achievements_by_category).toBe('object');
    expect(Array.isArray(stats.most_popular_achievements)).toBe(true);
  });
});
