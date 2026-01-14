/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fc from 'fast-check';
import { NotificationService, NotificationData } from './notification.service';
import {
  Notification,
  NotificationDocument,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationPreference } from '../user/entities/notification-preference.entity';
import { LoyaltyPoint } from '../user/entities/loyalty-point.entity';
import { User } from '../user/entities/user.entity';

describe('NotificationService Property Tests', () => {
  let service: NotificationService;
  let notificationModel: jest.Mocked<Model<NotificationDocument>>;
  let notificationPreferenceModel: jest.Mocked<Model<any>>;

  beforeEach(async () => {
    // Create a proper mock that chains methods correctly
    const createMockQuery = () => ({
      lean: jest.fn().mockResolvedValue(null),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    });

    const mockModel = {
      create: jest.fn(),
      findOne: jest.fn(() => createMockQuery()),
      findOneAndUpdate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      find: jest.fn(() => createMockQuery()),
      countDocuments: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getModelToken(Notification.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(NotificationTemplate.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(NotificationPreference.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(LoyaltyPoint.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationModel = module.get(getModelToken(Notification.name));
    notificationPreferenceModel = module.get(
      getModelToken(NotificationPreference.name),
    );
  });

  /**
   * Property 20: Notification Delivery Consistency
   * Feature: ride-hailing-backend-integration, Property 20: Notification Delivery Consistency
   * Validates: Requirements 5.2, 8.5, 13.1, 13.6
   */
  it('Property 20: For any valid notification data, sending a notification should create a database record and return consistent delivery status', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate notification data
        fc.record({
          user_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
          driver_id: fc.option(fc.hexaString({ minLength: 24, maxLength: 24 })),
          ride_id: fc.option(fc.hexaString({ minLength: 24, maxLength: 24 })),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          message: fc.string({ minLength: 1, maxLength: 500 }),
          type: fc.constantFrom(...Object.values(NotificationType)),
          priority: fc.option(
            fc.constantFrom(...Object.values(NotificationPriority)),
          ),
          data: fc.option(
            fc.record({
              fcm_token: fc.option(
                fc.string({ minLength: 10, maxLength: 200 }),
              ),
              ambulance_num: fc.option(fc.string()),
              distance: fc.option(fc.string()),
            }),
          ),
        }),
        async (notificationData) => {
          // Reset mocks
          jest.clearAllMocks();

          // Mock user preferences (no preferences = default behavior)
          const mockQuery = notificationPreferenceModel.findOne();
          (mockQuery as any).lean.mockResolvedValue(null);

          // Mock notification creation
          const mockNotificationId = new Types.ObjectId();
          const mockNotification = {
            _id: mockNotificationId,
            user_id: new Types.ObjectId(notificationData.user_id),
            driver_id: notificationData.driver_id
              ? new Types.ObjectId(notificationData.driver_id)
              : undefined,
            ride_id: notificationData.ride_id
              ? new Types.ObjectId(notificationData.ride_id)
              : undefined,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type,
            status: NotificationStatus.UNREAD,
            priority: notificationData.priority || NotificationPriority.NORMAL,
            data: notificationData.data || {},
            created_at: new Date(),
            updated_at: new Date(),
          };

          notificationModel.create.mockResolvedValue(mockNotification as any);
          notificationModel.findByIdAndUpdate.mockResolvedValue(
            mockNotification as any,
          );

          // Execute the notification sending
          const result = await service.sendNotification(
            notificationData as NotificationData,
          );

          // Verify notification was created in database
          expect(notificationModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
              user_id: expect.any(Types.ObjectId),
              title: notificationData.title,
              message: notificationData.message,
              type: notificationData.type,
              status: NotificationStatus.UNREAD,
              priority:
                notificationData.priority || NotificationPriority.NORMAL,
            }),
          );

          // Verify result structure is consistent
          expect(result).toHaveProperty('notification_id');
          expect(result).toHaveProperty('delivered');
          expect(result).toHaveProperty('delivery_channels');
          expect(typeof result.delivered).toBe('boolean');
          expect(typeof result.notification_id).toBe('string');

          // If notification was created, notification_id should not be empty
          if (result.delivered) {
            expect(result.notification_id).not.toBe('');
            expect(result.notification_id).toBe(mockNotificationId.toString());
          }

          // Verify status was updated after delivery attempt
          expect(notificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
            mockNotificationId,
            expect.objectContaining({
              status: expect.any(String),
              updated_at: expect.any(Date),
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Emergency notification rate limiting
   * For any user, emergency notifications should be rate limited to prevent spam
   */
  it('Property: Emergency notifications should be rate limited per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 24, maxLength: 24 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        async (userId, title, message) => {
          // Reset mocks
          jest.clearAllMocks();

          const mockQuery = notificationPreferenceModel.findOne();
          (mockQuery as any).lean.mockResolvedValue(null);

          const mockNotificationId = new Types.ObjectId();
          const mockNotification = {
            _id: mockNotificationId,
            user_id: new Types.ObjectId(userId),
            title,
            message,
            type: NotificationType.EMERGENCY_ALERT,
            status: NotificationStatus.UNREAD,
            priority: NotificationPriority.EMERGENCY,
            data: {},
            created_at: new Date(),
            updated_at: new Date(),
          };

          notificationModel.create.mockResolvedValue(mockNotification as any);
          notificationModel.findByIdAndUpdate.mockResolvedValue(
            mockNotification as any,
          );

          const emergencyNotificationData: NotificationData = {
            user_id: userId,
            title,
            message,
            type: NotificationType.EMERGENCY_ALERT,
            priority: NotificationPriority.EMERGENCY,
            data: {},
          };

          // Send first emergency notification
          const result1 = await service.sendNotification(
            emergencyNotificationData,
          );

          // Send second emergency notification immediately
          const result2 = await service.sendNotification(
            emergencyNotificationData,
          );

          // First notification should be delivered
          expect(result1.delivered).toBe(true);

          // Second notification should be rate limited
          expect(result2.delivered).toBe(false);
          expect(result2.failed_reason).toContain('Rate limited');

          // Only one notification should have been created
          expect(notificationModel.create).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property: Notification status tracking consistency
   * For any notification, the status should be consistently tracked through delivery attempts
   */
  it('Property: Notification status should be consistently tracked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          message: fc.string({ minLength: 1, maxLength: 500 }),
          type: fc.constantFrom(...Object.values(NotificationType)),
          has_fcm_token: fc.boolean(),
        }),
        async (testData) => {
          // Reset mocks
          jest.clearAllMocks();

          const mockQuery = notificationPreferenceModel.findOne();
          (mockQuery as any).lean.mockResolvedValue(null);

          const mockNotificationId = new Types.ObjectId();
          const mockNotification = {
            _id: mockNotificationId,
            user_id: new Types.ObjectId(testData.user_id),
            title: testData.title,
            message: testData.message,
            type: testData.type,
            status: NotificationStatus.UNREAD,
            priority: NotificationPriority.NORMAL,
            data: testData.has_fcm_token
              ? { fcm_token: 'valid_fcm_token_123456789' }
              : {},
            created_at: new Date(),
            updated_at: new Date(),
          };

          notificationModel.create.mockResolvedValue(mockNotification as any);
          notificationModel.findByIdAndUpdate.mockResolvedValue(
            mockNotification as any,
          );

          const notificationData: NotificationData = {
            user_id: testData.user_id,
            title: testData.title,
            message: testData.message,
            type: testData.type,
            data: testData.has_fcm_token
              ? { fcm_token: 'valid_fcm_token_123456789' }
              : {},
          };

          // Send notification
          const result = await service.sendNotification(notificationData);

          // Verify notification was created
          expect(notificationModel.create).toHaveBeenCalledTimes(1);

          // Verify status update was called
          expect(notificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
            mockNotificationId,
            expect.objectContaining({
              status: testData.has_fcm_token
                ? NotificationStatus.DELIVERED
                : NotificationStatus.FAILED,
              updated_at: expect.any(Date),
            }),
          );

          // Verify delivery result matches expected status
          if (testData.has_fcm_token) {
            expect(result.delivered).toBe(true);
            expect(result.delivery_channels.push?.success).toBe(true);
          } else {
            expect(result.delivered).toBe(false);
            expect(result.delivery_channels.push?.success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: User notification preferences should be respected
   * For any user with notification preferences, the system should respect their opt-out choices
   */
  it('Property: User notification preferences should be respected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.hexaString({ minLength: 24, maxLength: 24 }),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          message: fc.string({ minLength: 1, maxLength: 500 }),
          type: fc.constantFrom(...Object.values(NotificationType)),
          push_enabled: fc.boolean(),
          type_enabled: fc.boolean(),
        }),
        async (testData) => {
          // Reset mocks
          jest.clearAllMocks();

          // Mock user preferences
          const mockPreferences = {
            user_id: new Types.ObjectId(testData.user_id),
            push_notifications_enabled: testData.push_enabled,
            notification_types: {
              [testData.type]: testData.type_enabled,
              get: (type: NotificationType) =>
                type === testData.type ? testData.type_enabled : true,
            },
            emergency_override_quiet_hours: true,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const mockQuery = notificationPreferenceModel.findOne();
          (mockQuery as any).lean.mockResolvedValue(mockPreferences);

          const mockNotificationId = new Types.ObjectId();
          const mockNotification = {
            _id: mockNotificationId,
            user_id: new Types.ObjectId(testData.user_id),
            title: testData.title,
            message: testData.message,
            type: testData.type,
            status: NotificationStatus.UNREAD,
            priority: NotificationPriority.NORMAL,
            data: { fcm_token: 'valid_fcm_token_123456789' },
            created_at: new Date(),
            updated_at: new Date(),
          };

          notificationModel.create.mockResolvedValue(mockNotification as any);
          notificationModel.findByIdAndUpdate.mockResolvedValue(
            mockNotification as any,
          );

          const notificationData: NotificationData = {
            user_id: testData.user_id,
            title: testData.title,
            message: testData.message,
            type: testData.type,
            data: { fcm_token: 'valid_fcm_token_123456789' },
          };

          // Send notification
          const result = await service.sendNotification(notificationData);

          // If user has disabled this notification type, it should not be delivered
          if (!testData.type_enabled) {
            expect(result.delivered).toBe(false);
            expect(result.failed_reason).toContain('opted out');
            expect(notificationModel.create).not.toHaveBeenCalled();
          } else {
            // If type is enabled, notification should be created and delivery attempted
            expect(notificationModel.create).toHaveBeenCalledTimes(1);
            expect(result.delivered).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
