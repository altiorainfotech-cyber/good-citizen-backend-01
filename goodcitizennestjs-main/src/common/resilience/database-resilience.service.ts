/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class DatabaseResilienceService {
  private readonly logger = new Logger(DatabaseResilienceService.name);
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private failureCounts = new Map<string, number>();
  private lastFailureTime = new Map<string, number>();
  private successCounts = new Map<string, number>();

  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  private readonly defaultCircuitBreakerOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringWindow: 300000, // 5 minutes
  };

  constructor(private configService: ConfigService) {}

  /**
   * Execute database operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: Partial<RetryOptions>,
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        const result = await this.executeWithCircuitBreaker(
          operation,
          operationName,
        );

        if (attempt > 0) {
          this.logger.log(
            `Database operation '${operationName}' succeeded on attempt ${attempt + 1}`,
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === retryOptions.maxRetries) {
          this.logger.error(
            `Database operation '${operationName}' failed after ${retryOptions.maxRetries + 1} attempts`,
            error,
          );
          break;
        }

        const delay = this.calculateBackoffDelay(attempt, retryOptions);
        this.logger.warn(
          `Database operation '${operationName}' failed on attempt ${attempt + 1}, retrying in ${delay}ms`,
          error,
        );

        await this.sleep(delay);
      }
    }

    if (!lastError) {
      throw new Error(`Operation '${operationName}' failed with unknown error`);
    }
    throw lastError;
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: Partial<CircuitBreakerOptions>,
  ): Promise<T> {
    const circuitOptions = { ...this.defaultCircuitBreakerOptions, ...options };
    const state = this.getCircuitBreakerState(operationName, circuitOptions);

    if (state === CircuitBreakerState.OPEN) {
      throw new Error(
        `Circuit breaker is OPEN for operation '${operationName}'. Service temporarily unavailable.`,
      );
    }

    try {
      const result = await operation();
      this.recordSuccess(operationName);
      return result;
    } catch (error) {
      this.recordFailure(operationName, circuitOptions);
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  private getCircuitBreakerState(
    operationName: string,
    options: CircuitBreakerOptions,
  ): CircuitBreakerState {
    const currentState =
      this.circuitBreakers.get(operationName) || CircuitBreakerState.CLOSED;
    const failureCount = this.failureCounts.get(operationName) || 0;
    const lastFailure = this.lastFailureTime.get(operationName) || 0;
    const now = Date.now();

    switch (currentState) {
      case CircuitBreakerState.CLOSED:
        if (failureCount >= options.failureThreshold) {
          this.logger.warn(
            `Circuit breaker opening for operation '${operationName}' due to ${failureCount} failures`,
          );
          this.circuitBreakers.set(operationName, CircuitBreakerState.OPEN);
          return CircuitBreakerState.OPEN;
        }
        return CircuitBreakerState.CLOSED;

      case CircuitBreakerState.OPEN:
        if (now - lastFailure >= options.resetTimeout) {
          this.logger.log(
            `Circuit breaker transitioning to HALF_OPEN for operation '${operationName}'`,
          );
          this.circuitBreakers.set(
            operationName,
            CircuitBreakerState.HALF_OPEN,
          );
          return CircuitBreakerState.HALF_OPEN;
        }
        return CircuitBreakerState.OPEN;

      case CircuitBreakerState.HALF_OPEN:
        return CircuitBreakerState.HALF_OPEN;

      default:
        return CircuitBreakerState.CLOSED;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationName: string): void {
    const currentState = this.circuitBreakers.get(operationName);

    if (currentState === CircuitBreakerState.HALF_OPEN) {
      const successCount = (this.successCounts.get(operationName) || 0) + 1;
      this.successCounts.set(operationName, successCount);

      // Close circuit breaker after successful test
      this.logger.log(
        `Circuit breaker closing for operation '${operationName}' after successful test`,
      );
      this.circuitBreakers.set(operationName, CircuitBreakerState.CLOSED);
      this.failureCounts.set(operationName, 0);
      this.successCounts.set(operationName, 0);
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(
    operationName: string,
    options: CircuitBreakerOptions,
  ): void {
    const failureCount = (this.failureCounts.get(operationName) || 0) + 1;
    this.failureCounts.set(operationName, failureCount);
    this.lastFailureTime.set(operationName, Date.now());

    const currentState = this.circuitBreakers.get(operationName);

    if (currentState === CircuitBreakerState.HALF_OPEN) {
      // Failure in half-open state immediately opens circuit
      this.logger.warn(
        `Circuit breaker opening for operation '${operationName}' due to failure in HALF_OPEN state`,
      );
      this.circuitBreakers.set(operationName, CircuitBreakerState.OPEN);
    }

    this.logger.error(
      `Database operation '${operationName}' failed (${failureCount} failures)`,
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(
    attempt: number,
    options: RetryOptions,
  ): number {
    const delay =
      options.baseDelay * Math.pow(options.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, options.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [operationName] of this.circuitBreakers) {
      status[operationName] = {
        state: this.circuitBreakers.get(operationName),
        failureCount: this.failureCounts.get(operationName) || 0,
        lastFailureTime: this.lastFailureTime.get(operationName),
        successCount: this.successCounts.get(operationName) || 0,
      };
    }

    return status;
  }

  /**
   * Reset circuit breaker for specific operation
   */
  resetCircuitBreaker(operationName: string): void {
    this.circuitBreakers.set(operationName, CircuitBreakerState.CLOSED);
    this.failureCounts.set(operationName, 0);
    this.successCounts.set(operationName, 0);
    this.lastFailureTime.delete(operationName);

    this.logger.log(`Circuit breaker reset for operation '${operationName}'`);
  }

  /**
   * Get health status for all operations
   */
  getHealthStatus(): {
    healthy: boolean;
    operations: Record<string, { state: string; healthy: boolean }>;
  } {
    const operations: Record<string, { state: string; healthy: boolean }> = {};
    let overallHealthy = true;

    for (const [operationName, state] of this.circuitBreakers) {
      const isHealthy = state !== CircuitBreakerState.OPEN;
      operations[operationName] = {
        state,
        healthy: isHealthy,
      };

      if (!isHealthy) {
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      operations,
    };
  }
}
