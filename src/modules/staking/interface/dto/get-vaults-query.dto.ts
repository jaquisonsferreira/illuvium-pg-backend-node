import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum VaultSortBy {
  TVL = 'tvl',
  VAULT_SIZE = 'vault_size',
  PARTICIPANTS = 'participants',
}

export enum SortOrder {
  DESC = 'desc',
  ASC = 'asc',
}

export enum VaultStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

export class GetVaultsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by asset symbol (e.g., ILV, ILV/ETH)',
    example: 'ILV',
  })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    description: 'Filter by vault status',
    enum: VaultStatus,
    example: VaultStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(VaultStatus)
  status?: VaultStatus;

  @ApiPropertyOptional({
    description: 'Search by vault name or asset',
    example: 'Illuvium',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: VaultSortBy,
    example: VaultSortBy.TVL,
  })
  @IsOptional()
  @IsEnum(VaultSortBy)
  sort_by?: VaultSortBy = VaultSortBy.TVL;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
