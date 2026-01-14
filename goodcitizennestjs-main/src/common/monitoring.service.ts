/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  DriverRide,
  DriverRideDocument,
} from '../driver/entities/driver-ride.entity';
import { ConfigService } from '@nestjs/config';

export interface SystemMetrics {
  timestamp: Date;
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectionCount: number;
    responseTime: number;
    collections: {
      users: { count: number; size: number };
      rides: { count: number; size: number };
    };
  };
  application: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    version: string;
    environment: string;
  };
  performance: {
    activeConnections: number;
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
  business: {
    activeUsers: number;
    activeDrivers: number;
    activeRides: number;
    completedRidesToday: number;
    emergencyRidesActive: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: { status: string; responseTime: number; message?: string };
    memory: { status: string; usage: number; limit: number; message?: string };
    disk: { status: string; usage: number; message?: string };
    external: {
      status: string;
      services: Array<{ name: string; status: string }>;
      message?: string;
    };
  };
}

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private startTime = Date.now();
  private metrics: SystemMetrics | null = null;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private activeConnections = 0;

  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DriverRide.name)
    private driverRideModel: Model<DriverRideDocument>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Monitoring service initialized');
    this.startMetricsCollection();
    this.startPerformanceTracking();
  }

  /**
   * Get comprehensive system health check
   */
  async getHealthCheck(): Promise<HealthCheckResult> {
    try {
      // Database health check
      const dbHealth = await this.checkDatabaseHealth();

      // Memory health check
      const memoryHealth = this.checkMemoryHealth();

      // Disk health check (basic)
      const diskHealth = this.checkDiskHealth();

      // External services health check
      const externalHealth = await this.checkExternalServices();

      // Determine overall status
      const checks = {
        database: dbHealth,
        memory: memoryHealth,
        disk: diskHealth,
        external: externalHealth,
      };
      const overallStatus = this.determineOverallHealth(checks);

      return {
        status: overallStatus,
        timestamp: new Date(),
        uptime: Date.now() - this.startTime,
        version: this.configService.get('npm_package_version', '1.0.0'),
        environment: this.configService.get('NODE_ENV', 'development'),
        checks,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        uptime: Date.now() - this.startTime,
        version: this.configService.get('npm_package_version', '1.0.0'),
        environment: this.configService.get('NODE_ENV', 'development'),
        checks: {
          database: {
            status: 'unhealthy',
            responseTime: -1,
            message: 'Health check failed',
          },
          memory: {
            status: 'unknown',
            usage: 0,
            limit: 0,
            message: 'Health check failed',
          },
          disk: { status: 'unknown', usage: 0, message: 'Health check failed' },
          external: {
            status: 'unknown',
            services: [],
            message: 'Health check failed',
          },
        },
      };
    }
  }

  /**
   * Get detailed system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const dbMetrics = await this.getDatabaseMetrics();
      const appMetrics = this.getApplicationMetrics();
      const perfMetrics = this.getPerformanceMetrics();
      const businessMetrics = await this.getBusinessMetrics();

      this.metrics = {
        timestamp: new Date(),
        database: dbMetrics,
        application: appMetrics,
        performance: perfMetrics,
        business: businessMetrics,
      };

      return this.metrics;
    } catch (error) {
      this.logger.error('Failed to collect system metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(): SystemMetrics['performance'] {
    // Calculate requests per minute (simplified)
    const requestsPerMinute = this.requestCount; // Reset every minute in real implementation

    // Calculate average response time
    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) /
          this.responseTimes.length
        : 0;

    // Calculate error rate
    const errorRate =
      this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    return {
      activeConnections: this.activeConnections,
      requestsPerMinute,
      averageResponseTime,
      errorRate,
    };
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);

    if (isError) {
      this.errorCount++;
    }

    // Keep only last 100 response times for memory efficiency
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  /**
   * Record active connection change
   */
  recordConnectionChange(delta: number): void {
    this.activeConnections = Math.max(0, this.activeConnections + delta);
  }

  /**
   * Get system alerts based on thresholds
   */
  async getSystemAlerts(): Promise<
    Array<{ level: 'warning' | 'critical'; message: string; timestamp: Date }>
  > {
    const alerts: Array<{
      level: 'warning' | 'critical';
      message: string;
      timestamp: Date;
    }> = [];
    const metrics = await this.getSystemMetrics();

    // Database alerts
    if (metrics.database.status === 'unhealthy') {
      alerts.push({
        level: 'critical',
        message: 'Database is unhealthy',
        timestamp: new Date(),
      });
    } else if (metrics.database.responseTime > 1000) {
      alerts.push({
        level: 'warning',
        message: `Database response time is high: ${metrics.database.responseTime}ms`,
        timestamp: new Date(),
      });
    }

    // Memory alerts
    const memoryUsagePercent =
      (metrics.application.memoryUsage.heapUsed /
        metrics.application.memoryUsage.heapTotal) *
      100;
    if (memoryUsagePercent > 90) {
      alerts.push({
        level: 'critical',
        message: `Memory usage is critical: ${memoryUsagePercent.toFixed(1)}%`,
        timestamp: new Date(),
      });
    } else if (memoryUsagePercent > 80) {
      alerts.push({
        level: 'warning',
        message: `Memory usage is high: ${memoryUsagePercent.toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    // Performance alerts
    if (metrics.performance.errorRate > 10) {
      alerts.push({
        level: 'critical',
        message: `Error rate is high: ${metrics.performance.errorRate.toFixed(1)}%`,
        timestamp: new Date(),
      });
    } else if (metrics.performance.errorRate > 5) {
      alerts.push({
        level: 'warning',
        message: `Error rate is elevated: ${metrics.performance.errorRate.toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    if (metrics.performance.averageResponseTime > 2000) {
      alerts.push({
        level: 'warning',
        message: `Average response time is high: ${metrics.performance.averageResponseTime.toFixed(0)}ms`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Log system metrics for monitoring
   */
  async logMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      const alerts = await this.getSystemAlerts();

      this.logger.log('System Metrics:', {
        database: metrics.database.status,
        dbResponseTime: `${metrics.database.responseTime}ms`,
        memoryUsage: `${(metrics.application.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`,
        activeUsers: metrics.business.activeUsers,
        activeDrivers: metrics.business.activeDrivers,
        activeRides: metrics.business.activeRides,
        errorRate: `${metrics.performance.errorRate.toFixed(1)}%`,
        avgResponseTime: `${metrics.performance.averageResponseTime.toFixed(0)}ms`,
      });

      if (alerts.length > 0) {
        this.logger.warn('System Alerts:', alerts);
      }
    } catch (error) {
      this.logger.error('Failed to log metrics:', error);
    }
  }

  /**
   * Private helper methods
   */
  private async checkDatabaseHealth(): Promise<{
    status: string;
    responseTime: number;
    message?: string;
  }> {
    const startTime = Date.now();

    try {
      // Test database connection with a simple query
      if (this.connection.db) {
        await this.connection.db.admin().ping();
      } else {
        throw new Error('Database connection not available');
      }
      const responseTime = Date.now() - startTime;

      if (responseTime > 1000) {
        return {
          status: 'degraded',
          responseTime,
          message: 'Slow database response',
        };
      }

      return { status: 'healthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkMemoryHealth(): {
    status: string;
    usage: number;
    limit: number;
    message?: string;
  } {
    const memoryUsage = process.memoryUsage();
    const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const limitMB = memoryUsage.heapTotal / 1024 / 1024;

    if (usagePercent > 90) {
      return {
        status: 'critical',
        usage: usagePercent,
        limit: limitMB,
        message: 'Memory usage critical',
      };
    } else if (usagePercent > 80) {
      return {
        status: 'warning',
        usage: usagePercent,
        limit: limitMB,
        message: 'Memory usage high',
      };
    }

    return { status: 'healthy', usage: usagePercent, limit: limitMB };
  }

  private checkDiskHealth(): {
    status: string;
    usage: number;
    message?: string;
  } {
    // Basic disk check - in production, you'd use fs.statSync or similar
    try {
      // Simplified disk usage check
      return { status: 'healthy', usage: 0 };
    } catch (error) {
      return { status: 'unhealthy', usage: 0, message: 'Disk check failed' };
    }
  }

  private async checkExternalServices(): Promise<{
    status: string;
    services: Array<{ name: string; status: string }>;
    message?: string;
  }> {
    const services: Array<{ name: string; status: string }> = [];

    try {
      // Check Auth0 (simplified)
      const auth0Status = this.configService.get('AUTH0_DOMAIN')
        ? 'configured'
        : 'not_configured';
      services.push({ name: 'Auth0', status: auth0Status });

      // Check Google API
      const googleApiStatus = this.configService.get('GOOGLE_API_KEY')
        ? 'configured'
        : 'not_configured';
      services.push({ name: 'Google API', status: googleApiStatus });

      return { status: 'healthy', services };
    } catch (error) {
      return {
        status: 'degraded',
        services,
        message: 'Some external services unavailable',
      };
    }
  }

  private determineOverallHealth(
    checks: any,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map((check: any) => check.status);

    if (statuses.includes('unhealthy') || statuses.includes('critical')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded') || statuses.includes('warning')) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    const startTime = Date.now();

    try {
      // Test database response time
      if (this.connection.db) {
        await this.connection.db.admin().ping();
      } else {
        throw new Error('Database connection not available');
      }
      const responseTime = Date.now() - startTime;

      // Get connection count
      const connectionCount = this.connection.readyState;

      // Get collection statistics (simplified)
      let userStats = { count: 0, size: 0 };
      let rideStats = { count: 0, size: 0 };

      try {
        if (this.connection.db) {
          // Use countDocuments instead of stats for better compatibility
          const [userCount, rideCount] = await Promise.all([
            this.userModel.countDocuments(),
            this.driverRideModel.countDocuments(),
          ]);
          userStats = { count: userCount, size: 0 }; // Size not available with countDocuments
          rideStats = { count: rideCount, size: 0 };
        }
      } catch (error) {
        this.logger.warn('Failed to get collection statistics:', error);
      }

      const status = responseTime > 1000 ? 'degraded' : 'healthy';

      return {
        status,
        connectionCount,
        responseTime,
        collections: {
          users: userStats,
          rides: rideStats,
        },
      };
    } catch (error) {
      this.logger.error('Database metrics collection failed:', error);
      return {
        status: 'unhealthy',
        connectionCount: 0,
        responseTime: Date.now() - startTime,
        collections: {
          users: { count: 0, size: 0 },
          rides: { count: 0, size: 0 },
        },
      };
    }
  }

  private getApplicationMetrics(): SystemMetrics['application'] {
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      version: this.configService.get('npm_package_version', '1.0.0'),
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }

  private async getBusinessMetrics(): Promise<SystemMetrics['business']> {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const [
        activeUsers,
        activeDrivers,
        activeRides,
        completedRidesToday,
        emergencyRidesActive,
      ] = await Promise.all([
        this.userModel.countDocuments({ role: 'USER', is_online: true }),
        this.userModel.countDocuments({
          role: 'DRIVER',
          is_online: true,
          approval: 'APPROVED',
        }),
        this.driverRideModel.countDocuments({
          status: {
            $in: [
              'driver_assigned',
              'driver_arriving',
              'driver_arrived',
              'in_progress',
            ],
          },
        }),
        this.driverRideModel.countDocuments({
          status: 'completed',
          ride_completed_at: { $gte: todayStart },
        }),
        this.driverRideModel.countDocuments({
          vehicle_type: 'EMERGENCY',
          status: {
            $in: [
              'driver_assigned',
              'driver_arriving',
              'driver_arrived',
              'in_progress',
            ],
          },
        }),
      ]);

      return {
        activeUsers,
        activeDrivers,
        activeRides,
        completedRidesToday,
        emergencyRidesActive,
      };
    } catch (error) {
      this.logger.error('Business metrics collection failed:', error);
      return {
        activeUsers: 0,
        activeDrivers: 0,
        activeRides: 0,
        completedRidesToday: 0,
        emergencyRidesActive: 0,
      };
    }
  }

  private startMetricsCollection(): void {
    // Log metrics every 5 minutes
    setInterval(
      async () => {
        await this.logMetrics();
      },
      5 * 60 * 1000,
    );

    // Reset request counters every minute
    setInterval(() => {
      this.requestCount = 0;
      this.errorCount = 0;
    }, 60 * 1000);
  }

  private startPerformanceTracking(): void {
    // Track process performance
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      if (memoryUsagePercent > 85) {
        this.logger.warn(
          `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        );
      }
    }, 30 * 1000); // Check every 30 seconds
  }
}
