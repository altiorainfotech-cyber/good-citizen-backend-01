import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunityStatsService } from './community-stats.service';
import { modelDefinitions } from './entities';

describe('CommunityStatsService', () => {
  let service: CommunityStatsService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(
          'mongodb://localhost:27017/test-community-stats',
        ),
        MongooseModule.forFeature(modelDefinitions),
      ],
      providers: [CommunityStatsService],
    }).compile();

    service = module.get<CommunityStatsService>(CommunityStatsService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get community stats', async () => {
    const stats = await service.getCommunityStats();

    expect(stats).toBeDefined();
    expect(typeof stats.total_users).toBe('number');
    expect(typeof stats.active_users_last_30_days).toBe('number');
    expect(typeof stats.total_ambulance_assists).toBe('number');
    expect(typeof stats.total_points_earned).toBe('number');
    expect(typeof stats.total_points_redeemed).toBe('number');
    expect(typeof stats.total_achievements_unlocked).toBe('number');
    expect(Array.isArray(stats.top_contributors)).toBe(true);
    expect(typeof stats.assists_by_type).toBe('object');
    expect(typeof stats.monthly_growth).toBe('object');
  });

  it('should get user leaderboard', async () => {
    const leaderboard = await service.getUserLeaderboard(10);

    expect(leaderboard).toBeDefined();
    expect(Array.isArray(leaderboard)).toBe(true);
  });

  it('should get platform metrics', async () => {
    const metrics = await service.getPlatformMetrics();

    expect(metrics).toBeDefined();
    expect(typeof metrics.total_emergency_responses).toBe('number');
    expect(typeof metrics.average_response_time).toBe('number');
    expect(typeof metrics.user_satisfaction_score).toBe('number');
    expect(typeof metrics.community_impact_score).toBe('number');
  });
});
