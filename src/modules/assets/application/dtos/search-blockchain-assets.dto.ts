import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  IsIn,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export class SearchBlockchainAssetsDto {
  @ApiPropertyOptional({
    description: 'Array of owner addresses to filter by',
    type: [String],
    example: ['0x1234...', '0x5678...'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  ownerAddresses?: string[];

  @ApiPropertyOptional({
    description: 'Array of contract IDs to filter by',
    type: [String],
    example: ['contract-uuid-1', 'contract-uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  contractIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of contract addresses to filter by',
    type: [String],
    example: ['0xabcd...', '0xefgh...'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  contractAddresses?: string[];

  @ApiPropertyOptional({
    description: 'Array of token IDs to filter by',
    type: [String],
    example: ['1', '2', '3'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  tokenIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter assets that have balance',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  hasBalance?: boolean;

  @ApiPropertyOptional({
    description: 'Metadata filter as JSON object',
    example: { name: 'Rare NFT', rarity: 'legendary' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Number of items per page (max 100)',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of items to skip for pagination',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['created_at', 'updated_at', 'balance'],
    example: 'created_at',
  })
  @IsOptional()
  @IsString()
  @IsIn(['created_at', 'updated_at', 'balance'])
  sortBy?: 'created_at' | 'updated_at' | 'balance';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
