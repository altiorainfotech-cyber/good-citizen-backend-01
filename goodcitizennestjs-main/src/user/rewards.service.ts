/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/require-await */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { Reward, RewardDocument } from './entities/reward.entity';
import {
  PointRedemption,
  PointRedemptionDocument,
} from './entities/point-redemption.entity';
import { LoyaltyPoint, LoyaltyPointDocument } from './entities/loyalty-point.entity';
import { Ride, RideDocument } from '../ride/entities/ride.entity';
import { v4 as uuidv4 } from 'uuid';

export interface ActivityTracker {
  trackRideCompletion(userId: string, rideData: RideData): Promise<void>;
  trackEmergencyAssist(userId: string, assistData: AssistData): Promise<void>;
  trackAchievementUnlock(userId: string, achievement: Achievement): Promise<void>;
}

export interface RideData {
  ride_id: string;
  final_fare: number;
  distance_km: number;
  duration_minutes: number;
  vehicle_type: string;
  completed_at: Date;
}

export interface AssistData {
  assist_id: string;
  emergency_type: 'AMBULANCE' | 'FIRE' | 'POLICE';
  time_saved_seconds: number;
  location: [number, number];
  impact_metrics?: {
    lives_affected: number;
    response_time_improvement: number;
  };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  points_awarded: number;
  category: string;
}

export interface UserActivity {
  user_id: string;
  activity_type: 'RIDE_COMPLETION' | 'EMERGENCY_ASSIST' | 'ACHIEVEMENT_UNLOCK';
  activity_data: RideData | AssistData | Achievement;
  points_earned: number;
  timestamp: Date;
}

export interface RedeemRewardRequest {
  user_id: string;
  reward_id: string;
}

export interface RedemptionResult {
  redemption_id: string;
  redemption_code: string;
  reward_name: string;
  points_spent: number;
  status: string;
  expires_at?: Date;
  instructions: string;
}

