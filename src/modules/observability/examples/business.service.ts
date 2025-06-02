import { Injectable } from '@nestjs/common';
import { ObservabilityService } from '../interface/services/observability.service';
import { Observable } from '../interface/decorators/observable.decorator';
import { MetricType } from '../domain/entities/metric.entity';

export interface UserData {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface ProcessingResult {
  userId: string;
  operations: string[];
  duration: number;
  success: boolean;
}

@Injectable()
export class BusinessService {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Observable({
    operationName: 'create-user',
    metricsPrefix: 'user_creation',
    description: 'User creation operation',
    attributes: {
      'operation.type': 'user-management',
      'business.domain': 'user-service',
    },
    labels: {
      operation: 'create',
      domain: 'user',
    },
  })
  async createUser(
    userData: Omit<UserData, 'id' | 'createdAt'>,
  ): Promise<UserData> {
    await this.validateUserData(userData);

    const user: UserData = {
      id: Math.random().toString(36).substr(2, 9),
      name: userData.name,
      email: userData.email,
      createdAt: new Date(),
    };

    await this.simulateDatabase(100);

    await this.observabilityService.recordMetric({
      name: 'users_created_by_domain',
      type: MetricType.COUNTER,
      value: 1,
      description: 'Users created by domain',
      labels: {
        domain: userData.email.split('@')[1] || 'unknown',
      },
    });

    return user;
  }

  @Observable({
    operationName: 'process-user-data',
    metricsPrefix: 'user_data_processing',
    description: 'Complex user data processing',
    attributes: {
      'operation.complexity': 'high',
      'business.critical': true,
    },
  })
  async processUserData(userId: string): Promise<ProcessingResult> {
    const operations: string[] = [];
    const startTime = Date.now();

    try {
      operations.push('validate-user');
      await this.validateUserId(userId);

      operations.push('load-data');
      await this.simulateDatabase(150);

      operations.push('apply-business-rules');
      await this.applyBusinessRules(userId);

      operations.push('save-results');
      await this.simulateDatabase(75);

      return {
        userId,
        operations,
        duration: Date.now() - startTime,
        success: true,
      };
    } catch {
      return {
        userId,
        operations,
        duration: Date.now() - startTime,
        success: false,
      };
    }
  }

  @Observable({
    operationName: 'batch-operation',
    metricsPrefix: 'batch_processing',
    description: 'Batch processing operation',
    attributes: {
      'operation.type': 'batch',
    },
  })
  async processBatch(userIds: string[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    await this.observabilityService.recordMetric({
      name: 'batch_size',
      type: MetricType.GAUGE,
      value: userIds.length,
      description: 'Size of the current batch being processed',
      unit: 'items',
    });

    for (const userId of userIds) {
      try {
        const result = await this.processUserData(userId);
        results.push(result);
      } catch {
        results.push({
          userId,
          operations: ['failed'],
          duration: 0,
          success: false,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    await this.observabilityService.recordMetric({
      name: 'batch_success_rate',
      type: MetricType.GAUGE,
      value: successCount / results.length,
      description: 'Success rate of batch processing',
      unit: 'ratio',
    });

    await this.observabilityService.recordMetric({
      name: 'batch_items_processed',
      type: MetricType.COUNTER,
      value: results.length,
      description: 'Total items processed in batch',
      labels: {
        'batch.success_count': successCount.toString(),
        'batch.failure_count': failureCount.toString(),
      },
    });

    return results;
  }

  @Observable({
    operationName: 'cache-operation',
    metricsPrefix: 'cache',
    description: 'Cache operation with observability',
    recordDuration: true,
    recordCounter: true,
  })
  async getCachedUserData(userId: string): Promise<UserData | null> {
    const cacheHit = Math.random() > 0.3;

    if (cacheHit) {
      await this.observabilityService.recordMetric({
        name: 'cache_hits_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Cache hits',
        labels: {
          cache_type: 'user-data',
        },
      });

      await this.simulateCache(10);
      return {
        id: userId,
        name: 'Cached User',
        email: 'cached@example.com',
        createdAt: new Date(),
      };
    } else {
      await this.observabilityService.recordMetric({
        name: 'cache_misses_total',
        type: MetricType.COUNTER,
        value: 1,
        description: 'Cache misses',
        labels: {
          cache_type: 'user-data',
        },
      });

      return null;
    }
  }

  @Observable()
  async simpleOperation(data: string): Promise<string> {
    await this.simulateProcessing(50);
    return `Processed: ${data}`;
  }

  private async validateUserData(userData: {
    name: string;
    email: string;
  }): Promise<void> {
    if (!userData.name || userData.name.length < 2) {
      throw new Error('Invalid user name');
    }

    if (!userData.email || !userData.email.includes('@')) {
      throw new Error('Invalid email format');
    }

    await this.simulateProcessing(30);
  }

  private async validateUserId(userId: string): Promise<void> {
    if (!userId || userId.length < 5) {
      throw new Error('Invalid user ID');
    }

    await this.simulateProcessing(20);
  }

  private async applyBusinessRules(userId: string): Promise<void> {
    if (userId.startsWith('admin_')) {
      await this.simulateProcessing(200);
    } else {
      await this.simulateProcessing(100);
    }
  }

  private async simulateDatabase(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  private async simulateCache(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  private async simulateProcessing(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }
}
