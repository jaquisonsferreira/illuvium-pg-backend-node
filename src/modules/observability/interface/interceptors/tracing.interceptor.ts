import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ObservabilityRepository } from '../../domain/repositories/observability.repository.interface';
import { MetricType } from '../../domain/entities/metric.entity';
import { OBSERVABILITY_REPOSITORY_TOKEN } from '../../domain/tokens/observability.tokens';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(
    @Inject(OBSERVABILITY_REPOSITORY_TOKEN)
    private readonly observabilityRepository: ObservabilityRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.observabilityRepository.isInitialized()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.recordHttpMetrics(request, response, startTime, false);
      }),
      catchError((error) => {
        this.recordHttpMetrics(request, response, startTime, true);
        this.recordException(error);
        throw error;
      }),
    );
  }

  private recordHttpMetrics(
    request: Request,
    response: Response,
    startTime: number,
    hasError: boolean,
  ): void {
    const duration = Date.now() - startTime;
    const statusCode = response.statusCode || (hasError ? 500 : 200);

    const labels = {
      method: request.method,
      route: request.route?.path || request.url,
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };

    // Record request duration
    this.observabilityRepository.recordMetric({
      name: 'http_request_duration_ms',
      type: MetricType.HISTOGRAM,
      value: duration,
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
      labels,
      timestamp: Date.now(),
    } as any);

    // Record request count
    this.observabilityRepository.recordMetric({
      name: 'http_requests_total',
      type: MetricType.COUNTER,
      value: 1,
      description: 'Total number of HTTP requests',
      labels,
      timestamp: Date.now(),
    } as any);

    // Record error count if applicable
    if (hasError) {
      this.observabilityRepository.recordMetric({
        name: 'http_request_errors_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Total number of HTTP request errors',
        labels,
        timestamp: Date.now(),
      } as any);
    }
  }

  private recordException(error: Error): void {
    this.observabilityRepository.recordException(error);
  }
}
