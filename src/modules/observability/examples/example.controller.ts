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
import { MetricType } from '../domain/entities/metric.entity';

@ApiTags('observability-example')
@Controller('example')
export class ExampleController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check with observability' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    const { context } = await this.observabilityService.createSpan({
      operationName: 'health-check',
      attributes: {
        'operation.type': 'health-check',
        'service.component': 'example-controller',
      },
    });

    try {
      await this.observabilityService.recordMetric({
        name: 'health_checks_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Total number of health checks performed',
        labels: {
          endpoint: '/example/health',
          status: 'success',
        },
      });

      const response = {
        status: 'healthy',
        timestamp: Date.now(),
      };

      await this.observabilityService.finishSpan(context, {
        'response.status': 'success',
        'response.size': JSON.stringify(response).length,
      });

      return response;
    } catch (error) {
      await this.observabilityService.recordException(error, context);

      await this.observabilityService.recordMetric({
        name: 'health_check_errors_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Total number of health check errors',
        labels: {
          endpoint: '/example/health',
          error_type: error.constructor.name,
        },
      });

      await this.observabilityService.finishSpan(context, {
        'response.status': 'error',
        'error.message': error.message,
      });

      throw error;
    }
  }

  @Post('process/:id')
  @ApiOperation({ summary: 'Process data with observability tracking' })
  @ApiResponse({ status: 200, description: 'Data processed successfully' })
  async processData(
    @Param('id') id: string,
    @Body() data: { value: number; type: string },
  ): Promise<{ id: string; result: number; processingTime: number }> {
    const startTime = Date.now();

    const { context } = await this.observabilityService.createSpan({
      operationName: 'process-data',
      attributes: {
        'operation.type': 'data-processing',
        'data.id': id,
        'data.type': data.type,
        'data.value': data.value,
        'user.operation': 'process',
      },
    });

    try {
      await this.simulateProcessing(data.value);

      const processingTime = Date.now() - startTime;
      const result = data.value * 2;

      await this.observabilityService.recordMetric({
        name: 'data_processing_duration_ms',
        type: MetricType.HISTOGRAM,
        value: processingTime,
        description: 'Time taken to process data',
        unit: 'ms',
        labels: {
          'data.type': data.type,
          operation: 'process',
        },
      });

      await this.observabilityService.recordMetric({
        name: 'data_processed_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Total number of data items processed',
        labels: {
          'data.type': data.type,
          status: 'success',
        },
      });

      await this.observabilityService.recordMetric({
        name: 'processing_queue_size',
        type: MetricType.GAUGE,
        value: Math.floor(Math.random() * 10),
        description: 'Current number of items in processing queue',
        unit: 'items',
      });

      const response = {
        id,
        result,
        processingTime,
      };

      await this.observabilityService.finishSpan(context, {
        'response.status': 'success',
        'processing.duration_ms': processingTime,
        'processing.result': result,
        'response.size': JSON.stringify(response).length,
      });

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.observabilityService.recordException(error, context);

      await this.observabilityService.recordMetric({
        name: 'data_processing_errors_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Total number of data processing errors',
        labels: {
          'data.type': data.type,
          error_type: error.constructor.name,
          operation: 'process',
        },
      });

      await this.observabilityService.finishSpan(context, {
        'response.status': 'error',
        'processing.duration_ms': processingTime,
        'error.message': error.message,
        'error.type': error.constructor.name,
      });

      throw error;
    }
  }

  @Get('simulate-error')
  @ApiOperation({ summary: 'Simulate an error for observability testing' })
  @ApiResponse({ status: 500, description: 'Simulated error' })
  async simulateError(): Promise<never> {
    const { context } = await this.observabilityService.createSpan({
      operationName: 'simulate-error',
      attributes: {
        'operation.type': 'error-simulation',
        'test.scenario': 'intentional-error',
      },
    });

    try {
      await this.observabilityService.recordMetric({
        name: 'error_simulations_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Total number of intentional error simulations',
        labels: {
          endpoint: '/example/simulate-error',
          'test.type': 'error-handling',
        },
      });

      throw new HttpException(
        'This is a simulated error for testing observability',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } catch (error) {
      await this.observabilityService.recordException(error, context);
      await this.observabilityService.finishSpan(context, {
        'response.status': 'error',
        'error.simulated': true,
      });

      throw error;
    }
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
}
