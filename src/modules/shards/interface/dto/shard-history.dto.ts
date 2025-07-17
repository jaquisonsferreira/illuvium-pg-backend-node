import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VaultBreakdownDto } from './shard-balance.dto';

export class ShardHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by specific season ID',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  season?: number;

  @ApiPropertyOptional({
    description: 'Chain override (defaults based on season)',
    enum: ['base', 'ethereum', 'obelisk'],
    example: 'base',
  })
  @IsOptional()
  @IsIn(['base', 'ethereum', 'obelisk'])
  chain?: 'base' | 'ethereum' | 'obelisk';

  @ApiPropertyOptional({
    description: 'Start date in ISO format',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date in ISO format',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Last N days (defaults to 30, max 90)',
    example: 30,
    minimum: 1,
    maximum: 90,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  days?: number;

  @ApiPropertyOptional({
    description: 'Page number (defaults to 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (defaults to 30, max 100)',
    example: 30,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by specific vault',
    example: 'ILV',
  })
  @IsOptional()
  @IsString()
  vault?: string;
}

export class ShardHistoryItemDto {
  @ApiProperty({
    description: 'Date of earnings',
    example: '2025-01-15',
  })
  date: string;

  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Staking shards earned',
    example: 100,
  })
  staking_shards: number;

  @ApiProperty({
    description: 'Vault breakdown for staking shards',
    type: [VaultBreakdownDto],
  })
  vaults_breakdown: VaultBreakdownDto[];

  @ApiProperty({
    description: 'Social shards earned',
    example: 50,
  })
  social_shards: number;

  @ApiProperty({
    description: 'Developer shards earned',
    example: 0,
  })
  developer_shards: number;

  @ApiProperty({
    description: 'Referral shards earned',
    example: 10,
  })
  referral_shards: number;

  @ApiProperty({
    description: 'Total shards for the day',
    example: 160,
  })
  daily_total: number;
}

export class PaginationDto {
  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 30,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 4,
  })
  totalPages: number;
}

export class ShardHistorySummaryDto {
  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Total shards in the period',
    example: 1120,
  })
  period_total: number;

  @ApiProperty({
    description: 'Average shards per day',
    example: 160,
  })
  avg_daily: number;
}

export class ShardHistoryResponseDto {
  @ApiProperty({
    description: 'Daily earning history',
    type: [ShardHistoryItemDto],
  })
  data: ShardHistoryItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Summary statistics for the period',
    type: ShardHistorySummaryDto,
  })
  summary: ShardHistorySummaryDto;
}
