import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AssistImpactDocument = AssistImpact & Document;

@Schema({ timestamps: true })
export class AssistImpact {
  @Prop({ type: Types.ObjectId, ref: 'EmergencyRequest', required: true, index: true })
  assistId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: {
      timeSaved: { type: Number, required: true, min: 0 }, // minutes
      livesAffected: { type: Number, required: true, min: 0 },
      responseTimeImprovement: { type: Number, required: true, min: 0 }, // percentage
      communityContribution: { type: Number, required: true, min: 0 }, // points
    },
    required: true,
  })
  metrics: {
    timeSaved: number;
    livesAffected: number;
    responseTimeImprovement: number;
    communityContribution: number;
  };

  @Prop({
    type: {
      originalRoute: {
        distance: { type: Number, required: true }, // meters
        duration: { type: Number, required: true }, // seconds
        coordinates: { type: [[Number]], required: true },
      },
      optimizedRoute: {
        distance: { type: Number, required: true }, // meters
        duration: { type: Number, required: true }, // seconds
        coordinates: { type: [[Number]], required: true },
      },
      trafficConditions: { type: String, required: true },
      emergencyType: { type: String, required: true },
      assistanceType: { type: String, required: true },
    },
    required: true,
  })
  calculationData: {
    originalRoute: {
      distance: number;
      duration: number;
      coordinates: number[][];
    };
    optimizedRoute: {
      distance: number;
      duration: number;
      coordinates: number[][];
    };
    trafficConditions: string;
    emergencyType: string;
    assistanceType: string;
  };

  @Prop({ required: true, index: true })
  calculatedAt: Date;

  @Prop({ default: true, index: true })
  isVerified: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const AssistImpactSchema = SchemaFactory.createForClass(AssistImpact);

// Create indexes for efficient queries
AssistImpactSchema.index({ userId: 1, calculatedAt: -1 });
AssistImpactSchema.index({ 'metrics.communityContribution': -1 });
AssistImpactSchema.index({ calculatedAt: -1 });