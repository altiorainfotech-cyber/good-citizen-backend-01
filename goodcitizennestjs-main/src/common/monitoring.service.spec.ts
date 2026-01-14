/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { User } from '../user/entities/user.entity';
import { DriverRide } from '../driver/entities/driver-ride.entity';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockConnection: any;
  let mockUserModel: any;
  let mockDriverRideModel: any;
  let mockConfigService: any;

  beforeEach(async () => {
    // Mock database connection
    mockConnection = {
      readyState: 1,
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({}),
        }),
      },
    };

    // Mock user model
    mockUserModel = {
      countDocuments: jest.fn().mockResolvedValue(10),
    };

    // Mock driver ride model
    mockDriverRideModel = {
      countDocuments: jest.fn().mockResolvedValue(5),
    };

    // Mock config service
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          npm_package_version: '1.0.0',
          NODE_ENV: 'test',
          AUTH0_DOMAIN: 'test.auth0.com',
          GOOGLE_API_KEY: 'test-key',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(DriverRide.name),
          useValue: mockDriverRideModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthCheck', () => {
    it('should return health check result', async () => {
      const result = await service.getHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBe('1.0.0');
      expect(result.environment).toBe('test');
      expect(result.checks).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.memory).toBeDefined();
      expect(result.checks.disk).toBeDefined();
      expect(result.checks.external).toBeDefined();
    });

    it('should return healthy status when all checks pass', async () => {
      const result = await service.getHealthCheck();

      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.external.status).toBe('healthy');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', async () => {
      const result = await service.getSystemMetrics();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.database).toBeDefined();
      expect(result.application).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.business).toBeDefined();
    });

    it('should include database metrics', async () => {
      const result = await service.getSystemMetrics();

      expect(result.database.status).toBeDefined();
      expect(result.database.connectionCount).toBe(1);
      expect(result.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.database.collections.users.count).toBe(10);
      expect(result.database.collections.rides.count).toBe(5);
    });

    it('should include application metrics', async () => {
      const result = await service.getSystemMetrics();

      expect(result.application.uptime).toBeGreaterThanOrEqual(0);
      expect(result.application.memoryUsage).toBeDefined();
      expect(result.application.cpuUsage).toBeDefined();
      expect(result.application.version).toBe('1.0.0');
      expect(result.application.environment).toBe('test');
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const result = service.getPerformanceMetrics();

      expect(result).toBeDefined();
      expect(result.activeConnections).toBeGreaterThanOrEqual(0);
      expect(result.requestsPerMinute).toBeGreaterThanOrEqual(0);
      expect(result.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordRequest', () => {
    it('should record request metrics', () => {
      const initialMetrics = service.getPerformanceMetrics();

      service.recordRequest(100, false);

      const updatedMetrics = service.getPerformanceMetrics();
      expect(updatedMetrics.requestsPerMinute).toBeGreaterThan(
        initialMetrics.requestsPerMinute,
      );
    });

    it('should record error requests', () => {
      service.recordRequest(100, true);

      const metrics = service.getPerformanceMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
    });
  });

  describe('recordConnectionChange', () => {
    it('should track connection changes', () => {
      const initialMetrics = service.getPerformanceMetrics();

      service.recordConnectionChange(5);

      const updatedMetrics = service.getPerformanceMetrics();
      expect(updatedMetrics.activeConnections).toBe(
        initialMetrics.activeConnections + 5,
      );
    });

    it('should not allow negative connections', () => {
      service.recordConnectionChange(-100);

      const metrics = service.getPerformanceMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });

  describe('getSystemAlerts', () => {
    it('should return system alerts', async () => {
      const result = await service.getSystemAlerts();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate memory alerts for high usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 950 * 1024 * 1024, // 950MB
        heapTotal: 1000 * 1024 * 1024, // 1GB
        external: 0,
        arrayBuffers: 0,
        rss: 1000 * 1024 * 1024,
      });

      const alerts = await service.getSystemAlerts();

      expect(
        alerts.some((alert) => alert.message.includes('Memory usage')),
      ).toBe(true);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });
});
