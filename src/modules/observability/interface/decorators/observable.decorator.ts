import { SetMetadata } from '@nestjs/common';
import { MetricType } from '../../domain/entities/metric.entity';

export interface ObservableOptions {
  operationName?: string;
  recordMetrics?: boolean;
  metricsPrefix?: string;
  attributes?: Record<string, any>;
  labels?: Record<string, string>;
  recordDuration?: boolean;
  recordCounter?: boolean;
  recordErrors?: boolean;
  description?: string;
}

export const OBSERVABLE_METADATA_KEY = 'observable';

export function Observable(options: ObservableOptions = {}): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    // Set metadata for the interceptor to use
    SetMetadata(OBSERVABLE_METADATA_KEY, {
      operationName:
        options.operationName || `${target.constructor.name}.${methodName}`,
      recordMetrics: options.recordMetrics ?? true,
      metricsPrefix: options.metricsPrefix || methodName.toLowerCase(),
      attributes: options.attributes || {},
      labels: options.labels || {},
      recordDuration: options.recordDuration ?? true,
      recordCounter: options.recordCounter ?? true,
      recordErrors: options.recordErrors ?? true,
      description: options.description || `Operation: ${methodName}`,
      ...options,
    })(target, propertyKey, descriptor);

    descriptor.value = async function (...args: any[]) {
      const observabilityService = this.observabilityService;

      if (!observabilityService) {
        console.warn(
          `ObservabilityService not found in ${target.constructor.name}. ` +
            'Make sure to inject it as "observabilityService" to use @Observable decorator.',
        );
        return originalMethod.apply(this, args);
      }

      const config = {
        operationName:
          options.operationName || `${target.constructor.name}.${methodName}`,
        recordMetrics: options.recordMetrics ?? true,
        metricsPrefix: options.metricsPrefix || methodName.toLowerCase(),
        attributes: options.attributes || {},
        labels: options.labels || {},
        recordDuration: options.recordDuration ?? true,
        recordCounter: options.recordCounter ?? true,
        recordErrors: options.recordErrors ?? true,
        description: options.description || `Operation: ${methodName}`,
      };

      const startTime = Date.now();
      let span = null;

      try {
        // Create span with attributes
        const spanResult = await observabilityService.createSpan({
          operationName: config.operationName,
          attributes: {
            'method.name': methodName,
            'class.name': target.constructor.name,
            'operation.type': 'method-call',
            ...config.attributes,
          },
        });
        span = spanResult.context;

        // Execute the original method
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // Record success metrics
        if (config.recordMetrics) {
          if (config.recordDuration) {
            await observabilityService.recordMetric({
              name: `${config.metricsPrefix}_duration_ms`,
              type: MetricType.HISTOGRAM,
              value: duration,
              description: `${config.description} - Duration in milliseconds`,
              unit: 'ms',
              labels: {
                method: methodName,
                class: target.constructor.name,
                status: 'success',
                ...config.labels,
              },
            });
          }

          if (config.recordCounter) {
            await observabilityService.recordMetric({
              name: `${config.metricsPrefix}_total`,
              type: MetricType.COUNTER,
              value: 1,
              description: `${config.description} - Total executions`,
              labels: {
                method: methodName,
                class: target.constructor.name,
                status: 'success',
                ...config.labels,
              },
            });
          }
        }

        // Finish span with success attributes
        await observabilityService.finishSpan(span, {
          'execution.duration_ms': duration,
          'execution.status': 'success',
          'result.type': typeof result,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Record exception
        if (span) {
          await observabilityService.recordException(error, span);
        }

        // Record error metrics
        if (config.recordMetrics && config.recordErrors) {
          await observabilityService.recordMetric({
            name: `${config.metricsPrefix}_errors_total`,
            type: MetricType.COUNTER,
            value: 1,
            description: `${config.description} - Total errors`,
            labels: {
              method: methodName,
              class: target.constructor.name,
              error_type: error.constructor.name,
              status: 'error',
              ...config.labels,
            },
          });

          if (config.recordDuration) {
            await observabilityService.recordMetric({
              name: `${config.metricsPrefix}_duration_ms`,
              type: MetricType.HISTOGRAM,
              value: duration,
              description: `${config.description} - Duration in milliseconds`,
              unit: 'ms',
              labels: {
                method: methodName,
                class: target.constructor.name,
                status: 'error',
                ...config.labels,
              },
            });
          }
        }

        // Finish span with error attributes
        if (span) {
          await observabilityService.finishSpan(span, {
            'execution.duration_ms': duration,
            'execution.status': 'error',
            'error.type': error.constructor.name,
            'error.message': error.message,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}
