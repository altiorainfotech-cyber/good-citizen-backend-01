/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
} from './entities/payment-method.entity';
import { PaymentMethodsQueryDto } from './dto/detail-query.dto';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    @InjectModel(PaymentMethod.name)
    private paymentMethodModel: Model<PaymentMethodDocument>,
  ) {}

  /**
   * Get available payment methods with processing capabilities
   * @param dto Payment methods query parameters
   * @param user Current user
   * @returns List of available payment methods
   */
  async getPaymentMethods(dto: PaymentMethodsQueryDto, user: any) {
    try {
      this.logger.log(
        `Getting payment methods for user ${user?.id || 'anonymous'}`,
      );

      const currency = dto.currency || 'INR';
      const region = this.determineRegion(dto.latitude, dto.longitude);

      // Build query filters
      const query: any = {
        isEnabled: true,
        isActive: true,
        supportedCurrencies: currency,
      };

      // Filter by region if applicable
      if (region) {
        query.$or = [
          { supportedRegions: { $size: 0 } }, // No region restrictions
          { supportedRegions: region },
        ];
      }

      const paymentMethods = await this.paymentMethodModel
        .find(query)
        .sort({ sortOrder: 1, name: 1 })
        .exec();

      return this.formatPaymentMethodsResponse(paymentMethods, dto);
    } catch (error) {
      this.logger.error('Error getting payment methods:', error);
      throw error;
    }
  }

  /**
   * Get specific payment method details
   * @param methodId Payment method ID
   * @param user Current user
   * @returns Payment method details
   */
  async getPaymentMethodDetail(methodId: string, user: any) {
    try {
      this.logger.log(`Getting payment method detail for ID: ${methodId}`);

      const paymentMethod = await this.paymentMethodModel
        .findOne({
          methodId: methodId,
          isEnabled: true,
          isActive: true,
        })
        .exec();

      if (!paymentMethod) {
        throw new Error(`Payment method with ID ${methodId} not found`);
      }

      return this.formatSinglePaymentMethodResponse(paymentMethod, true);
    } catch (error) {
      this.logger.error(
        `Error getting payment method detail for ID ${methodId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Determine region based on coordinates
   * @param latitude User latitude
   * @param longitude User longitude
   * @returns Region identifier
   */
  private determineRegion(
    latitude?: number,
    longitude?: number,
  ): string | null {
    if (!latitude || !longitude) {
      return null;
    }

    // Simple region detection for India
    // This would typically use a more sophisticated geolocation service
    if (
      latitude >= 6.0 &&
      latitude <= 37.0 &&
      longitude >= 68.0 &&
      longitude <= 97.0
    ) {
      return 'IN'; // India
    }

    // Add more regions as needed
    return null;
  }

  /**
   * Format payment methods response
   * @param paymentMethods Payment method documents
   * @param dto Query parameters
   * @returns Formatted response
   */
  private formatPaymentMethodsResponse(
    paymentMethods: PaymentMethodDocument[],
    dto: PaymentMethodsQueryDto,
  ) {
    return {
      currency: dto.currency || 'INR',
      methods: paymentMethods.map((method) =>
        this.formatSinglePaymentMethodResponse(
          method,
          dto.includeFees !== false,
        ),
      ),
      totalMethods: paymentMethods.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Format single payment method response
   * @param method Payment method document
   * @param includeFees Whether to include fee information
   * @returns Formatted payment method
   */
  private formatSinglePaymentMethodResponse(
    method: PaymentMethodDocument,
    includeFees: boolean = true,
  ) {
    const response: any = {
      id: method.methodId,
      type: method.type,
      name: method.name,
      displayName: method.displayName,
      isEnabled: method.isEnabled,
      supportedCurrencies: method.supportedCurrencies,
      processingCapabilities: {
        instant: method.processingCapabilities.instant,
        estimatedTime: method.processingCapabilities.estimatedTime,
        businessHours: method.processingCapabilities.businessHours,
      },
      features: method.features,
      displayInfo: method.displayInfo,
    };

    if (includeFees) {
      response.processingFee = method.processingFee;
      response.feeType = method.feeType;
      response.limits = method.limits;
    }

    return response;
  }

  /**
   * Create or update payment method
   * @param methodData Payment method data
   * @returns Created/updated payment method
   */
  async createOrUpdatePaymentMethod(
    methodData: any,
  ): Promise<PaymentMethodDocument> {
    const existingMethod = await this.paymentMethodModel
      .findOne({
        methodId: methodData.methodId,
      })
      .exec();

    if (existingMethod) {
      Object.assign(existingMethod, methodData);
      return await existingMethod.save();
    } else {
      const newMethod = new this.paymentMethodModel(methodData);
      return await newMethod.save();
    }
  }

  /**
   * Initialize default payment methods
   * This would typically be called during application startup or migration
   */
  async initializeDefaultPaymentMethods(): Promise<void> {
    const defaultMethods = [
      {
        methodId: 'card_visa',
        type: 'card',
        name: 'Visa Card',
        displayName: 'Visa Credit/Debit Card',
        isEnabled: true,
        processingFee: 2.5,
        feeType: 'percentage',
        supportedCurrencies: ['INR', 'USD'],
        supportedRegions: [],
        limits: {
          minAmount: 10,
          maxAmount: 100000,
          dailyLimit: 200000,
        },
        processingCapabilities: {
          instant: true,
          estimatedTime: 0,
          businessHours: false,
        },
        displayInfo: {
          icon: 'visa-icon',
          color: '#1A1F71',
          description: 'Pay securely with your Visa card',
        },
        features: {
          requiresVerification: true,
          supportsSaveCard: true,
          supportsRecurring: true,
          supportsRefund: true,
        },
        sortOrder: 1,
      },
      {
        methodId: 'upi',
        type: 'upi',
        name: 'UPI',
        displayName: 'UPI Payment',
        isEnabled: true,
        processingFee: 0,
        feeType: 'fixed',
        supportedCurrencies: ['INR'],
        supportedRegions: ['IN'],
        limits: {
          minAmount: 1,
          maxAmount: 100000,
          dailyLimit: 100000,
        },
        processingCapabilities: {
          instant: true,
          estimatedTime: 0,
          businessHours: false,
        },
        displayInfo: {
          icon: 'upi-icon',
          color: '#FF6B35',
          description: 'Pay instantly with UPI',
        },
        features: {
          requiresVerification: false,
          supportsSaveCard: false,
          supportsRecurring: false,
          supportsRefund: true,
        },
        sortOrder: 2,
      },
      {
        methodId: 'wallet_paytm',
        type: 'wallet',
        name: 'Paytm Wallet',
        displayName: 'Paytm Wallet',
        isEnabled: true,
        processingFee: 1.0,
        feeType: 'percentage',
        supportedCurrencies: ['INR'],
        supportedRegions: ['IN'],
        limits: {
          minAmount: 1,
          maxAmount: 20000,
          dailyLimit: 20000,
        },
        processingCapabilities: {
          instant: true,
          estimatedTime: 0,
          businessHours: false,
        },
        displayInfo: {
          icon: 'paytm-icon',
          color: '#00BAF2',
          description: 'Pay with your Paytm wallet balance',
        },
        features: {
          requiresVerification: true,
          supportsSaveCard: false,
          supportsRecurring: false,
          supportsRefund: true,
        },
        sortOrder: 3,
      },
      {
        methodId: 'cash',
        type: 'cash',
        name: 'Cash',
        displayName: 'Cash Payment',
        isEnabled: true,
        processingFee: 0,
        feeType: 'fixed',
        supportedCurrencies: ['INR'],
        supportedRegions: [],
        limits: {
          minAmount: 1,
          maxAmount: 5000,
        },
        processingCapabilities: {
          instant: false,
          estimatedTime: 0,
          businessHours: false,
        },
        displayInfo: {
          icon: 'cash-icon',
          color: '#4CAF50',
          description: 'Pay with cash on delivery',
        },
        features: {
          requiresVerification: false,
          supportsSaveCard: false,
          supportsRecurring: false,
          supportsRefund: false,
        },
        sortOrder: 4,
      },
    ];

    for (const methodData of defaultMethods) {
      await this.createOrUpdatePaymentMethod(methodData);
    }

    this.logger.log('Default payment methods initialized');
  }

  /**
   * Get payment methods by type
   * @param type Payment method type
   * @returns Payment methods of specified type
   */
  async getPaymentMethodsByType(
    type: string,
  ): Promise<PaymentMethodDocument[]> {
    return await this.paymentMethodModel
      .find({
        type: type,
        isEnabled: true,
        isActive: true,
      })
      .sort({ sortOrder: 1 })
      .exec();
  }

  /**
   * Update payment method availability
   * @param methodId Payment method ID
   * @param isEnabled Availability status
   * @returns Updated payment method
   */
  async updatePaymentMethodAvailability(
    methodId: string,
    isEnabled: boolean,
  ): Promise<PaymentMethodDocument> {
    const method = await this.paymentMethodModel.findOne({ methodId }).exec();
    if (!method) {
      throw new Error(`Payment method with ID ${methodId} not found`);
    }

    method.isEnabled = isEnabled;
    return await method.save();
  }
}
