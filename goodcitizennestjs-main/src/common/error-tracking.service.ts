/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByContext: Record<string, number>;
  recentErrors: ErrorEvent[];
  topErrors: Array<{ message: string; count: number; lastOccurred: Date }>;
}

@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private errors: ErrorEvent[] = [];
  private readonly maxStoredErrors = 1000;
  private errorCounts = new Map<
    string,
    { count: number; lastOccurred: Date }
  >();

  constructor(private configService: ConfigService) {}

  /**
   * Track an error event
   */
  trackError(
    message: string,
    level: 'error' | 'warning' | 'info' = 'error',
    context?: string,
    stack?: string,
    metadata?: Record<string, any>,
  ): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date();

    const errorEvent: ErrorEvent = {
      id: errorId,
      timestamp,
      level,
      message,
      ...(stack && { stack }),
      ...(context && { context }),
      ...(metadata && { metadata }),
    };

    // Store error
    this.errors.unshift(errorEvent);

    // Maintain max stored errors
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(0, this.maxStoredErrors);
    }

    // Update error counts
    const errorKey = `${context || 'unknown'}:${message}`;
    const existing = this.errorCounts.get(errorKey);
    this.errorCounts.set(errorKey, {
      count: (existing?.count || 0) + 1,
      lastOccurred: timestamp,
    });

    // Log based on level
    switch (level) {
      case 'error':
        this.logger.error(`[${context || 'Unknown'}] ${message}`, stack);
        break;
      case 'warning':
        this.logger.warn(`[${context || 'Unknown'}] ${message}`);
        break;
      case 'info':
        this.logger.log(`[${context || 'Unknown'}] ${message}`);
        break;
    }

    // In production, you might want to send to external error tracking service
    if (
      this.configService.get('NODE_ENV') === 'production' &&
      level === 'error'
    ) {
      this.sendToExternalService(errorEvent);
    }

    return errorId;
  }

  /**
   * Track an exception with full stack trace
   */
  trackException(
    error: Error,
    context?: string,
    userId?: string,
    requestId?: string,
    metadata?: Record<string, any>,
  ): string {
    return this.trackError(error.message, 'error', context, error.stack, {
      ...metadata,
      userId,
      requestId,
      errorName: error.name,
    });
  }

  /**
   * Get error summary for monitoring dashboard
   */
  getErrorSummary(hours: number = 24): ErrorSummary {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentErrors = this.errors.filter(
      (error) => error.timestamp >= cutoffTime,
    );

    // Count errors by level
    const errorsByLevel = recentErrors.reduce(
      (acc, error) => {
        acc[error.level] = (acc[error.level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Count errors by context
    const errorsByContext = recentErrors.reduce(
      (acc, error) => {
        const context = error.context || 'unknown';
        acc[context] = (acc[context] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get top errors
    const topErrors = Array.from(this.errorCounts.entries())
      .filter(([_, data]) => data.lastOccurred >= cutoffTime)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, data]) => ({
        message: key.split(':').slice(1).join(':'),
        count: data.count,
        lastOccurred: data.lastOccurred,
      }));

    return {
      totalErrors: recentErrors.length,
      errorsByLevel,
      errorsByContext,
      recentErrors: recentErrors.slice(0, 50), // Last 50 errors
      topErrors,
    };
  }

  /**
   * Get errors by context
   */
  getErrorsByContext(context: string, limit: number = 50): ErrorEvent[] {
    return this.errors
      .filter((error) => error.context === context)
      .slice(0, limit);
  }

  /**
   * Get errors by level
   */
  getErrorsByLevel(
    level: 'error' | 'warning' | 'info',
    limit: number = 50,
  ): ErrorEvent[] {
    return this.errors.filter((error) => error.level === level).slice(0, limit);
  }

  /**
   * Get error by ID
   */
  getErrorById(id: string): ErrorEvent | undefined {
    return this.errors.find((error) => error.id === id);
  }

  /**
   * Clear old errors (cleanup)
   */
  clearOldErrors(olderThanHours: number = 168): number {
    // Default 7 days
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.errors.length;

    this.errors = this.errors.filter((error) => error.timestamp >= cutoffTime);

    // Clean up error counts
    for (const [key, data] of this.errorCounts.entries()) {
      if (data.lastOccurred < cutoffTime) {
        this.errorCounts.delete(key);
      }
    }

    const removedCount = initialCount - this.errors.length;
    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} old error records`);
    }

    return removedCount;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalStored: number;
    uniqueErrors: number;
    oldestError?: Date;
    newestError?: Date;
  } {
    const result: {
      totalStored: number;
      uniqueErrors: number;
      oldestError?: Date;
      newestError?: Date;
    } = {
      totalStored: this.errors.length,
      uniqueErrors: this.errorCounts.size,
    };

    if (this.errors.length > 0) {
      const oldestError = this.errors[this.errors.length - 1]?.timestamp;
      const newestError = this.errors[0]?.timestamp;

      if (oldestError) result.oldestError = oldestError;
      if (newestError) result.newestError = newestError;
    }

    return result;
  }

  /**
   * Check if error rate is above threshold
   */
  isErrorRateHigh(windowMinutes: number = 5, threshold: number = 10): boolean {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentErrors = this.errors.filter(
      (error) => error.timestamp >= cutoffTime && error.level === 'error',
    );

    return recentErrors.length > threshold;
  }

  /**
   * Get error rate per minute
   */
  getErrorRate(windowMinutes: number = 5): number {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentErrors = this.errors.filter(
      (error) => error.timestamp >= cutoffTime && error.level === 'error',
    );

    return recentErrors.length / windowMinutes;
  }

  /**
   * Private helper methods
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendToExternalService(errorEvent: ErrorEvent): Promise<void> {
    try {
      // In a real implementation, you would send to services like:
      // - Sentry
      // - Rollbar
      // - Bugsnag
      // - Custom logging service

      // For now, just log that we would send it
      this.logger.debug(
        `Would send error to external service: ${errorEvent.id}`,
      );
    } catch (error) {
      this.logger.error('Failed to send error to external service:', error);
    }
  }
}
