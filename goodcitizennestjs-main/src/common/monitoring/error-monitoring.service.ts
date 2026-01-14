/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastError: Date | null;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  requestCount: number;
  errorRate: number;
}

export interface AlertThresholds {
  errorRateThreshold: number;
  memoryThreshold: number;
  responseTimeThreshold: number;
  consecutiveErrorsThreshold: number;
}

@Injectable()
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);
  private errorCounts = new Map<string, number>();
  private errorsByEndpoint = new Map<string, number>();
  private errorsByType = new Map<string, number>();
  private requestCounts = new Map<string, number>();
  private responseTimes = new Map<string, number[]>();
  private consecutiveErrors = new Map<string, number>();
  private lastErrors = new Map<string, Date>();
  private startTime = Date.now();

  private readonly alertThresholds: AlertThresholds = {
    errorRateThreshold: 0.05, // 5% error rate
    memoryThreshold: 0.9, // 90% memory usage
    responseTimeThreshold: 5000, // 5 seconds
    consecutiveErrorsThreshold: 10,
  };

  constructor(private configService: ConfigService) {
    // Start periodic monitoring
    this.startPeriodicMonitoring();
  }

  /**
   * Log error with context and metrics
   */
  logError(
    error: Error,
    context: {
      endpoint?: string;
      userId?: string;
      operation?: string;
      metadata?: Record<string, any>;
    } = {},
  ): void {
    const errorType = error.constructor.name;
    const timestamp = new Date();

    // Update error metrics
    this.updateErrorMetrics(errorType, context.endpoint);

    // Log structured error
    const errorLog = {
      timestamp: timestamp.toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        type: errorType,
      },
      context: {
        endpoint: context.endpoint,
        userId: context.userId,
        operation: context.operation,
        metadata: context.metadata,
      },
      metrics: {
        errorCount: this.errorCounts.get(errorType) || 0,
        consecutiveErrors:
          this.consecutiveErrors.get(context.endpoint || 'unknown') || 0,
      },
    };

    this.logger.error('Application Error', JSON.stringify(errorLog, null, 2));

    // Check for alert conditions
    this.checkAlertConditions(context.endpoint, errorType);
  }

  /**
   * Log request metrics
   */
  logRequest(
    endpoint: string,
    responseTime: number,
    statusCode: number,
    userId?: string,
  ): void {
    // Update request counts
    const currentCount = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, currentCount + 1);

    // Track response times
    const times = this.responseTimes.get(endpoint) || [];
    times.push(responseTime);

    // Keep only last 100 response times per endpoint
    if (times.length > 100) {
      times.shift();
    }
    this.responseTimes.set(endpoint, times);

    // Reset consecutive errors on successful request
    if (statusCode < 400) {
      this.consecutiveErrors.set(endpoint, 0);
    } else {
      // Increment consecutive errors for client/server errors
      const consecutive = this.consecutiveErrors.get(endpoint) || 0;
      this.consecutiveErrors.set(endpoint, consecutive + 1);
    }

    // Log slow requests
    if (responseTime > this.alertThresholds.responseTimeThreshold) {
      this.logger.warn(
        `Slow request detected: ${endpoint} took ${responseTime}ms (threshold: ${this.alertThresholds.responseTimeThreshold}ms)`,
        { endpoint, responseTime, statusCode, userId },
      );
    }
  }

  /**
   * Get current error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalRequests = Array.from(this.requestCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    const errorsByType: Record<string, number> = {};
    for (const [type, count] of this.errorsByType) {
      errorsByType[type] = count;
    }

    const errorsByEndpoint: Record<string, number> = {};
    for (const [endpoint, count] of this.errorsByEndpoint) {
      errorsByEndpoint[endpoint] = count;
    }

    const lastErrorTimes = Array.from(this.lastErrors.values());
    const lastError =
      lastErrorTimes.length > 0
        ? new Date(Math.max(...lastErrorTimes.map((d) => d.getTime())))
        : null;

    return {
      errorCount: totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      lastError,
      errorsByType,
      errorsByEndpoint,
    };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    const totalRequests = Array.from(this.requestCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const errorMetrics = this.getErrorMetrics();

    return {
      uptime,
      memoryUsage,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      activeConnections: 0, // Would need to be tracked separately
      requestCount: totalRequests,
      errorRate: errorMetrics.errorRate,
    };
  }

  /**
   * Get response time statistics for endpoint
   */
  getResponseTimeStats(endpoint: string): {
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const times = this.responseTimes.get(endpoint);
    if (!times || times.length === 0) {
      return null;
    }

    const sorted = [...times].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      average: times.reduce((sum, time) => sum + time, 0) / length,
      min: sorted[0] ?? 0,
      max: sorted[length - 1] ?? 0,
      p95: sorted[Math.floor(length * 0.95)] ?? 0,
      p99: sorted[Math.floor(length * 0.99)] ?? 0,
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    checks: Record<string, { healthy: boolean; message: string }>;
  } {
    const checks: Record<string, { healthy: boolean; message: string }> = {};
    let overallHealthy = true;

    // Check error rate
    const errorMetrics = this.getErrorMetrics();
    const errorRateHealthy =
      errorMetrics.errorRate <= this.alertThresholds.errorRateThreshold;
    checks.errorRate = {
      healthy: errorRateHealthy,
      message: `Error rate: ${(errorMetrics.errorRate * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.errorRateThreshold * 100).toFixed(2)}%)`,
    };
    if (!errorRateHealthy) overallHealthy = false;

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const memoryHealthy =
      memoryUsagePercent <= this.alertThresholds.memoryThreshold;
    checks.memory = {
      healthy: memoryHealthy,
      message: `Memory usage: ${(memoryUsagePercent * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.memoryThreshold * 100).toFixed(2)}%)`,
    };
    if (!memoryHealthy) overallHealthy = false;

    // Check consecutive errors
    let maxConsecutiveErrors = 0;
    for (const count of this.consecutiveErrors.values()) {
      maxConsecutiveErrors = Math.max(maxConsecutiveErrors, count);
    }
    const consecutiveErrorsHealthy =
      maxConsecutiveErrors < this.alertThresholds.consecutiveErrorsThreshold;
    checks.consecutiveErrors = {
      healthy: consecutiveErrorsHealthy,
      message: `Max consecutive errors: ${maxConsecutiveErrors} (threshold: ${this.alertThresholds.consecutiveErrorsThreshold})`,
    };
    if (!consecutiveErrorsHealthy) overallHealthy = false;

    return {
      healthy: overallHealthy,
      checks,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.errorCounts.clear();
    this.errorsByEndpoint.clear();
    this.errorsByType.clear();
    this.requestCounts.clear();
    this.responseTimes.clear();
    this.consecutiveErrors.clear();
    this.lastErrors.clear();
    this.startTime = Date.now();

    this.logger.log('Monitoring metrics reset');
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(errorType: string, endpoint?: string): void {
    // Update error counts by type
    const typeCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, typeCount + 1);
    this.errorsByType.set(errorType, typeCount + 1);

    // Update error counts by endpoint
    if (endpoint) {
      const endpointCount = this.errorsByEndpoint.get(endpoint) || 0;
      this.errorsByEndpoint.set(endpoint, endpointCount + 1);

      // Update consecutive errors
      const consecutive = this.consecutiveErrors.get(endpoint) || 0;
      this.consecutiveErrors.set(endpoint, consecutive + 1);
    }

    // Update last error time
    this.lastErrors.set(errorType, new Date());
  }

  /**
   * Check alert conditions and log warnings
   */
  private checkAlertConditions(endpoint?: string, errorType?: string): void {
    // Check consecutive errors
    if (endpoint) {
      const consecutive = this.consecutiveErrors.get(endpoint) || 0;
      if (consecutive >= this.alertThresholds.consecutiveErrorsThreshold) {
        this.logger.error(
          `ALERT: ${consecutive} consecutive errors on endpoint ${endpoint} (threshold: ${this.alertThresholds.consecutiveErrorsThreshold})`,
        );
      }
    }

    // Check error rate
    const errorMetrics = this.getErrorMetrics();
    if (errorMetrics.errorRate > this.alertThresholds.errorRateThreshold) {
      this.logger.error(
        `ALERT: High error rate ${(errorMetrics.errorRate * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.errorRateThreshold * 100).toFixed(2)}%)`,
      );
    }
  }

  /**
   * Start periodic monitoring and cleanup
   */
  private startPeriodicMonitoring(): void {
    // Log system metrics every 5 minutes
    setInterval(
      () => {
        const metrics = this.getSystemMetrics();
        this.logger.log('System Metrics', JSON.stringify(metrics, null, 2));
      },
      5 * 60 * 1000,
    );

    // Cleanup old response time data every hour
    setInterval(
      () => {
        for (const [endpoint, times] of this.responseTimes) {
          if (times.length > 100) {
            this.responseTimes.set(endpoint, times.slice(-100));
          }
        }
      },
      60 * 60 * 1000,
    );
  }
}