export interface RewardCatalogItem {
  reward_id: string;
  name: string;
  description: string;
  points_required: number;
  category: string;
  value: string;
  is_available: boolean;
  user_can_redeem: boolean;
  user_redemption_count?: number;
  remaining_stock?: number;
}

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Reward.name) private rewardModel: Model<RewardDocument>,
    @InjectModel(PointRedemption.name)
    private pointRedemptionModel: Model<PointRedemptionDocument>,
    @InjectModel(LoyaltyPoint.name)
    private loyaltyPointModel: Model<LoyaltyPointDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
  ) {}

  /**
   * Initialize default rewards catalog
   */
  async initializeDefaultRewards(): Promise<void> {
    try {
      const existingRewards = await this.rewardModel.countDocuments();
      if (existingRewards > 0) {
        this.logger.log('Rewards catalog already initialized');
        return;
      }

      const defaultRewards = [
        {
          reward_id: 'discount_10_percent',
          name: '10% Ride Discount',
          description: 'Get 10% off your next ride',
          points_required: 50,
          category: 'DISCOUNT',
          value: '10% off next ride',
          details: {
            terms:
              'Valid for one ride only. Cannot be combined with other offers.',
            restrictions: [
              'Valid for 30 days from redemption',
              'Maximum discount $10',
            ],
            how_to_use: 'Enter redemption code during checkout',
          },
        },
        {
          reward_id: 'free_ride_small',
          name: 'Free Short Ride',
          description: 'Free ride up to $15',
          points_required: 100,
          category: 'FREE_RIDE',
          value: 'Free ride up to $15',
          details: {
            terms: 'Valid for rides up to $15. User pays any amount over $15.',
            restrictions: [
              'Valid for 60 days from redemption',
              'One per user per month',
            ],
            how_to_use: 'Enter redemption code when booking ride',
          },
          max_redemptions_per_user: 1,
        },
        {
          reward_id: 'discount_25_percent',
          name: '25% Ride Discount',
          description: 'Get 25% off your next ride',
          points_required: 150,
          category: 'DISCOUNT',
          value: '25% off next ride',
          details: {
            terms:
              'Valid for one ride only. Cannot be combined with other offers.',
            restrictions: [
              'Valid for 30 days from redemption',
              'Maximum discount $25',
            ],
            how_to_use: 'Enter redemption code during checkout',
          },
        },
        {
          reward_id: 'free_ride_medium',
          name: 'Free Medium Ride',
          description: 'Free ride up to $30',
          points_required: 250,
          category: 'FREE_RIDE',
          value: 'Free ride up to $30',
          details: {
            terms: 'Valid for rides up to $30. User pays any amount over $30.',
            restrictions: [
              'Valid for 90 days from redemption',
              'One per user per month',
            ],
            how_to_use: 'Enter redemption code when booking ride',
          },
          max_redemptions_per_user: 1,
        },
        {
          reward_id: 'charity_donation',
          name: 'Charity Donation',
          description: 'Donate $10 to local emergency services',
          points_required: 75,
          category: 'DONATION',
          value: '$10 donation to emergency services',
          details: {
            terms:
              'Donation will be made on your behalf to local emergency services.',
            restrictions: ['Tax receipt available upon request'],
            how_to_use: 'Donation processed automatically upon redemption',
          },
        },
        {
          reward_id: 'good_citizen_tshirt',
          name: 'Good Citizen T-Shirt',
          description: 'Official Good Citizen branded t-shirt',
          points_required: 200,
          category: 'MERCHANDISE',
          value: 'Good Citizen T-Shirt',
          total_available: 100,
          details: {
            terms: 'T-shirt will be shipped to your registered address.',
            restrictions: [
              'Allow 2-3 weeks for delivery',
              'Available sizes: S, M, L, XL',
            ],
            how_to_use:
              'Contact support with redemption code to arrange delivery',
          },
        },
      ];

      await this.rewardModel.insertMany(defaultRewards);
      this.logger.log(`Initialized ${defaultRewards.length} default rewards`);
    } catch (error: any) {
      this.logger.error(`Error initializing default rewards: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available rewards catalog for a user
   */
  async getRewardsCatalog(userId: string): Promise<RewardCatalogItem[]> {
    try {
      const user = await this.userModel.findById(userId).lean();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userPoints = user.loyalty_point || 0;

      // Get all active rewards
      const rewards = await this.rewardModel.find({ is_active: true }).lean();

      // Get user's redemption history for checking limits
      const userRedemptions = await this.pointRedemptionModel
        .find({
          user_id: new Types.ObjectId(userId),
          status: { $in: ['PENDING', 'APPROVED', 'FULFILLED'] },
        })
        .lean();

      const catalog: RewardCatalogItem[] = [];

      for (const reward of rewards) {
        // Check if reward is still available (not expired, has stock)
        const isExpired = reward.expires_at && reward.expires_at < new Date();
        const isOutOfStock =
          reward.total_available &&
          reward.total_redeemed >= reward.total_available;
        const isAvailable = !isExpired && !isOutOfStock;

        // Check user-specific eligibility
        const userRedemptionCount = userRedemptions.filter(
          (r) => r.reward_id.toString() === reward._id.toString(),
        ).length;

        const hasReachedUserLimit =
          reward.max_redemptions_per_user &&
          userRedemptionCount >= reward.max_redemptions_per_user;

        const userCanRedeem =
          isAvailable &&
          userPoints >= reward.points_required &&
          !hasReachedUserLimit;

        catalog.push({
          reward_id: reward.reward_id,
          name: reward.name,
          description: reward.description,
          points_required: reward.points_required,
          category: reward.category,
          value: reward.value,
          is_available: isAvailable,
          user_can_redeem: userCanRedeem,
          user_redemption_count: userRedemptionCount,
          ...(reward.total_available && {
            remaining_stock: Math.max(
              0,
              reward.total_available - reward.total_redeemed,
            ),
          }),
        });
      }

      // Sort by points required (ascending)
      catalog.sort((a, b) => a.points_required - b.points_required);

      return catalog;
    } catch (error: any) {
      this.logger.error(`Error getting rewards catalog: ${error.message}`);
      throw error;
    }
  }

  /**
   * Redeem a reward for points
   */
  async redeemReward(request: RedeemRewardRequest): Promise<RedemptionResult> {
    try {
      this.logger.log(
        `Processing reward redemption for user ${request.user_id}, reward ${request.reward_id}`,
      );

      // Get user and validate points balance
      const user = await this.userModel.findById(request.user_id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get reward details
      const reward = await this.rewardModel.findOne({
        reward_id: request.reward_id,
        is_active: true,
      });
      if (!reward) {
        throw new NotFoundException('Reward not found or inactive');
      }

      // Validate user has enough points
      const userPoints = user.loyalty_point || 0;
      if (userPoints < reward.points_required) {
        throw new BadRequestException(
          `Insufficient points. Required: ${reward.points_required}, Available: ${userPoints}`,
        );
      }

      // Check reward availability
      const isExpired = reward.expires_at && reward.expires_at < new Date();
      if (isExpired) {
        throw new BadRequestException('Reward has expired');
      }

      const isOutOfStock =
        reward.total_available &&
        reward.total_redeemed >= reward.total_available;
      if (isOutOfStock) {
        throw new BadRequestException('Reward is out of stock');
      }

      // Check user redemption limits
      if (reward.max_redemptions_per_user) {
        const userRedemptionCount =
          await this.pointRedemptionModel.countDocuments({
            user_id: new Types.ObjectId(request.user_id),
            reward_id: reward._id,
            status: { $in: ['PENDING', 'APPROVED', 'FULFILLED'] },
          });

        if (userRedemptionCount >= reward.max_redemptions_per_user) {
          throw new BadRequestException(
            'User has reached maximum redemptions for this reward',
          );
        }
      }

      // Generate unique redemption code
      const redemptionCode = this.generateRedemptionCode();

      // Calculate expiration date (default 90 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      // Create redemption record
      const redemption = new this.pointRedemptionModel({
        user_id: new Types.ObjectId(request.user_id),
        reward_id: reward._id,
        points_spent: reward.points_required,
        status: 'PENDING',
        redemption_code: redemptionCode,
        expires_at: expiresAt,
        reward_snapshot: {
          reward_name: reward.name,
          reward_value: reward.value,
          reward_category: reward.category,
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await redemption.save();

      // Deduct points from user
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(request.user_id) },
        {
          $inc: { loyalty_point: -reward.points_required },
          $set: { updated_at: Date.now() },
        },
      );

      // Update reward redemption count
      await this.rewardModel.updateOne(
        { _id: reward._id },
        {
          $inc: { total_redeemed: 1 },
          $set: { updated_at: Date.now() },
        },
      );

      this.logger.log(
        `Reward redeemed successfully: ${redemptionCode} for user ${request.user_id}`,
      );

      return {
        redemption_id: redemption._id.toString(),
        redemption_code: redemptionCode,
        reward_name: reward.name,
        points_spent: reward.points_required,
        status: 'PENDING',
        expires_at: expiresAt,
        instructions: reward.details.how_to_use,
      };
    } catch (error: any) {
      this.logger.error(`Error redeeming reward: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's redemption history
   */
  async getUserRedemptionHistory(
    userId: string,
    limit: number = 20,
  ): Promise<any[]> {
    try {
      const redemptions = await this.pointRedemptionModel
        .find({
          user_id: new Types.ObjectId(userId),
        })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();

      return redemptions.map((redemption) => ({
        redemption_id: redemption._id.toString(),
        redemption_code: redemption.redemption_code,
        reward_name: redemption.reward_snapshot.reward_name,
        reward_value: redemption.reward_snapshot.reward_value,
        points_spent: redemption.points_spent,
        status: redemption.status,
        redeemed_at: new Date(redemption.created_at),
        expires_at: redemption.expires_at,
        fulfilled_at: redemption.fulfilled_at,
      }));
    } catch (error: any) {
      this.logger.error(`Error getting redemption history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate and use a redemption code
   */
  async validateRedemptionCode(redemptionCode: string): Promise<{
    valid: boolean;
    redemption?: any;
    error?: string;
  }> {
    try {
      const redemption = await this.pointRedemptionModel
        .findOne({
          redemption_code: redemptionCode,
          status: { $in: ['PENDING', 'APPROVED'] },
        })
        .populate('user_id', 'first_name last_name email')
        .lean();

      if (!redemption) {
        return { valid: false, error: 'Invalid or expired redemption code' };
      }

      // Check if expired
      if (redemption.expires_at && redemption.expires_at < new Date()) {
        return { valid: false, error: 'Redemption code has expired' };
      }

      return {
        valid: true,
        redemption: {
          redemption_id: redemption._id.toString(),
          user: redemption.user_id,
          reward_name: redemption.reward_snapshot.reward_name,
          reward_value: redemption.reward_snapshot.reward_value,
          points_spent: redemption.points_spent,
          status: redemption.status,
          expires_at: redemption.expires_at,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error validating redemption code: ${error.message}`);
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Mark a redemption as fulfilled
   */
  async fulfillRedemption(
    redemptionCode: string,
    notes?: string,
  ): Promise<void> {
    try {
      const result = await this.pointRedemptionModel.updateOne(
        {
          redemption_code: redemptionCode,
          status: { $in: ['PENDING', 'APPROVED'] },
        },
        {
          $set: {
            status: 'FULFILLED',
            fulfilled_at: new Date(),
            fulfillment_notes: notes || 'Redemption completed',
            updated_at: Date.now(),
          },
        },
      );

      if (result.matchedCount === 0) {
        throw new NotFoundException(
          'Redemption not found or already fulfilled',
        );
      }

      this.logger.log(`Redemption fulfilled: ${redemptionCode}`);
    } catch (error: any) {
      this.logger.error(`Error fulfilling redemption: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a unique redemption code
   */
  private generateRedemptionCode(): string {
    const prefix = 'GC'; // Good Citizen prefix
    const uuid = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `${prefix}${uuid}`;
  }

  /**
   * Get redemption statistics
   */
  async getRedemptionStats(): Promise<{
    total_redemptions: number;
    total_points_spent: number;
    redemptions_by_category: Record<string, number>;
    top_rewards: Array<{ reward_name: string; redemption_count: number }>;
  }> {
    try {
      const totalRedemptions = await this.pointRedemptionModel.countDocuments({
        status: { $in: ['FULFILLED', 'APPROVED'] },
      });

      const pointsSpentResult = await this.pointRedemptionModel.aggregate([
        { $match: { status: { $in: ['FULFILLED', 'APPROVED'] } } },
        { $group: { _id: null, total: { $sum: '$points_spent' } } },
      ]);
      const totalPointsSpent = pointsSpentResult[0]?.total || 0;

      const categoryStats = await this.pointRedemptionModel.aggregate([
        { $match: { status: { $in: ['FULFILLED', 'APPROVED'] } } },
        {
          $group: {
            _id: '$reward_snapshot.reward_category',
            count: { $sum: 1 },
          },
        },
      ]);
      const redemptionsByCategory = categoryStats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        },
        {} as Record<string, number>,
      );

      const topRewardsStats = await this.pointRedemptionModel.aggregate([
        { $match: { status: { $in: ['FULFILLED', 'APPROVED'] } } },
        { $group: { _id: '$reward_snapshot.reward_name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);
      const topRewards = topRewardsStats.map((stat) => ({
        reward_name: stat._id,
        redemption_count: stat.count,
      }));

      return {
        total_redemptions: totalRedemptions,
        total_points_spent: totalPointsSpent,
        redemptions_by_category: redemptionsByCategory,
        top_rewards: topRewards,
      };
    } catch (error: any) {
      this.logger.error(`Error getting redemption stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track ride completion and award points
   */
  async trackRideCompletion(userId: string, rideData: RideData): Promise<void> {
    try {
      this.logger.log(`Tracking ride completion for user ${userId}, ride ${rideData.ride_id}`);

      // Calculate points based on ride characteristics
      let basePoints = 10; // Base points for completing a ride
      
      // Bonus points for emergency rides
      if (rideData.vehicle_type === 'EMERGENCY') {
        basePoints += 15;
      }
      
      // Distance bonus (1 point per km, max 20 bonus points)
      const distanceBonus = Math.min(Math.floor(rideData.distance_km), 20);
      
      const totalPoints = basePoints + distanceBonus;

      // Create loyalty point record for ride completion
      const loyaltyPointRecord = new this.loyaltyPointModel({
        user_id: new Types.ObjectId(userId),
        ride_id: new Types.ObjectId(rideData.ride_id),
        loyalty_point: totalPoints,
        activity_type: 'RIDE_COMPLETION',
        activity_details: {
          final_fare: rideData.final_fare,
          distance_km: rideData.distance_km,
          duration_minutes: rideData.duration_minutes,
          vehicle_type: rideData.vehicle_type,
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await loyaltyPointRecord.save();

      // Update user's total loyalty points
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $inc: { loyalty_point: totalPoints },
          $set: { updated_at: Date.now() },
        },
      );

      this.logger.log(`Awarded ${totalPoints} points to user ${userId} for ride completion`);
    } catch (error: any) {
      this.logger.error(`Error tracking ride completion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track emergency assist and award bonus points
   */
  async trackEmergencyAssist(userId: string, assistData: AssistData): Promise<void> {
    try {
      this.logger.log(`Tracking emergency assist for user ${userId}, assist ${assistData.assist_id}`);

      // Calculate bonus points based on emergency type and impact
      let basePoints = 25; // Base points for emergency assist
      
      // Emergency type multipliers
      const typeMultipliers = {
        AMBULANCE: 2.0, // Highest priority
        FIRE: 1.8,
        POLICE: 1.5,
      };
      
      const typeMultiplier = typeMultipliers[assistData.emergency_type] || 1.0;
      
      // Time saved bonus (up to 50% bonus for significant time savings)
      const timeBonusMultiplier = Math.min(1 + (assistData.time_saved_seconds / 300), 1.5);
      
      // Impact bonus if metrics are available
      let impactBonus = 0;
      if (assistData.impact_metrics) {
        impactBonus = Math.min(assistData.impact_metrics.lives_affected * 10, 50);
      }
      
      const totalPoints = Math.round((basePoints * typeMultiplier * timeBonusMultiplier) + impactBonus);

      // Create loyalty point record for emergency assist
      const loyaltyPointRecord = new this.loyaltyPointModel({
        user_id: new Types.ObjectId(userId),
        loyalty_point: totalPoints,
        activity_type: 'EMERGENCY_ASSIST',
        emergency_type: assistData.emergency_type,
        time_saved_seconds: assistData.time_saved_seconds,
        location: {
          latitude: assistData.location[1], // latitude is second element
          longitude: assistData.location[0], // longitude is first element
        },
        activity_details: {
          assist_id: assistData.assist_id,
          impact_metrics: assistData.impact_metrics,
          calculation: {
            base_points: basePoints,
            type_multiplier: typeMultiplier,
            time_bonus_multiplier: timeBonusMultiplier,
            impact_bonus: impactBonus,
          },
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await loyaltyPointRecord.save();

      // Update user's total loyalty points
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $inc: { loyalty_point: totalPoints },
          $set: { updated_at: Date.now() },
        },
      );

      this.logger.log(`Awarded ${totalPoints} points to user ${userId} for emergency assist`);
    } catch (error: any) {
      this.logger.error(`Error tracking emergency assist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track achievement unlock and award bonus points
   */
  async trackAchievementUnlock(userId: string, achievement: Achievement): Promise<void> {
    try {
      this.logger.log(`Tracking achievement unlock for user ${userId}: ${achievement.name}`);

      // Create loyalty point record for achievement
      const loyaltyPointRecord = new this.loyaltyPointModel({
        user_id: new Types.ObjectId(userId),
        loyalty_point: achievement.points_awarded,
        activity_type: 'ACHIEVEMENT_UNLOCK',
        activity_details: {
          achievement_id: achievement.id,
          achievement_name: achievement.name,
          achievement_category: achievement.category,
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await loyaltyPointRecord.save();

      // Update user's total loyalty points
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $inc: { loyalty_point: achievement.points_awarded },
          $set: { updated_at: Date.now() },
        },
      );

      this.logger.log(`Awarded ${achievement.points_awarded} points to user ${userId} for achievement: ${achievement.name}`);
    } catch (error: any) {
      this.logger.error(`Error tracking achievement unlock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect activity to rewards - calculate bonus points based on activity impact
   */
  async connectActivityToRewards(activity: UserActivity): Promise<any> {
    try {
      this.logger.log(`Connecting activity to rewards for user ${activity.user_id}`);

      let bonusPoints = 0;
      let rewardTransaction: any = null;

      switch (activity.activity_type) {
        case 'RIDE_COMPLETION':
          const rideData = activity.activity_data as RideData;
          await this.trackRideCompletion(activity.user_id, rideData);
          bonusPoints = activity.points_earned;
          break;

        case 'EMERGENCY_ASSIST':
          const assistData = activity.activity_data as AssistData;
          await this.trackEmergencyAssist(activity.user_id, assistData);
          bonusPoints = activity.points_earned;
          break;

        case 'ACHIEVEMENT_UNLOCK':
          const achievementData = activity.activity_data as Achievement;
          await this.trackAchievementUnlock(activity.user_id, achievementData);
          bonusPoints = achievementData.points_awarded;
          break;
      }

      rewardTransaction = {
        user_id: activity.user_id,
        activity_type: activity.activity_type,
        points_earned: bonusPoints,
        timestamp: activity.timestamp,
        transaction_id: uuidv4(),
      };

      return rewardTransaction;
    } catch (error: any) {
      this.logger.error(`Error connecting activity to rewards: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate bonus points for emergency assist impact
   */
  calculateBonusPoints(assistImpact: any): number {
    try {
      let bonusPoints = 0;

      // Base bonus for any impact
      bonusPoints += 10;

      // Time saved bonus (1 point per 10 seconds saved, max 30 points)
      if (assistImpact.timeSaved) {
        bonusPoints += Math.min(Math.floor(assistImpact.timeSaved / 10), 30);
      }

      // Lives affected bonus (20 points per life affected, max 100 points)
      if (assistImpact.livesAffected) {
        bonusPoints += Math.min(assistImpact.livesAffected * 20, 100);
      }

      // Response time improvement bonus (1 point per 1% improvement, max 50 points)
      if (assistImpact.responseTimeImprovement) {
        bonusPoints += Math.min(Math.floor(assistImpact.responseTimeImprovement), 50);
      }

      return bonusPoints;
    } catch (error: any) {
      this.logger.error(`Error calculating bonus points: ${error.message}`);
      return 0;
    }
  }

  /**
   * Update user achievements based on activity
   */
  async updateUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      this.logger.log(`Updating achievements for user ${userId}`);

      const user = await this.userModel.findById(userId).lean();
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's activity history
      const userActivities = await this.loyaltyPointModel
        .find({ user_id: new Types.ObjectId(userId) })
        .lean();

      const newAchievements: Achievement[] = [];

      // Check for ride completion achievements
      const rideCompletions = userActivities.filter(
        (activity: any) => activity.activity_type === 'RIDE_COMPLETION'
      );

      if (rideCompletions.length >= 1 && !this.hasAchievement(user, 'first_ride')) {
        const achievement = {
          id: 'first_ride',
          name: 'First Ride',
          description: 'Completed your first ride',
          points_awarded: 25,
          category: 'MILESTONE',
        };
        newAchievements.push(achievement);
        await this.trackAchievementUnlock(userId, achievement);
      }

      if (rideCompletions.length >= 10 && !this.hasAchievement(user, 'frequent_rider')) {
        const achievement = {
          id: 'frequent_rider',
          name: 'Frequent Rider',
          description: 'Completed 10 rides',
          points_awarded: 100,
          category: 'MILESTONE',
        };
        newAchievements.push(achievement);
        await this.trackAchievementUnlock(userId, achievement);
      }

      // Check for emergency assist achievements
      const emergencyAssists = userActivities.filter(
        (activity: any) => activity.activity_type === 'EMERGENCY_ASSIST'
      );

      if (emergencyAssists.length >= 1 && !this.hasAchievement(user, 'first_assist')) {
        const achievement = {
          id: 'first_assist',
          name: 'Good Samaritan',
          description: 'Helped your first emergency vehicle',
          points_awarded: 50,
          category: 'EMERGENCY_HELPER',
        };
        newAchievements.push(achievement);
        await this.trackAchievementUnlock(userId, achievement);
      }

      // Check for point-based achievements
      const totalPoints = user.loyalty_point || 0;
      
      if (totalPoints >= 100 && !this.hasAchievement(user, 'point_collector_100')) {
        const achievement = {
          id: 'point_collector_100',
          name: 'Point Collector',
          description: 'Earned 100 loyalty points',
          points_awarded: 25,
          category: 'POINTS',
        };
        newAchievements.push(achievement);
        await this.trackAchievementUnlock(userId, achievement);
      }

      return newAchievements;
    } catch (error: any) {
      this.logger.error(`Error updating user achievements: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if user has a specific achievement
   */
  private hasAchievement(user: any, achievementId: string): boolean {
    // In a full implementation, this would check a UserAchievements collection
    // For now, we'll use user metadata or assume achievements are tracked elsewhere
    return user.metadata?.achievements?.includes(achievementId) || false;
  }
  async getUserAmbulanceAssists(
    userId: string,
    limit: number = 20,
  ): Promise<any[]> {
    try {
      this.logger.log(`Getting ambulance assists for user ${userId}`);

      // For now, return mock data since the actual ambulance assist tracking
      // would be implemented in a separate service/collection
      const mockAssists = [
        {
          id: 'assist-1',
          userId: userId,
          assistType: 'navigation',
          location: [-74.006, 40.7128],
          timestamp: new Date(Date.now() - 86400000), // 1 day ago
          outcome: 'successful',
          pointsEarned: 50,
          description: 'Provided navigation assistance to emergency vehicle',
        },
        {
          id: 'assist-2',
          userId: userId,
          assistType: 'emergency_contact',
          location: [-74.005, 40.713],
          timestamp: new Date(Date.now() - 172800000), // 2 days ago
          outcome: 'successful',
          pointsEarned: 75,
          description: 'Connected user with emergency services',
        },
      ];

      return mockAssists.slice(0, limit);
    } catch (error: any) {
      this.logger.error(
        `Error getting ambulance assists: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Track ambulance assistance for rewards
   */
  async trackAmbulanceAssistance(
    userId: string,
    assistanceType: string,
    location: [number, number],
    status: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Tracking ambulance assistance for user ${userId}: ${assistanceType} - ${status}`,
      );

      // Update user metadata with ambulance assistance
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.metadata) {
        user.metadata = {};
      }

      if (!user.metadata.ambulance_assists) {
        user.metadata.ambulance_assists = [];
      }

      const assistRecord = {
        type: assistanceType,
        location: location,
        status: status,
        timestamp: new Date(),
        points_awarded: status === 'successful' ? 10 : 0,
      };

      user.metadata.ambulance_assists.push(assistRecord);

      // Award points for successful assistance
      if (status === 'successful') {
        user.loyalty_point = (user.loyalty_point || 0) + 10;
      }

      await user.save();

      return assistRecord;
    } catch (error: any) {
      this.logger.error(
        `Error tracking ambulance assistance: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get user rewards history - returns real activity-based rewards data
   */
  async getUserRewardsHistory(
    userId: string,
    limit: number = 20,
  ): Promise<any[]> {
    try {
      this.logger.log(`Getting comprehensive rewards history for user ${userId}`);

      // Get loyalty point records (activity-based rewards)
      const loyaltyRecords = await this.loyaltyPointModel
        .find({ user_id: new Types.ObjectId(userId) })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();

      // Get redemption records
      const redemptions = await this.pointRedemptionModel
        .find({ user_id: new Types.ObjectId(userId) })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();

      // Combine and format all reward-related activities
      const allRewardActivities: any[] = [];

      // Add loyalty point earnings
      loyaltyRecords.forEach((record: any) => {
        allRewardActivities.push({
          id: record._id,
          type: 'POINTS_EARNED',
          activity_type: record.activity_type || 'UNKNOWN',
          points_earned: record.loyalty_point,
          description: this.getActivityDescription(record),
          timestamp: new Date(record.created_at),
          details: record.activity_details || {},
        });
      });

      // Add redemptions
      redemptions.forEach((redemption) => {
        allRewardActivities.push({
          id: redemption._id,
          type: 'POINTS_REDEEMED',
          reward_name: redemption.reward_snapshot?.reward_name || 'Unknown Reward',
          points_spent: redemption.points_spent,
          status: redemption.status,
          description: `Redeemed: ${redemption.reward_snapshot?.reward_name || 'Unknown Reward'}`,
          timestamp: new Date(redemption.created_at),
          redemption_code: redemption.redemption_code,
          expires_at: redemption.expires_at,
        });
      });

      // Sort by timestamp (most recent first) and limit results
      allRewardActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return allRewardActivities.slice(0, limit);
    } catch (error: any) {
      this.logger.error(
        `Error getting user rewards history: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return empty array instead of throwing to prevent frontend crashes
      return [];
    }
  }

  /**
   * Get activity description for display
   */
  private getActivityDescription(record: any): string {
    switch (record.activity_type) {
      case 'RIDE_COMPLETION':
        const vehicleType = record.activity_details?.vehicle_type || 'regular';
        return `Completed ${vehicleType} ride (+${record.loyalty_point} points)`;
      
      case 'EMERGENCY_ASSIST':
        const emergencyType = record.emergency_type || 'emergency';
        return `Assisted ${emergencyType.toLowerCase()} vehicle (+${record.loyalty_point} points)`;
      
      case 'ACHIEVEMENT_UNLOCK':
        const achievementName = record.activity_details?.achievement_name || 'achievement';
        return `Unlocked "${achievementName}" (+${record.loyalty_point} points)`;
      
      default:
        return `Earned ${record.loyalty_point} loyalty points`;
    }
  }

  /**
   * Get user's current achievements with real data
   */
  async getUserAchievements(userId: string): Promise<any[]> {
    try {
      this.logger.log(`Getting achievements for user ${userId}`);

      const user = await this.userModel.findById(userId).lean();
      if (!user) {
        return [];
      }

      // Get user's activity statistics
      const userActivities = await this.loyaltyPointModel
        .find({ user_id: new Types.ObjectId(userId) })
        .lean();

      const rideCount = userActivities.filter(
        (activity: any) => activity.activity_type === 'RIDE_COMPLETION'
      ).length;

      const assistCount = userActivities.filter(
        (activity: any) => activity.activity_type === 'EMERGENCY_ASSIST'
      ).length;

      const totalPoints = user.loyalty_point || 0;

      // Define available achievements with progress
      const achievements = [
        {
          id: 'first_ride',
          name: 'First Ride',
          description: 'Complete your first ride',
          icon: '🚗',
          category: 'MILESTONE',
          unlocked: rideCount >= 1,
          progress: Math.min(rideCount, 1),
          progress_max: 1,
          points_awarded: 25,
        },
        {
          id: 'frequent_rider',
          name: 'Frequent Rider',
          description: 'Complete 10 rides',
          icon: '🏆',
          category: 'MILESTONE',
          unlocked: rideCount >= 10,
          progress: Math.min(rideCount, 10),
          progress_max: 10,
          points_awarded: 100,
        },
        {
          id: 'first_assist',
          name: 'Good Samaritan',
          description: 'Help your first emergency vehicle',
          icon: '🚑',
          category: 'EMERGENCY_HELPER',
          unlocked: assistCount >= 1,
          progress: Math.min(assistCount, 1),
          progress_max: 1,
          points_awarded: 50,
        },
        {
          id: 'emergency_hero',
          name: 'Emergency Hero',
          description: 'Help 5 emergency vehicles',
          icon: '🦸',
          category: 'EMERGENCY_HELPER',
          unlocked: assistCount >= 5,
          progress: Math.min(assistCount, 5),
          progress_max: 5,
          points_awarded: 200,
        },
        {
          id: 'point_collector_100',
          name: 'Point Collector',
          description: 'Earn 100 loyalty points',
          icon: '💎',
          category: 'POINTS',
          unlocked: totalPoints >= 100,
          progress: Math.min(totalPoints, 100),
          progress_max: 100,
          points_awarded: 25,
        },
        {
          id: 'point_master_500',
          name: 'Point Master',
          description: 'Earn 500 loyalty points',
          icon: '👑',
          category: 'POINTS',
          unlocked: totalPoints >= 500,
          progress: Math.min(totalPoints, 500),
          progress_max: 500,
          points_awarded: 100,
        },
      ];

      return achievements;
    } catch (error: any) {
      this.logger.error(`Error getting user achievements: ${error.message}`);
      return [];
    }
  }
}
