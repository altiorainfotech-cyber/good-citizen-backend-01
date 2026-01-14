import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AssistImpact, AssistImpactDocument } from './entities/assist-impact.entity';
import { EmergencyRequest, EmergencyRequestDocument } from '../entities/emergency-request.entity';
import { User, UserDocument } from './entities/user.entity';

export interface ImpactMetrics {
  timeSaved: number; // minutes
  livesAffected: number;
  responseTimeImprovement: number; // percentage
  communityContribution: number; // points
}

export interface RouteData {
  distance: number; // meters
  duration: number; // seconds
  coordinates: number[][];
}

export interface UserImpactSummary {
  totalAssists: number;
  totalTimeSaved: number;
  totalLivesAffected: number;
  averageResponseTimeImprovement: number;
  totalCommunityContribution: number;
  impactsByType: Record<string, number>;
}

export interface CommunityImpactStats {
  totalAssists: number;
  totalTimeSaved: number;
  totalLivesAffected: number;
  averageResponseTimeImprovement: number;
  totalCommunityContribution: number;
  topContributors: Array<{
    userId: string;
    userName: string;
    totalAssists: number;
    totalContribution: number;
  }>;
}

@Injectable()
export class ImpactCalculatorService {
  private readonly logger = new Logger(ImpactCalculatorService.name);

