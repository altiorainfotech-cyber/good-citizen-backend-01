/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { RewardsService } from '../user/rewards.service';
import { LoyaltyPointsService } from '../user/loyalty-points.service';
import { modelDefinitions } from '../user/entities';
import { commonModelDefinitions } from '../entities';
import {
  DriverRide,
  DriverRideSchema,
} from '../driver/entities/driver-ride.entity';

describe('Rewards Integration', () => {
  let rewardsService: RewardsService;
  let loyaltyPointsService: LoyaltyPointsService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot('mongodb://localhost:27017/test-rewards'),
        MongooseModule.forFeature([
          ...modelDefinitions,
          ...commonModelDefinitions,
          { name: DriverRide.name, schema: DriverRideSchema },
        ]),
      ],
      providers: [RewardsService, LoyaltyPointsService],
    }).compile();

    rewardsService = module.get<RewardsService>(RewardsService);
    loyaltyPointsService =
      module.get<LoyaltyPointsService>(LoyaltyPointsService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should initialize reward catalog', async () => {
    const userId = 'test-user-123';
    const catalog = await rewardsService.getRewardsCatalog(userId);
    expect(catalog).toBeDefined();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('should validate point balance for redemption', async () => {
    const userId = 'test-user-123';

    // Mock insufficient balance scenario
    try {
      await rewardsService.redeemReward({
        user_id: userId,
        reward_id: 'test-reward-123',
      });
      fail('Should have thrown insufficient balance error');
    } catch (error: any) {
      expect(error.message).toMatch(/insufficient|balance|points/i);
    }
  });

  it('should track redemption history', async () => {
    const userId = 'test-user-456';

    const history = await rewardsService.getUserRedemptionHistory(userId);
    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
  });
});
