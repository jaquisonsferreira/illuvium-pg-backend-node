import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ObservabilityService } from '../interface/services/observability.service';
import { Observable } from '../interface/decorators/observable.decorator';

@ApiTags('improved-observability-example')
@Controller('improved-example')
export class ImprovedExampleController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check with decorator observability' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @Observable({
    operationName: 'health-check',
    metricsPrefix: 'health_check',
    description: 'Health check endpoint',
    attributes: {
      'endpoint.type': 'health',
      'service.component': 'improved-controller',
    },
    labels: {
      endpoint: '/improved-example/health',
    },
  })
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    return {
      status: 'healthy',
      timestamp: Date.now(),
    };
  }

  @Post('process/:id')
  @ApiOperation({ summary: 'Process data with decorator observability' })
  @ApiResponse({ status: 200, description: 'Data processed successfully' })
  @Observable({
    operationName: 'process-data',
    metricsPrefix: 'data_processing',
    description: 'Data processing operation',
    attributes: {
      'operation.type': 'data-processing',
    },
    labels: {
      operation: 'process',
    },
  })
  async processData(
    @Param('id') id: string,
    @Body() data: { value: number; type: string },
  ): Promise<{ id: string; result: number; processingTime: number }> {
    const startTime = Date.now();

    await this.simulateProcessing(data.value);

    const processingTime = Date.now() - startTime;
    const result = data.value * 2;

    await this.observabilityService.recordMetric({
      name: 'processing_queue_size',
      type: 'gauge' as any,
      value: Math.floor(Math.random() * 10),
      description: 'Current processing queue size',
      unit: 'items',
      labels: {
        'data.type': data.type,
      },
    });

    return {
      id,
      result,
      processingTime,
    };
  }

  @Get('simulate-error')
  @ApiOperation({ summary: 'Simulate error with decorator observability' })
  @ApiResponse({ status: 500, description: 'Simulated error' })
  @Observable({
    operationName: 'simulate-error',
    metricsPrefix: 'error_simulation',
    description: 'Error simulation for testing',
    attributes: {
      'test.scenario': 'intentional-error',
      'operation.type': 'error-simulation',
    },
    labels: {
      'test.type': 'error-handling',
    },
  })
  async simulateError(): Promise<never> {
    throw new HttpException(
      'This is a simulated error with decorator observability',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  @Get('business-logic/:userId')
  @ApiOperation({ summary: 'Complex business logic with observability' })
  @ApiResponse({ status: 200, description: 'Business logic executed' })
  @Observable({
    operationName: 'complex-business-logic',
    metricsPrefix: 'business_logic',
    description: 'Complex business operation',
    attributes: {
      'operation.complexity': 'high',
      'business.domain': 'user-management',
    },
  })
  async complexBusinessLogic(
    @Param('userId') userId: string,
  ): Promise<{ userId: string; operations: string[]; executionTime: number }> {
    const startTime = Date.now();
    const operations: string[] = [];

    operations.push('validate-user');
    await this.simulateOperation(50);

    operations.push('load-user-data');
    await this.simulateOperation(100);

    operations.push('process-business-rules');
    await this.simulateOperation(200);

    operations.push('save-results');
    await this.simulateOperation(75);

    return {
      userId,
      operations,
      executionTime: Date.now() - startTime,
    };
  }

  @Get('minimal-observability')
  @ApiOperation({ summary: 'Minimal observability configuration' })
  @ApiResponse({
    status: 200,
    description: 'Operation with minimal observability',
  })
  @Observable()
  async minimalObservability(): Promise<{ message: string }> {
    return { message: 'This method has minimal observability configuration' };
  }

  @Get('custom-metrics-only')
  @ApiOperation({ summary: 'Only custom metrics, no automatic ones' })
  @ApiResponse({ status: 200, description: 'Custom metrics only' })
  @Observable({
    recordCounter: false,
    recordDuration: false,
    recordErrors: false,
    recordMetrics: false,
  })
  async customMetricsOnly(): Promise<{ message: string }> {
    await this.observabilityService.recordMetric({
      name: 'custom_operation_executed',
      type: 'counter' as any,
      value: 1,
      description: 'Custom operation executed',
      labels: {
        'custom.operation': 'true',
      },
    });

    return { message: 'Operation with custom metrics only' };
  }

  private async simulateProcessing(value: number): Promise<void> {
    const processingTime = Math.min(value * 10, 1000);

    if (value > 100) {
      throw new HttpException(
        'Value too large to process',
        HttpStatus.BAD_REQUEST,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, processingTime));
  }

  private async simulateOperation(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }
}
