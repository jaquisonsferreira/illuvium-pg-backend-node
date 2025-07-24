import { ApiProperty } from '@nestjs/swagger';

export class ProcessingStatusDto {
  @ApiProperty({
    description: 'Status of the processing',
    enum: ['idle', 'processing', 'error'],
    example: 'idle',
  })
  status: 'idle' | 'processing' | 'error';

  @ApiProperty({
    description: 'Last successful run timestamp',
    example: '2025-01-15T04:00:00Z',
  })
  last_run: string;

  @ApiProperty({
    description: 'Next scheduled run timestamp',
    example: '2025-01-16T02:00:00Z',
  })
  next_run: string;

  @ApiProperty({
    description: 'Processing duration in seconds',
    example: 180,
  })
  last_duration_seconds: number;

  @ApiProperty({
    description: 'Number of wallets processed',
    example: 1234,
  })
  wallets_processed: number;
}

export class ServiceHealthDto {
  @ApiProperty({
    description: 'Service name',
    example: 'CoinGecko API',
  })
  name: string;

  @ApiProperty({
    description: 'Service status',
    enum: ['healthy', 'degraded', 'unhealthy'],
    example: 'healthy',
  })
  status: 'healthy' | 'degraded' | 'unhealthy';

  @ApiProperty({
    description: 'Last check timestamp',
    example: '2025-01-15T15:45:00Z',
  })
  last_check: string;

  @ApiProperty({
    description: 'Response time in milliseconds',
    example: 120,
  })
  response_time_ms: number;
}

export class SystemStatusResponseDto {
  @ApiProperty({
    description: 'System version',
    example: '1.0.0',
  })
  version: string;

  @ApiProperty({
    description: 'System uptime in seconds',
    example: 86400,
  })
  uptime_seconds: number;

  @ApiProperty({
    description: 'Current active season',
    example: 1,
  })
  current_season: number;

  @ApiProperty({
    description: 'Daily processing status',
    type: ProcessingStatusDto,
  })
  daily_processing: ProcessingStatusDto;

  @ApiProperty({
    description: 'External services health',
    type: [ServiceHealthDto],
  })
  services: ServiceHealthDto[];

  @ApiProperty({
    description: 'Cache status',
    example: {
      enabled: true,
      hit_rate: 0.85,
      size_mb: 24.5,
    },
  })
  cache_status: {
    enabled: boolean;
    hit_rate: number;
    size_mb: number;
  };

  @ApiProperty({
    description: 'Queue status',
    example: {
      pending: 5,
      processing: 2,
      completed: 1234,
      failed: 3,
    },
  })
  queue_status: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };

  @ApiProperty({
    description: 'System timestamp',
    example: '2025-01-15T15:45:30Z',
  })
  timestamp: string;
}
