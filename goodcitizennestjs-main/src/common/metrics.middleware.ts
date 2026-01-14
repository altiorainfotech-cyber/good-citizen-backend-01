import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MetricsMiddleware.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;

    // Capture middleware context
    const monitoringService = this.monitoringService;
    const logger = this.logger;

    // Track connection start
    this.monitoringService.recordConnectionChange(1);

    // Override response methods to capture metrics
    res.send = function (body: any) {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;

      // Record request metrics
      monitoringService.recordRequest(responseTime, isError);

      // Log slow requests
      if (responseTime > 1000) {
        logger.warn(
          `Slow request: ${req.method} ${req.originalUrl} - ${responseTime}ms`,
        );
      }

      // Log errors
      if (isError) {
        logger.warn(
          `Error request: ${req.method} ${req.originalUrl} - ${res.statusCode}`,
        );
      }

      return originalSend.call(this, body);
    };

    res.json = function (body: any) {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;

      // Record request metrics
      monitoringService.recordRequest(responseTime, isError);

      // Log slow requests
      if (responseTime > 1000) {
        logger.warn(
          `Slow request: ${req.method} ${req.originalUrl} - ${responseTime}ms`,
        );
      }

      // Log errors
      if (isError) {
        logger.warn(
          `Error request: ${req.method} ${req.originalUrl} - ${res.statusCode}`,
        );
      }

      return originalJson.call(this, body);
    };

    // Track connection end
    res.on('finish', () => {
      this.monitoringService.recordConnectionChange(-1);
    });

    res.on('close', () => {
      this.monitoringService.recordConnectionChange(-1);
    });

    next();
  }
}
