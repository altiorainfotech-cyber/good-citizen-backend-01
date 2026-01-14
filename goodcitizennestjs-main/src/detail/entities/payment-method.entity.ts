import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentMethodDocument = PaymentMethod & Document;

@Schema({ timestamps: true })
export class PaymentMethod {
  @Prop({ required: true, unique: true })
  methodId: string;

  @Prop({
    enum: ['card', 'wallet', 'upi', 'cash', 'net_banking', 'emi'],
    required: true,
  })
  type: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  displayName: string;

  @Prop({ default: true })
  isEnabled: boolean;

  @Prop({ type: Number, min: 0, default: 0 })
  processingFee: number; // percentage or fixed amount

  @Prop({ enum: ['percentage', 'fixed'], default: 'percentage' })
  feeType: string;

  @Prop({ type: [String], default: ['INR'] })
  supportedCurrencies: string[];

  @Prop({ type: [String], default: [] })
  supportedRegions: string[]; // country codes or region identifiers

  @Prop({
    type: {
      minAmount: Number,
      maxAmount: Number,
      dailyLimit: Number,
      monthlyLimit: Number,
    },
    default: {},
  })
  limits: {
    minAmount?: number;
    maxAmount?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  };

  @Prop({
    type: {
      instant: Boolean,
      estimatedTime: Number, // in minutes
      businessHours: Boolean,
    },
    default: { instant: true, estimatedTime: 0, businessHours: false },
  })
  processingCapabilities: {
    instant: boolean;
    estimatedTime: number;
    businessHours: boolean;
  };

  @Prop({
    type: {
      icon: String,
      color: String,
      description: String,
      termsUrl: String,
    },
    default: {},
  })
  displayInfo: {
    icon?: string;
    color?: string;
    description?: string;
    termsUrl?: string;
  };

  @Prop({
    type: {
      requiresVerification: Boolean,
      supportsSaveCard: Boolean,
      supportsRecurring: Boolean,
      supportsRefund: Boolean,
    },
    default: {
      requiresVerification: false,
      supportsSaveCard: false,
      supportsRecurring: false,
      supportsRefund: true,
    },
  })
  features: {
    requiresVerification: boolean;
    supportsSaveCard: boolean;
    supportsRecurring: boolean;
    supportsRefund: boolean;
  };

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

// Create indexes
PaymentMethodSchema.index({ methodId: 1 });
PaymentMethodSchema.index({ type: 1 });
PaymentMethodSchema.index({ isEnabled: 1, isActive: 1 });
PaymentMethodSchema.index({ supportedRegions: 1 });
PaymentMethodSchema.index({ sortOrder: 1 });
