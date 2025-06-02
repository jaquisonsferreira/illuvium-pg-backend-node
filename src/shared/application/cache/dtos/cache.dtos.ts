import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';

export class SetCacheDto {
  @IsString()
  key: string;

  value: any;

  @IsOptional()
  @IsNumber()
  @Min(1)
  ttl?: number;

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class GetCacheDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class DeleteCacheDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class IncrementCacheDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class GetKeysDto {
  @IsString()
  pattern: string;

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class SetMultipleCacheDto {
  entries: Array<{
    key: string;
    value: any;
    ttl?: number;
  }>;

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class GetMultipleCacheDto {
  @IsString({ each: true })
  keys: string[];

  @IsOptional()
  @IsString()
  namespace?: string;
}

export class CacheStatsDto {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  uptime: number;
}

export class CacheHealthDto {
  @IsBoolean()
  isHealthy: boolean;

  @IsString()
  status: 'connected' | 'disconnected' | 'error';

  @IsOptional()
  @IsString()
  message?: string;

  responseTime: number;
}
