import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get application health status' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  @ApiResponse({ status: 503, description: 'Application is unhealthy' })
  async getHealth() {
    return this.healthService.getHealthStatus();
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Get detailed health status' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async getDetailedHealth() {
    return this.healthService.getDetailedHealthStatus();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get application metrics for Prometheus' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics' })
  async getMetrics() {
    return this.healthService.getPrometheusMetrics();
  }
}
