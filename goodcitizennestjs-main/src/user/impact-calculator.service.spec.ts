import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ImpactCalculatorService } from './impact-calculator.service';
import { AssistImpact, AssistImpactDocument } from './entities/assist-impact.entity';
import { EmergencyRequest, EmergencyRequestDocument } from '../entities/emergency-request.entity';
import { User, UserDocument } from './entities/user.entity';
import { modelDefinitions } from './entities';
import { commonModelDefinitions } from '../entities';

describe('ImpactCalculatorService', () => {
  let service: ImpactCalculatorService;
  let assistImpactModel: Model<AssistImpactDocument>;
  let emergencyRequestModel: Model<EmergencyRequestDocument>;
  let userModel: Model<UserDocument>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot('mongodb://localhost:27017/test-impact-calculator'),
        MongooseModule.forFeature([
          ...modelDefinitions,
          ...commonModelDefinitions,
        ]),
      ],
      providers: [ImpactCalculatorService],
    }).compile();

    service = module.get<ImpactCalculatorService>(ImpactCalculatorService);
    assistImpactModel = module.get<Model<AssistImpactDocument>>('AssistImpactModel');
    emergencyRequestModel = module.get<Model<EmergencyRequestDocument>>('EmergencyRequestModel');
    userModel = module.get<Model<UserDocument>>('UserModel');
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await assistImpactModel.deleteMany({});
    await emergencyRequestModel.deleteMany({});
    await userModel.deleteMany({});
  });

  // Helper function to create a test user
  const createTestUser = async (userId?: string) => {
    const id = userId ? new Types.ObjectId(userId) : new Types.ObjectId();
    const user = new userModel({
      _id: id,
      first_name: 'Test',
      last_name: 'User',
      email: `test-${id}@example.com`,
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

  // Helper function to create a test emergency request
  const createTestEmergencyRequest = async (userId: Types.ObjectId, status = 'completed') => {
    const emergencyRequest = new emergencyRequestModel({
      userId,
      emergencyType: 'ambulance',
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716], // Bangalore coordinates
      },
      address: 'Test Address, Bangalore',
      status,
      priority: 'high',
      description: 'Test emergency request',
      estimatedResponseTime: 30, // 30 minutes
      actualResponseTime: 20, // 20 minutes
      assignedAt: new Date(Date.now() - 1200000), // 20 minutes ago
      completedAt: new Date(),
    });
    const savedRequest = await emergencyRequest.save();
    return savedRequest;
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate impact metrics for a completed assist', async () => {
    const user = await createTestUser();
    const emergencyRequest = await createTestEmergencyRequest(user._id);

    const impact = await service.calculateAssistImpact((emergencyRequest as any)._id.toString());

    expect(impact).toBeDefined();
    expect(impact.timeSaved).toBeGreaterThanOrEqual(0);
    expect(impact.livesAffected).toBeGreaterThan(0);
    expect(impact.responseTimeImprovement).toBeGreaterThanOrEqual(0);
    expect(impact.communityContribution).toBeGreaterThan(0);
  });

  it('should return existing impact if already calculated', async () => {
    const user = await createTestUser();
    const emergencyRequest = await createTestEmergencyRequest(user._id);

    // Calculate impact first time
    const impact1 = await service.calculateAssistImpact((emergencyRequest as any)._id.toString());
    
    // Calculate impact second time - should return same result
    const impact2 = await service.calculateAssistImpact((emergencyRequest as any)._id.toString());

    // Compare the metrics, not the full objects (which may include _id)
    expect(impact1.timeSaved).toEqual(impact2.timeSaved);
    expect(impact1.livesAffected).toEqual(impact2.livesAffected);
    expect(impact1.responseTimeImprovement).toEqual(impact2.responseTimeImprovement);
    expect(impact1.communityContribution).toEqual(impact2.communityContribution);
  });

  it('should throw error for non-existent assist', async () => {
    const nonExistentId = new Types.ObjectId().toString();

    await expect(service.calculateAssistImpact(nonExistentId))
      .rejects
      .toThrow('Emergency request');
  });

  it('should throw error for incomplete assist', async () => {
    const user = await createTestUser();
    const emergencyRequest = await createTestEmergencyRequest(user._id, 'pending');

    await expect(service.calculateAssistImpact((emergencyRequest as any)._id.toString()))
      .rejects
      .toThrow('Cannot calculate impact for incomplete assist');
  });

  it('should aggregate user impact correctly', async () => {
    const user = await createTestUser();
    
    // Create multiple emergency requests
    const request1 = await createTestEmergencyRequest(user._id);
    const request2 = await createTestEmergencyRequest(user._id);

    // Calculate impacts
    await service.calculateAssistImpact((request1 as any)._id.toString());
    await service.calculateAssistImpact((request2 as any)._id.toString());

    const summary = await service.aggregateUserImpact(user._id.toString());

    expect(summary.totalAssists).toBe(2);
    expect(summary.totalTimeSaved).toBeGreaterThan(0);
    expect(summary.totalLivesAffected).toBeGreaterThan(0);
    expect(summary.totalCommunityContribution).toBeGreaterThan(0);
    expect(summary.impactsByType.ambulance).toBe(2);
  });

  it('should return empty summary for user with no assists', async () => {
    const user = await createTestUser();

    const summary = await service.aggregateUserImpact(user._id.toString());

    expect(summary.totalAssists).toBe(0);
    expect(summary.totalTimeSaved).toBe(0);
    expect(summary.totalLivesAffected).toBe(0);
    expect(summary.totalCommunityContribution).toBe(0);
    expect(Object.keys(summary.impactsByType)).toHaveLength(0);
  });

  it('should get community impact stats', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    // Create emergency requests for both users
    const request1 = await createTestEmergencyRequest(user1._id);
    const request2 = await createTestEmergencyRequest(user2._id);

    // Calculate impacts
    await service.calculateAssistImpact((request1 as any)._id.toString());
    await service.calculateAssistImpact((request2 as any)._id.toString());

    const stats = await service.getCommunityImpactStats();

    expect(stats.totalAssists).toBe(2);
    expect(stats.totalTimeSaved).toBeGreaterThan(0);
    expect(stats.totalLivesAffected).toBeGreaterThan(0);
    expect(stats.totalCommunityContribution).toBeGreaterThan(0);
    expect(stats.topContributors).toHaveLength(2);
  });

  it('should complete assist and calculate impact', async () => {
    const user = await createTestUser();
    const emergencyRequest = await createTestEmergencyRequest(user._id, 'in_progress');

    const result = await service.completeAssist(
      (emergencyRequest as any)._id.toString(),
      user._id.toString(),
    );

    expect(result.success).toBe(true);
    expect(result.impact).toBeDefined();
    expect(result.message).toContain('completed');

    // Verify the emergency request was updated
    const updatedRequest = await emergencyRequestModel.findById((emergencyRequest as any)._id);
    expect(updatedRequest?.status).toBe('completed');
    expect(updatedRequest?.completedAt).toBeDefined();
  });

  it('should throw error when unauthorized user tries to complete assist', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const emergencyRequest = await createTestEmergencyRequest(user1._id, 'in_progress');

    await expect(service.completeAssist(
      (emergencyRequest as any)._id.toString(),
      user2._id.toString(),
    )).rejects.toThrow('User not authorized');
  });
});