  constructor(
    @InjectModel(AssistImpact.name)
    private assistImpactModel: Model<AssistImpactDocument>,
    @InjectModel(EmergencyRequest.name)
    private emergencyRequestModel: Model<EmergencyRequestDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Calculate impact metrics for an emergency assist
   */
  async calculateAssistImpact(assistId: string): Promise<ImpactMetrics> {
    try {
      this.logger.log(`Calculating impact for assist ${assistId}`);

      // Check if impact already calculated
      const existingImpact = await this.assistImpactModel
        .findOne({ assistId: new Types.ObjectId(assistId) })
        .lean();

      if (existingImpact) {
        this.logger.log(`Impact already calculated for assist ${assistId}`);
        return existingImpact.metrics;
      }

      // Get emergency request details
      const emergencyRequest = await this.emergencyRequestModel
        .findById(assistId)
        .lean();

      if (!emergencyRequest) {
        throw new NotFoundException(`Emergency request ${assistId} not found`);
      }

      if (emergencyRequest.status !== 'completed') {
        throw new BadRequestException(
          `Cannot calculate impact for incomplete assist ${assistId}`,
        );
      }

      // Calculate impact metrics based on emergency type and response data
      const metrics = await this.computeImpactMetrics(emergencyRequest);

      // Store the calculated impact
      const impactRecord = new this.assistImpactModel({
        assistId: new Types.ObjectId(assistId),
        userId: emergencyRequest.userId,
        metrics,
        calculationData: {
          originalRoute: {
            distance: this.estimateOriginalDistance(emergencyRequest),
            duration: (emergencyRequest.estimatedResponseTime || 30) * 60, // Convert to seconds
            coordinates: this.generateRouteCoordinates(emergencyRequest, false),
          },
          optimizedRoute: {
            distance: this.estimateOptimizedDistance(emergencyRequest),
            duration: (emergencyRequest.actualResponseTime || 15) * 60, // Convert to seconds
            coordinates: this.generateRouteCoordinates(emergencyRequest, true),
          },
          trafficConditions: this.determineTrafficConditions(emergencyRequest),
          emergencyType: emergencyRequest.emergencyType,
          assistanceType: this.determineAssistanceType(emergencyRequest),
        },
        calculatedAt: new Date(),
        isVerified: true,
      });

      await impactRecord.save();

      this.logger.log(`Impact calculated and stored for assist ${assistId}`);
      return metrics;
    } catch (error: any) {
      this.logger.error(`Error calculating assist impact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get aggregated impact summary for a user
   */
  async aggregateUserImpact(userId: string): Promise<UserImpactSummary> {
    try {
      this.logger.log(`Aggregating impact for user ${userId}`);

      const impacts = await this.assistImpactModel
        .find({ userId: new Types.ObjectId(userId) })
        .lean();

      if (impacts.length === 0) {
        return {
          totalAssists: 0,
          totalTimeSaved: 0,
          totalLivesAffected: 0,
          averageResponseTimeImprovement: 0,
          totalCommunityContribution: 0,
          impactsByType: {},
        };
      }

      const summary: UserImpactSummary = {
        totalAssists: impacts.length,
        totalTimeSaved: impacts.reduce((sum, impact) => sum + impact.metrics.timeSaved, 0),
        totalLivesAffected: impacts.reduce((sum, impact) => sum + impact.metrics.livesAffected, 0),
        averageResponseTimeImprovement: impacts.reduce((sum, impact) => sum + impact.metrics.responseTimeImprovement, 0) / impacts.length,
        totalCommunityContribution: impacts.reduce((sum, impact) => sum + impact.metrics.communityContribution, 0),
        impactsByType: {},
      };

      // Group impacts by emergency type
      for (const impact of impacts) {
        const type = impact.calculationData.emergencyType;
        summary.impactsByType[type] = (summary.impactsByType[type] || 0) + 1;
      }

      return summary;
    } catch (error: any) {
      this.logger.error(`Error aggregating user impact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get community-wide impact statistics
   */
  async getCommunityImpactStats(): Promise<CommunityImpactStats> {
    try {
      this.logger.log('Getting community impact statistics');

      const impacts = await this.assistImpactModel.find().lean();

      if (impacts.length === 0) {
        return {
          totalAssists: 0,
          totalTimeSaved: 0,
          totalLivesAffected: 0,
          averageResponseTimeImprovement: 0,
          totalCommunityContribution: 0,
          topContributors: [],
        };
      }

      const stats: CommunityImpactStats = {
        totalAssists: impacts.length,
        totalTimeSaved: impacts.reduce((sum, impact) => sum + impact.metrics.timeSaved, 0),
        totalLivesAffected: impacts.reduce((sum, impact) => sum + impact.metrics.livesAffected, 0),
        averageResponseTimeImprovement: impacts.reduce((sum, impact) => sum + impact.metrics.responseTimeImprovement, 0) / impacts.length,
        totalCommunityContribution: impacts.reduce((sum, impact) => sum + impact.metrics.communityContribution, 0),
        topContributors: [],
      };

      // Calculate top contributors
      const contributorMap = new Map<string, { totalAssists: number; totalContribution: number }>();
      
      for (const impact of impacts) {
        const userId = impact.userId.toString();
        const existing = contributorMap.get(userId) || { totalAssists: 0, totalContribution: 0 };
        contributorMap.set(userId, {
          totalAssists: existing.totalAssists + 1,
          totalContribution: existing.totalContribution + impact.metrics.communityContribution,
        });
      }

      // Get user names for top contributors
      const topUserIds = Array.from(contributorMap.entries())
        .sort((a, b) => b[1].totalContribution - a[1].totalContribution)
        .slice(0, 5)
        .map(([userId]) => userId);

      const topUsers = await this.userModel
        .find({ _id: { $in: topUserIds.map(id => new Types.ObjectId(id)) } })
        .select('first_name last_name')
        .lean();

      stats.topContributors = topUserIds.map(userId => {
        const user = topUsers.find(u => u._id.toString() === userId);
        const contribution = contributorMap.get(userId)!;
        return {
          userId,
          userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
          totalAssists: contribution.totalAssists,
          totalContribution: contribution.totalContribution,
        };
      });

      return stats;
    } catch (error: any) {
      this.logger.error(`Error getting community impact stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get impact data for a specific assist
   */
  async getAssistImpact(assistId: string): Promise<AssistImpact | null> {
    try {
      const impact = await this.assistImpactModel
        .findOne({ assistId: new Types.ObjectId(assistId) })
        .lean();

      return impact;
    } catch (error: any) {
      this.logger.error(`Error getting assist impact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete an assist and trigger impact calculation
   */
  async completeAssist(assistId: string, userId: string): Promise<{
    success: boolean;
    impact?: ImpactMetrics | undefined;
    message: string;
  }> {
    try {
      this.logger.log(`Completing assist ${assistId} for user ${userId}`);

      // Update emergency request status to completed
      const emergencyRequest = await this.emergencyRequestModel.findById(assistId);
      
      if (!emergencyRequest) {
        throw new NotFoundException(`Emergency request ${assistId} not found`);
      }

      if (emergencyRequest.userId.toString() !== userId) {
        throw new BadRequestException('User not authorized to complete this assist');
      }

      if (emergencyRequest.status === 'completed') {
        // Already completed, just return existing impact
        const existingImpact = await this.getAssistImpact(assistId);
        return {
          success: true,
          impact: existingImpact?.metrics || undefined,
          message: 'Assist already completed',
        };
      }

      // Update status and completion time
      emergencyRequest.status = 'completed';
      emergencyRequest.completedAt = new Date();
      
      // Set actual response time if not already set
      if (!emergencyRequest.actualResponseTime && emergencyRequest.assignedAt) {
        const responseTimeMinutes = Math.round(
          (Date.now() - emergencyRequest.assignedAt.getTime()) / (1000 * 60)
        );
        emergencyRequest.actualResponseTime = responseTimeMinutes;
      }

      await emergencyRequest.save();

      // Calculate impact metrics
      const impact = await this.calculateAssistImpact(assistId);

      return {
        success: true,
        impact,
        message: 'Assist completed and impact calculated',
      };
    } catch (error: any) {
      this.logger.error(`Error completing assist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compute impact metrics based on emergency request data
   */
  private async computeImpactMetrics(emergencyRequest: EmergencyRequestDocument): Promise<ImpactMetrics> {
    const baseMetrics = this.getBaseMetricsByType(emergencyRequest.emergencyType);
    
    // Calculate time saved based on response time improvement
    const estimatedTime = emergencyRequest.estimatedResponseTime || 30; // Default 30 minutes
    const actualTime = emergencyRequest.actualResponseTime || estimatedTime;
    const timeSaved = Math.max(0, estimatedTime - actualTime);
    
    // Calculate response time improvement percentage
    const responseTimeImprovement = estimatedTime > 0 
      ? Math.round(((estimatedTime - actualTime) / estimatedTime) * 100)
      : 0;

    // Calculate lives affected based on emergency type and severity
    const livesAffected = this.calculateLivesAffected(emergencyRequest);

    // Calculate community contribution points
    const communityContribution = this.calculateCommunityPoints(
      timeSaved,
      livesAffected,
      emergencyRequest.priority,
    );

    return {
      timeSaved: Math.round(timeSaved),
      livesAffected,
      responseTimeImprovement: Math.max(0, responseTimeImprovement),
      communityContribution,
    };
  }

  /**
   * Get base metrics by emergency type
   */
  private getBaseMetricsByType(emergencyType: string): Partial<ImpactMetrics> {
    const baseMetrics: Record<string, Partial<ImpactMetrics>> = {
      ambulance: { livesAffected: 2, communityContribution: 50 },
      medical: { livesAffected: 1, communityContribution: 40 },
      fire: { livesAffected: 3, communityContribution: 60 },
      police: { livesAffected: 1, communityContribution: 30 },
      general: { livesAffected: 1, communityContribution: 20 },
    };

    return baseMetrics[emergencyType] || baseMetrics.general || {};
  }

  /**
   * Calculate lives affected based on emergency details
   */
  private calculateLivesAffected(emergencyRequest: EmergencyRequestDocument): number {
    const baseMetrics = this.getBaseMetricsByType(emergencyRequest.emergencyType);
    let livesAffected = baseMetrics.livesAffected || 1;

    // Adjust based on priority
    switch (emergencyRequest.priority) {
      case 'critical':
        livesAffected *= 2;
        break;
      case 'high':
        livesAffected *= 1.5;
        break;
      case 'medium':
        livesAffected *= 1;
        break;
      case 'low':
        livesAffected *= 0.5;
        break;
    }

    return Math.round(livesAffected);
  }

  /**
   * Calculate community contribution points
   */
  private calculateCommunityPoints(
    timeSaved: number,
    livesAffected: number,
    priority: string,
  ): number {
    let points = 0;

    // Base points for time saved (1 point per minute saved)
    points += timeSaved;

    // Points for lives affected (20 points per life)
    points += livesAffected * 20;

    // Priority multiplier
    const priorityMultipliers: Record<string, number> = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.5,
    };

    points *= priorityMultipliers[priority] || 1.0;

    return Math.round(points);
  }

  /**
   * Estimate original distance without assistance
   */
  private estimateOriginalDistance(emergencyRequest: EmergencyRequestDocument): number {
    // Mock calculation - in real implementation, this would use routing APIs
    return 5000; // 5km default
  }

  /**
   * Estimate optimized distance with assistance
   */
  private estimateOptimizedDistance(emergencyRequest: EmergencyRequestDocument): number {
    // Mock calculation - typically 10-20% shorter with assistance
    const originalDistance = this.estimateOriginalDistance(emergencyRequest);
    return Math.round(originalDistance * 0.85); // 15% improvement
  }

  /**
   * Generate route coordinates (mock implementation)
   */
  private generateRouteCoordinates(
    emergencyRequest: EmergencyRequestDocument,
    optimized: boolean,
  ): number[][] {
    // Mock coordinates - in real implementation, this would use routing APIs
    const [lng, lat] = emergencyRequest.location.coordinates;
    return [
      [lng, lat],
      [lng + 0.01, lat + 0.01],
      [lng + 0.02, lat + 0.02],
    ];
  }

  /**
   * Determine traffic conditions based on time and location
   */
  private determineTrafficConditions(emergencyRequest: EmergencyRequestDocument): string {
    // Use the document's createdAt timestamp (from Mongoose timestamps: true)
    const createdAt = (emergencyRequest as any).createdAt || new Date();
    const hour = new Date(createdAt).getHours();
    
    if (hour >= 7 && hour <= 9) return 'heavy_morning';
    if (hour >= 17 && hour <= 19) return 'heavy_evening';
    if (hour >= 22 || hour <= 6) return 'light_night';
    
    return 'moderate';
  }

  /**
   * Determine assistance type based on emergency request
   */
  private determineAssistanceType(emergencyRequest: EmergencyRequestDocument): string {
    if (emergencyRequest.assignedProviderId) return 'navigation_assistance';
    if (emergencyRequest.metadata?.userAssisted) return 'user_assistance';
    return 'system_assistance';
  }
}