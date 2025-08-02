import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenPriceDto {
  @ApiProperty({
    description: 'Token contract address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  tokenAddress: string;

  @ApiProperty({
    description: 'Blockchain chain',
    example: 'ethereum',
  })
  chain: string;

  @ApiProperty({
    description: 'Token symbol',
    example: 'ILV',
  })
  symbol: string;

  @ApiProperty({
    description: 'Current price in USD',
    example: 45.67,
  })
  priceUsd: number;

  @ApiPropertyOptional({
    description: '24-hour price change percentage',
    example: 5.34,
  })
  priceChange24h?: number;

  @ApiPropertyOptional({
    description: 'Market capitalization in USD',
    example: 456789000,
  })
  marketCap?: number;

  @ApiPropertyOptional({
    description: '24-hour trading volume in USD',
    example: 12345678,
  })
  volume24h?: number;

  @ApiProperty({
    description: 'Price timestamp',
    example: '2025-01-15T04:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Data source',
    example: 'coingecko',
  })
  source: string;

  @ApiProperty({
    description: 'Whether the data is from cache',
    example: false,
  })
  isCached: boolean;

  @ApiPropertyOptional({
    description: 'Cache age in minutes',
    example: 2,
  })
  cacheAgeMinutes?: number;
}

export class HistoricalPricePointDto {
  @ApiProperty({
    description: 'Price timestamp',
    example: '2025-01-15T00:00:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Price in USD',
    example: 45.67,
  })
  priceUsd: number;

  @ApiPropertyOptional({
    description: '24-hour price change percentage',
    example: 5.34,
  })
  priceChange24h?: number;

  @ApiPropertyOptional({
    description: 'Market capitalization in USD',
    example: 456789000,
  })
  marketCap?: number;

  @ApiPropertyOptional({
    description: '24-hour trading volume in USD',
    example: 12345678,
  })
  volume24h?: number;
}

export class HistoricalPriceResponseDto {
  @ApiProperty({
    description: 'Token contract address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  tokenAddress: string;

  @ApiProperty({
    description: 'Blockchain chain',
    example: 'ethereum',
  })
  chain: string;

  @ApiProperty({
    description: 'Token symbol',
    example: 'ILV',
  })
  symbol: string;

  @ApiProperty({
    description: 'Historical price data points',
    type: [HistoricalPricePointDto],
  })
  prices: HistoricalPricePointDto[];

  @ApiProperty({
    description: 'Average price over the period',
    example: 48.32,
  })
  averagePrice: number;

  @ApiProperty({
    description: 'Highest price in the period',
    example: 52.1,
  })
  highPrice: number;

  @ApiProperty({
    description: 'Lowest price in the period',
    example: 44.5,
  })
  lowPrice: number;

  @ApiProperty({
    description: 'Price change percentage over the period',
    example: 8.45,
  })
  priceChange: number;

  @ApiProperty({
    description: 'Data granularity',
    example: 'day',
  })
  granularity: string;
}

export class MultiplePricesResponseDto {
  @ApiProperty({
    description: 'Array of token prices',
    type: [TokenPriceDto],
  })
  data: TokenPriceDto[];

  @ApiProperty({
    description: 'Total number of tokens processed',
    example: 3,
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Tokens that failed to get prices',
    type: [String],
    example: ['0xinvalid'],
  })
  failed?: string[];
}

export class PriceSummaryDto {
  @ApiProperty({
    description: 'Total USD value',
    example: 125678.9,
  })
  totalUsdValue: number;

  @ApiProperty({
    description: 'Number of unique tokens',
    example: 5,
  })
  uniqueTokens: number;

  @ApiProperty({
    description: 'Timestamp of calculation',
    example: '2025-01-15T04:30:00Z',
  })
  timestamp: string;
}
