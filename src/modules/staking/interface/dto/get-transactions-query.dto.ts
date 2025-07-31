import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  ALL = 'all',
}

export enum TransactionSortBy {
  DATE = 'date',
  AMOUNT = 'amount',
  TYPE = 'type',
}

export enum TransactionSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetTransactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by vault ID',
    example: 'ilv_vault',
  })
  @IsOptional()
  @IsString()
  vault_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: TransactionType,
    default: TransactionType.ALL,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType = TransactionType.ALL;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of results per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Start date for filtering transactions (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering transactions (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: TransactionSortBy,
    default: TransactionSortBy.DATE,
  })
  @IsOptional()
  @IsEnum(TransactionSortBy)
  sort_by?: TransactionSortBy = TransactionSortBy.DATE;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: TransactionSortOrder,
    default: TransactionSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(TransactionSortOrder)
  sort_order?: TransactionSortOrder = TransactionSortOrder.DESC;
}
