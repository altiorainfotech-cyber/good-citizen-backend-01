/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationService,
  NotificationData,
  NotificationDeliveryResult,
} from './notification.service';

interface QueuedNotification {
  id: string;
  notification: NotificationData;
  priority: number;
  scheduledAt: Date;
  retryCount: number;
  maxRetries: number;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private queue: QueuedNotification[] = [];
  private processing = false;
  private readonly maxConcurrent = 5;
  private readonly retryDelay = 5000; // 5 seconds
  private readonly maxRetries = 3;

  constructor(private readonly notificationService: NotificationService) {
    // Start processing queue
    this.startProcessing();
  }

  /**
   * Add notification to queue
   */
  async enqueue(
    notification: NotificationData,
    options?: {
      priority?: number;
      delay?: number;
      maxRetries?: number;
    },
  ): Promise<string> {
    const id = this.generateId();
    const scheduledAt = new Date();

    if (options?.delay) {
      scheduledAt.setMilliseconds(
        scheduledAt.getMilliseconds() + options.delay,
      );
    }

    const queuedNotification: QueuedNotification = {
      id,
      notification,
      priority: options?.priority || 0,
      scheduledAt,
      retryCount: 0,
      maxRetries: options?.maxRetries || this.maxRetries,
    };

    this.queue.push(queuedNotification);
    this.sortQueue();

    this.logger.debug(`Notification queued: ${id}`);
    return id;
  }

  /**
   * Add multiple notifications to queue
   */
  async enqueueBatch(
    notifications: NotificationData[],
    options?: {
      priority?: number;
      delay?: number;
      maxRetries?: number;
      staggerDelay?: number; // Delay between each notification in batch
    },
  ): Promise<string[]> {
    const ids: string[] = [];
    const staggerDelay = options?.staggerDelay || 100; // 100ms between notifications

    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      if (!notification) continue;

      const delay = (options?.delay || 0) + i * staggerDelay;
      const id = await this.enqueue(notification, {
        ...options,
        delay,
      });
      ids.push(id);
    }

    return ids;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    processing: boolean;
    nextScheduled?: Date;
  } {
    const now = new Date();
    const pending = this.queue.filter((item) => item.scheduledAt <= now).length;
    const nextScheduled = this.queue.find(
      (item) => item.scheduledAt > now,
    )?.scheduledAt;

    return {
      total: this.queue.length,
      pending,
      processing: this.processing,
      ...(nextScheduled && { nextScheduled }),
    };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    this.logger.log('Notification queue cleared');
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    setInterval(async () => {
      if (!this.processing && this.queue.length > 0) {
        await this.processQueue();
      }
    }, 1000); // Check every second
  }

  /**
   * Process queued notifications
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    const now = new Date();
    const readyNotifications = this.queue
      .filter((item) => item.scheduledAt <= now)
      .slice(0, this.maxConcurrent);

    if (readyNotifications.length === 0) {
      this.processing = false;
      return;
    }

    this.logger.debug(`Processing ${readyNotifications.length} notifications`);

    const promises = readyNotifications.map(async (queuedNotification) => {
      try {
        const result = await this.notificationService.sendNotification(
          queuedNotification.notification,
        );

        if (result.delivered) {
          // Remove from queue on success
          this.removeFromQueue(queuedNotification.id);
          this.logger.debug(
            `Notification sent successfully: ${queuedNotification.id}`,
          );
        } else {
          // Retry on failure
          await this.handleFailure(queuedNotification, result.failed_reason);
        }
      } catch (error) {
        await this.handleFailure(
          queuedNotification,
          error instanceof Error ? error.message : 'Unknown error occurred',
        );
      }
    });

    await Promise.allSettled(promises);
    this.processing = false;
  }

  /**
   * Handle notification failure
   */
  private async handleFailure(
    queuedNotification: QueuedNotification,
    reason?: string,
  ): Promise<void> {
    queuedNotification.retryCount++;

    if (queuedNotification.retryCount >= queuedNotification.maxRetries) {
      // Max retries reached, remove from queue
      this.removeFromQueue(queuedNotification.id);
      this.logger.error(
        `Notification failed after ${queuedNotification.maxRetries} retries: ${queuedNotification.id}. Reason: ${reason}`,
      );
    } else {
      // Schedule retry with exponential backoff
      const delay =
        this.retryDelay * Math.pow(2, queuedNotification.retryCount - 1);
      queuedNotification.scheduledAt = new Date(Date.now() + delay);
      this.sortQueue();

      this.logger.warn(
        `Notification retry scheduled: ${queuedNotification.id} (attempt ${queuedNotification.retryCount}/${queuedNotification.maxRetries})`,
      );
    }
  }

  /**
   * Remove notification from queue
   */
  private removeFromQueue(id: string): void {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Sort queue by priority and scheduled time
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Earlier scheduled time first
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
