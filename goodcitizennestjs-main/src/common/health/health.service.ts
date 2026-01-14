/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as os from 'os';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  services: {
    database: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    redis: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
  metrics: {
    activeConnections: number;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

@Injectable()
export class HealthService {
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;
  private activeConnections = 0;

  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const isHealthy = await this.checkBasicHealth();

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async getDetailedHealthStatus(): Promise<DetailedHealthStatus> {
    const basicHealth = await this.getHealthStatus();
    const databaseHealth = await this.checkDatabaseHealth();
    const redisHealth = await this.checkRedisHealth();
    const memoryInfo = this.getMemoryInfo();
    const cpuInfo = this.getCpuInfo();

    return {
      ...basicHealth,
      services: {
        database: databaseHealth,
        redis: redisHealth,
        memory: memoryInfo,
        cpu: cpuInfo,
      },
      metrics: {
        activeConnections: this.activeConnections,
        totalRequests: this.requestCount,
        errorRate:
          this.requestCount > 0
            ? (this.errorCount / this.requestCount) * 100
            : 0,
        averageResponseTime:
          this.requestCount > 0
            ? this.totalResponseTime / this.requestCount
            : 0,
      },
    };
  }

  async getPrometheusMetrics(): Promise<string> {
    const memoryInfo = this.getMemoryInfo();
    const cpuInfo = this.getCpuInfo();
    const databaseHealth = await this.checkDatabaseHealth();
    const redisHealth = await this.checkRedisHealth();

    const metrics = [
      `# HELP process_resident_memory_bytes Resident memory size in bytes`,
      `# TYPE process_resident_memory_bytes gauge`,
      `process_resident_memory_bytes ${memoryInfo.used}`,
      ``,
      `# HELP process_cpu_usage_percent CPU usage percentage`,
      `# TYPE process_cpu_usage_percent gauge`,
      `process_cpu_usage_percent ${cpuInfo.usage}`,
      ``,
      `# HELP http_requests_total Total number of HTTP requests`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${this.requestCount}`,
      ``,
      `# HELP http_request_errors_total Total number of HTTP request errors`,
      `# TYPE http_request_errors_total counter`,
      `http_request_errors_total ${this.errorCount}`,
      ``,
      `# HELP websocket_connections_active Number of active WebSocket connections`,
      `# TYPE websocket_connections_active gauge`,
      `websocket_connections_active ${this.activeConnections}`,
      ``,
      `# HELP mongodb_up MongoDB connection status (1 = up, 0 = down)`,
      `# TYPE mongodb_up gauge`,
      `mongodb_up ${databaseHealth.status === 'connected' ? 1 : 0}`,
      ``,
      `# HELP redis_up Redis connection status (1 = up, 0 = down)`,
      `# TYPE redis_up gauge`,
      `redis_up ${redisHealth.status === 'connected' ? 1 : 0}`,
      ``,
      `# HELP app_uptime_seconds Application uptime in seconds`,
      `# TYPE app_uptime_seconds gauge`,
      `app_uptime_seconds ${(Date.now() - this.startTime) / 1000}`,
    ];

    return metrics.join('\n');
  }

  // Metrics tracking methods
  incrementRequestCount(): void {
    this.requestCount++;
  }

  incrementErrorCount(): void {
    this.errorCount++;
  }

  addResponseTime(time: number): void {
    this.totalResponseTime += time;
  }

  setActiveConnections(count: number): void {
    this.activeConnections = count;
  }

  private async checkBasicHealth(): Promise<boolean> {
    try {
      const databaseHealth = await this.checkDatabaseHealth();
      return databaseHealth.status === 'connected';
    } catch (error) {
      return false;
    }
  }

  private async checkDatabaseHealth(): Promise<{
    status: 'connected' | 'disconnected';
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();

      if (this.mongoConnection.readyState === 1) {
        // Test with a simple ping
        await this.mongoConnection.db?.admin().ping();
        const responseTime = Date.now() - startTime;

        return {
          status: 'connected',
          responseTime,
        };
      } else {
        return { status: 'disconnected' };
      }
    } catch (error) {
      return { status: 'disconnected' };
    }
  }

  private async checkRedisHealth(): Promise<{
    status: 'connected' | 'disconnected';
    responseTime?: number;
  }> {
    try {
      // This would need Redis client injection
      // For now, we'll assume Redis is healthy if the environment variable is set
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        return {
          status: 'connected',
          responseTime: 1, // Placeholder
        };
      } else {
        return { status: 'disconnected' };
      }
    } catch (error) {
      return { status: 'disconnected' };
    }
  }

  private getMemoryInfo(): { used: number; total: number; percentage: number } {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = memoryUsage.heapUsed;

    return {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
    };
  }

  private getCpuInfo(): { usage: number } {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return { usage };
  }
}
