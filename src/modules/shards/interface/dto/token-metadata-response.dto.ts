import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenMetadataDto {
  @ApiProperty({
    description: 'Token contract address',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  address: string;

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
    description: 'Token name',
    example: 'Illuvium',
  })
  name: string;

  @ApiProperty({
    description: 'Token decimals',
    example: 18,
  })
  decimals: number;

  @ApiPropertyOptional({
    description: 'CoinGecko ID',
    example: 'illuvium',
  })
  coingeckoId?: string;

  @ApiProperty({
    description: 'Whether the token is an LP token',
    example: false,
  })
  isLpToken: boolean;

  @ApiPropertyOptional({
    description: 'First token address (for LP tokens)',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  token0Address?: string;

  @ApiPropertyOptional({
    description: 'Second token address (for LP tokens)',
    example: '0x4200000000000000000000000000000000000006',
  })
  token1Address?: string;

  @ApiPropertyOptional({
    description: 'Pool address (for LP tokens)',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  poolAddress?: string;

  @ApiPropertyOptional({
    description: 'DEX platform (for LP tokens)',
    example: 'uniswap-v3',
  })
  dex?: string;

  @ApiProperty({
    description: 'Whether the contract is verified on block explorer',
    example: true,
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T04:30:00Z',
  })
  lastUpdated: string;

  @ApiProperty({
    description: 'Token creation timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  createdAt: string;
}

export class TokenMetadataResponseDto {
  @ApiProperty({
    description: 'Token metadata',
    type: TokenMetadataDto,
    nullable: true,
  })
  token: TokenMetadataDto | null;

  @ApiProperty({
    description: 'Whether the data was retrieved from cache',
    example: true,
  })
  cached: boolean;

  @ApiPropertyOptional({
    description: 'Error message if retrieval failed',
    example: 'Token not found',
  })
  error?: string;
}

export class TokenSearchResultDto {
  @ApiProperty({
    description: 'Array of matching tokens',
    type: [TokenMetadataDto],
  })
  tokens: TokenMetadataDto[];

  @ApiProperty({
    description: 'Total number of results',
    example: 5,
  })
  total: number;
}

export class LpTokensResponseDto {
  @ApiProperty({
    description: 'Array of LP tokens',
    type: [TokenMetadataDto],
  })
  data: TokenMetadataDto[];

  @ApiProperty({
    description: 'Pagination information',
  })
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export class TokenPairInfoDto {
  @ApiProperty({
    description: 'First token metadata',
    type: TokenMetadataDto,
    nullable: true,
  })
  token0: TokenMetadataDto | null;

  @ApiProperty({
    description: 'Second token metadata',
    type: TokenMetadataDto,
    nullable: true,
  })
  token1: TokenMetadataDto | null;

  @ApiProperty({
    description: 'LP token metadata',
    type: TokenMetadataDto,
    nullable: true,
  })
  lpToken: TokenMetadataDto | null;
}

export class TokenValidationResultDto {
  @ApiProperty({
    description: 'Whether the token metadata is valid',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'List of validation issues',
    type: [String],
    example: ['Contract not verified on block explorer'],
  })
  issues: string[];

  @ApiProperty({
    description: 'Token address that was validated',
    example: '0x767fe9edc9e0df98e07454847909b5e959d7ca0e',
  })
  tokenAddress: string;

  @ApiProperty({
    description: 'Chain where the token was validated',
    example: 'ethereum',
  })
  chain: string;
}
