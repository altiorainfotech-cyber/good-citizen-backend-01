import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
} from '../entities/payment-method.entity';

@Injectable()
export class PaymentMethodSeeder {
  constructor(
    @InjectModel(PaymentMethod.name)
    private paymentMethodModel: Model<PaymentMethodDocument>,
  ) {}

  async seedPaymentMethods() {
    const paymentMethods = [
      {
        methodId: 'upi',
        type: 'upi',
        name: 'UPI',
        displayName: 'UPI (Unified Payments Interface)',
        isEnabled: true,
        processingFee: 0,
        feeType: 'fixed',
        supportedCurrencies: ['INR'],
        supportedRegions: ['IN'],
        limits: {
          minAmount: 1,
          maxAmount: 100000,
          dailyLimit: 100000,
          monthlyLimit: 1000000,
        },
        processingCapabilities: {
          instant: true,
          estimatedTime: 0,
          businessHours: false,
        },
        displayInfo: {
          icon: 'upi-icon',
          color: '#FF6B35',
          description: 'Pay instantly using UPI ID or QR code',
          termsUrl: 'https://example.com/upi-terms',
        },
        features: {
          requiresVerification: false,
          supportsSaveCard: false,
          supportsRecurring: true,
          supportsRefund: true,
        },
        sortOrder: 1,
        isActive: true,
      },
      {
        methodId: 'card',
        type: 'card',
        name: 'Credit/Debit Card',
        displayName: 'Credit or Debit Card',
        isEnabled: true,
        processingFee: 2.5,
        feeType: 'percentage',
        supportedCurrencies: ['INR', 'USD'],
        supportedRegions: ['IN', 'US', 'GB'],
        limits: {
          minAmount: 10,
          maxAmount: 200000,
          dailyLimit: 200000,
          monthlyLimit: 2000000,
        },
        processingCapabilities: {
          instant: true,
          estimatedTime: 2,
          businessHours: false,
        },
        displayInfo: {
          icon: 'card-icon',
          color: '#4285F4',
          description: 'Pay securely with your credit or debit card',
          termsUrl: 'https://example.com/card-terms',
        },
        features: {
          requiresVerification: true,
          supportsSaveCard: true,
          supportsRecurring: true,
          supportsRefund: true,
        },
        sortOrder: 2,
        isActive: true,
      },
      {
        methodId: 'wallet',
        type: 'wallet',
        name: 'Digital Wallet',
        displayName: 'Digital Wallet (Paytm, PhonePe, etc.)',
        isEnabled: true,
        processingFee: 1.5,
        feeType: 'percentage',
        supportedCurrencies: ['INR'],
        supportedRegions: ['IN'],
        limits: {
          minAmount: 1,
          maxAmount: 50000,
          dailyLimit: 50000,
          monthlyLimit: 500000,
        },
        processingCapabilities: {
          instant: true,
          estimatedTime: 1,
          businessHours: false,
        },
        displayInfo: {
          icon: 'wallet-icon',
          color: '#00C851',
          description: 'Pay using your digital wallet balance',
          termsUrl: 'https://example.com/wallet-terms',
        },
        features: {
          requiresVerification: false,
          supportsSaveCard: false,
          supportsRecurring: false,
          supportsRefund: true,
        },
        sortOrder: 3,
        isActive: true,
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
        supportedRegions: ['IN'],
        limits: {
          minAmount: 1,
          maxAmount: 2000,
          dailyLimit: 5000,
          monthlyLimit: 50000,
        },
        processingCapabilities: {
          instant: false,
          estimatedTime: 0,
          businessHours: true,
        },
        displayInfo: {
          icon: 'cash-icon',
          color: '#28A745',
          description: 'Pay with cash upon service completion',
          termsUrl: 'https://example.com/cash-terms',
        },
        features: {
          requiresVerification: false,
          supportsSaveCard: false,
          supportsRecurring: false,
          supportsRefund: false,
        },
        sortOrder: 4,
        isActive: true,
      },
      {
        methodId: 'net_banking',
        type: 'net_banking',
        name: 'Net Banking',
        displayName: 'Internet Banking',
        isEnabled: true,
        processingFee: 10,
        feeType: 'fixed',
        supportedCurrencies: ['INR'],
        supportedRegions: ['IN'],
        limits: {
          minAmount: 100,
          maxAmount: 500000,
          dailyLimit: 500000,
          monthlyLimit: 5000000,
        },
        processingCapabilities: {
          instant: false,
          estimatedTime: 5,
          businessHours: true,
        },
        displayInfo: {
          icon: 'netbanking-icon',
          color: '#007BFF',
          description: 'Pay directly from your bank account',
          termsUrl: 'https://example.com/netbanking-terms',
        },
        features: {
          requiresVerification: true,
          supportsSaveCard: false,
          supportsRecurring: false,
          supportsRefund: true,
        },
        sortOrder: 5,
        isActive: true,
      },
    ];

    for (const method of paymentMethods) {
      const existingMethod = await this.paymentMethodModel.findOne({
        methodId: method.methodId,
      });
      if (!existingMethod) {
        await this.paymentMethodModel.create(method);
// console.log removed
      } else {
// console.log removed
      }
    }
  }

  async seedAll() {
// console.log removed
    await this.seedPaymentMethods();
// console.log removed
  }
}
