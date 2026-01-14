/* eslint-disable @typescript-eslint/require-await */

import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import {
  MonitoringService,
  SystemMetrics,
  HealthCheckResult,
} from './monitoring.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/roles.decorator';
import { UserType } from './utils';

@ApiTags('Monitoring')
@Controller({ path: 'monitoring', version: '1' })
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Health check endpoint for load balancers and monitoring systems
   * Returns basic health status without authentication
   */
  @Get('health')
  @ApiOperation({
    summary: 'System Health Check',
    description:
      'Returns the current health status of the system including database, memory, and external services',
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Uptime in milliseconds' },
        version: { type: 'string' },
        environment: { type: 'string' },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                responseTime: { type: 'number' },
                message: { type: 'string' },
              },
            },
            memory: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                usage: { type: 'number' },
                limit: { type: 'number' },
                message: { type: 'string' },
              },
            },
            disk: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                usage: { type: 'number' },
                message: { type: 'string' },
              },
            },
            external: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                services: { type: 'array' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'System is unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['unhealthy'] },
        message: { type: 'string' },
      },
    },
  })
  async healthCheck(@Res() res: Response): Promise<void> {
    try {
      const healthResult: HealthCheckResult =
        await this.monitoringService.getHealthCheck();

      // Set appropriate HTTP status based on health
      const statusCode =
        healthResult.status === 'healthy'
          ? HttpStatus.OK
          : healthResult.status === 'degraded'
            ? HttpStatus.OK // Still return 200 for degraded but functional
            : HttpStatus.SERVICE_UNAVAILABLE;

      res.status(statusCode).json(healthResult);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        timestamp: new Date(),
        message: 'Health check failed',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  /**
   * Liveness probe for Kubernetes
   * Simple endpoint that returns 200 if the application is running
   */
  @Get('live')
  @ApiOperation({
    summary: 'Liveness Probe',
    description: 'Simple liveness check for container orchestration systems',
  })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  async livenessProbe(@Res() res: Response): Promise<void> {
    res.status(HttpStatus.OK).json({
      status: 'alive',
      timestamp: new Date(),
    });
  }

  /**
   * Readiness probe for Kubernetes
   * Returns 200 only if the application is ready to serve traffic
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness Probe',
    description: 'Readiness check for container orchestration systems',
  })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  async readinessProbe(@Res() res: Response): Promise<void> {
    try {
      const healthResult = await this.monitoringService.getHealthCheck();

      // Application is ready if database is healthy
      const isReady = healthResult.checks.database.status === 'healthy';

      if (isReady) {
        res.status(HttpStatus.OK).json({
          status: 'ready',
          timestamp: new Date(),
        });
      } else {
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          status: 'not_ready',
          timestamp: new Date(),
          reason: 'Database not healthy',
        });
      }
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        timestamp: new Date(),
        reason: 'Health check failed',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  /**
   * Detailed system metrics (requires authentication)
   * Returns comprehensive system metrics for monitoring dashboards
   */
  @Get('metrics')
  @ApiBearerAuth('authorization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({
    summary: 'System Metrics',
    description:
      'Returns detailed system metrics including database, application, performance, and business metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            connectionCount: { type: 'number' },
            responseTime: { type: 'number' },
            collections: {
              type: 'object',
              properties: {
                users: {
                  type: 'object',
                  properties: {
                    count: { type: 'number' },
                    size: { type: 'number' },
                  },
                },
                rides: {
                  type: 'object',
                  properties: {
                    count: { type: 'number' },
                    size: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        application: {
          type: 'object',
          properties: {
            uptime: { type: 'number' },
            memoryUsage: { type: 'object' },
            cpuUsage: { type: 'object' },
            version: { type: 'string' },
            environment: { type: 'string' },
          },
        },
        performance: {
          type: 'object',
          properties: {
            activeConnections: { type: 'number' },
            requestsPerMinute: { type: 'number' },
            averageResponseTime: { type: 'number' },
            errorRate: { type: 'number' },
          },
        },
        business: {
          type: 'object',
          properties: {
            activeUsers: { type: 'number' },
            activeDrivers: { type: 'number' },
            activeRides: { type: 'number' },
            completedRidesToday: { type: 'number' },
            emergencyRidesActive: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getMetrics(): Promise<SystemMetrics> {
    return await this.monitoringService.getSystemMetrics();
  }

  /**
   * System alerts endpoint (requires authentication)
   * Returns current system alerts and warnings
   */
  @Get('alerts')
  @ApiBearerAuth('authorization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({
    summary: 'System Alerts',
    description:
      'Returns current system alerts and warnings based on monitoring thresholds',
  })
  @ApiResponse({
    status: 200,
    description: 'System alerts retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['warning', 'critical'] },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAlerts(): Promise<
    Array<{ level: 'warning' | 'critical'; message: string; timestamp: Date }>
  > {
    return await this.monitoringService.getSystemAlerts();
  }

  /**
   * Performance metrics endpoint
   * Returns real-time performance data
   */
  @Get('performance')
  @ApiBearerAuth('authorization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({
    summary: 'Performance Metrics',
    description:
      'Returns real-time performance metrics including response times, error rates, and connection counts',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        activeConnections: { type: 'number' },
        requestsPerMinute: { type: 'number' },
        averageResponseTime: { type: 'number' },
        errorRate: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getPerformanceMetrics(): Promise<SystemMetrics['performance']> {
    return this.monitoringService.getPerformanceMetrics();
  }

  /**
   * Cache statistics endpoint
   * Returns information about query cache performance
   */
  @Get('cache')
  @ApiBearerAuth('authorization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({
    summary: 'Cache Statistics',
    description: 'Returns query cache statistics and performance information',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        size: { type: 'number', description: 'Number of cached entries' },
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Cache keys',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getCacheStats(): Promise<{ size: number; keys: string[] }> {
    // This would need to be implemented in the performance service
    // For now, return empty stats
    return { size: 0, keys: [] };
  }
}
