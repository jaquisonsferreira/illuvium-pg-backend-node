import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetTokenPriceQueryDto {
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

  @ApiPropertyOptional({
    description: 'Specific date for historical price (ISO format)',
    example: '2025-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Use cached data if available',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  useCache?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum cache age in minutes',
    default: 5,
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCacheAgeMinutes?: number;
}

export class GetHistoricalPricesQueryDto {
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

  @ApiProperty({
    description: 'Start date for historical data (ISO format)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for historical data (ISO format)',
    example: '2025-01-15T00:00:00Z',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Data granularity',
    enum: ['minute', 'hour', 'day'],
    default: 'day',
    example: 'day',
  })
  @IsOptional()
  @IsString()
  @IsIn(['minute', 'hour', 'day'])
  granularity?: 'minute' | 'hour' | 'day';

  @ApiPropertyOptional({
    description: 'Fill missing data points with external API calls',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  fillMissingData?: boolean;
}

export class TokenPriceRequestDto {
  @ApiProperty({
    description: 'Token address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  address: string;

  @ApiProperty({
    description: 'Blockchain chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'ethereum',
  })
  @IsString()
  @IsIn(['ethereum', 'base', 'arbitrum', 'polygon'])
  chain: string;
}

export class GetMultiplePricesDto {
  @ApiProperty({
    description: 'Array of tokens to get prices for',
    type: [TokenPriceRequestDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenPriceRequestDto)
  tokens: TokenPriceRequestDto[];

  @ApiPropertyOptional({
    description: 'Use cached data if available',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  useCache?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum cache age in minutes',
    default: 5,
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCacheAgeMinutes?: number;
}
