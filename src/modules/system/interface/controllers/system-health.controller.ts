import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemHealthService } from '../../application/services/system-health.service';

interface SystemHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  version?: string;
  uptime: number;
  environment: string;
}

interface LivenessResponse {
  alive: boolean;
  timestamp: string;
}

interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
    environment: boolean;
  };
}

@ApiTags('System')
@Controller('_system/health')
export class SystemHealthController {
  private readonly logger = new Logger(SystemHealthController.name);
  private readonly startTime = Date.now();

  constructor(private readonly healthService: SystemHealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({
    status: 200,
    description: 'System health status',
  })
  async healthCheck(): Promise<SystemHealthResponse> {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'backend-node',
        version: process.env.npm_package_version || '1.0.0',
        uptime,
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      this.logger.error('Health check failed', error);

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'backend-node',
        version: process.env.npm_package_version || '1.0.0',
        uptime: 0,
        environment: process.env.NODE_ENV || 'development',
      };
    }
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
  })
  async livenessCheck(): Promise<LivenessResponse> {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
  })
  async readinessCheck(): Promise<ReadinessResponse> {
    const checks = {
      database: await this.healthService.checkDatabaseConnection(),
      redis: await this.healthService.checkRedisConnection(),
      environment: this.checkEnvironment(),
    };

    const ready = Object.values(checks).every((check) => check === true);

    const response: ReadinessResponse = {
      ready,
      timestamp: new Date().toISOString(),
      checks,
    };

    if (!ready) {
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }

  private checkEnvironment(): boolean {
    try {
      return !!(
        process.env.THIRDWEB_SECRET_KEY && process.env.THIRDWEB_CLIENT_ID
      );
    } catch {
      return false;
    }
  }
}
