import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetTokenMetadataQueryDto {
  @ApiPropertyOptional({
    description: 'Token contract address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  tokenAddress?: string;

  @ApiPropertyOptional({
    description: 'Blockchain chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'ethereum',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ethereum', 'base', 'arbitrum', 'polygon'])
  chain?: string;

  @ApiPropertyOptional({
    description: 'Token symbol',
    example: 'ILV',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  symbol?: string;

  @ApiPropertyOptional({
    description: 'CoinGecko ID',
    example: 'illuvium',
  })
  @IsOptional()
  @IsString()
  coingeckoId?: string;

  @ApiPropertyOptional({
    description: 'Auto-cache from external sources if not found',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoCache?: boolean;
}

export class SearchTokensQueryDto {
  @ApiProperty({
    description: 'Search query (name, symbol, or address)',
    example: 'ILV',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'ethereum',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ethereum', 'base', 'arbitrum', 'polygon'])
  chain?: string;
}

export class GetLpTokensQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'base',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ethereum', 'base', 'arbitrum', 'polygon'])
  chain?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GetTokenPairQueryDto {
  @ApiProperty({
    description: 'First token address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  token0Address: string;

  @ApiProperty({
    description: 'Second token address',
    example: '0x4200000000000000000000000000000000000006',
  })
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  token1Address: string;

  @ApiProperty({
    description: 'Blockchain chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'base',
  })
  @IsString()
  @IsIn(['ethereum', 'base', 'arbitrum', 'polygon'])
  chain: string;
}

export class ValidateTokenQueryDto {
  @ApiProperty({
    description: 'Token contract address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  tokenAddress: string;

  @ApiProperty({
    description: 'Blockchain chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'ethereum',
  })
  @IsString()
  @IsIn(['ethereum', 'base', 'arbitrum', 'polygon'])
  chain: string;
}
