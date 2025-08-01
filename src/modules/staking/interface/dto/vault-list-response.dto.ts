import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenIconsDto {
  @ApiProperty({
    description: 'Primary token icon URL',
    example: 'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
  })
  primary: string;

  @ApiPropertyOptional({
    description: 'Secondary token icon URL (for LP tokens)',
    example: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
    nullable: true,
  })
  secondary?: string | null;
}

export class VaultMechanicsDto {
  @ApiProperty({
    description: 'Whether the vault is locked until mainnet launch',
    example: true,
  })
  locked_until_mainnet: boolean;

  @ApiProperty({
    description: 'Whether withdrawals are enabled',
    example: false,
  })
  withdrawal_enabled: boolean;

  @ApiPropertyOptional({
    description: 'Days required to redeem after withdrawal request',
    example: 7,
    nullable: true,
  })
  redeem_delay_days?: number | null;

  @ApiPropertyOptional({
    description: 'Minimum deposit amount in token units',
    example: '10.00',
    nullable: true,
  })
  minimum_deposit?: string | null;

  @ApiPropertyOptional({
    description: 'Maximum deposit amount in token units',
    example: '1000000.00',
    nullable: true,
  })
  maximum_deposit?: string | null;
}

export class VaultListItemDto {
  @ApiProperty({
    description: 'Unique vault identifier',
    example: 'ILV_vault_base',
  })
  vault_id: string;

  @ApiProperty({
    description: 'Vault contract address',
    example: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
  })
  vault_address: string;

  @ApiProperty({
    description: 'Vault display name',
    example: 'Illuvium',
  })
  name: string;

  @ApiProperty({
    description: 'Underlying asset name',
    example: 'Illuvium',
  })
  underlying_asset: string;

  @ApiProperty({
    description: 'Underlying asset ticker symbol',
    example: 'ILV',
  })
  underlying_asset_ticker: string;

  @ApiProperty({
    description: 'Underlying asset contract address',
    example: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
  })
  underlying_asset_address: string;

  @ApiProperty({
    description: 'Token icon URLs',
    type: TokenIconsDto,
  })
  token_icons: TokenIconsDto;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'base',
  })
  chain: string;

  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Vault active status',
    example: 'active',
  })
  status: string;

  @ApiProperty({
    description: 'Staking rewards rate',
    example: '250 Shards / $1,000',
  })
  staking_rewards: string;

  @ApiProperty({
    description: 'Total value locked (formatted)',
    example: '125.00M',
  })
  tvl: string;

  @ApiProperty({
    description: 'Total value locked (raw value)',
    example: '125000000.00',
  })
  tvl_raw: string;

  @ApiProperty({
    description: 'Vault size in underlying asset',
    example: '2,234.28 ILV',
  })
  vault_size: string;

  @ApiProperty({
    description: 'Vault mechanics and rules',
    type: VaultMechanicsDto,
  })
  mechanics: VaultMechanicsDto;
}

export class PaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 2 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 1 })
  total_pages: number;

  @ApiProperty({ description: 'Has next page', example: false })
  has_next: boolean;

  @ApiProperty({ description: 'Has previous page', example: false })
  has_previous: boolean;
}

export class SeasonSummaryDto {
  @ApiProperty({ description: 'Season identifier', example: 1 })
  season_id: number;

  @ApiProperty({ description: 'Blockchain network', example: 'base' })
  chain: string;

  @ApiProperty({
    description: 'Total value locked across all vaults (formatted)',
    example: '210.00M',
  })
  tvl: string;

  @ApiProperty({
    description: 'Total value locked across all vaults (raw)',
    example: '210000000.00',
  })
  tvl_raw: string;

  @ApiProperty({
    description: 'Number of active vaults',
    example: 2,
  })
  active_vaults: number;

  @ApiProperty({
    description: '24 hour volume',
    example: '2.5M',
  })
  volume_24h: string;
}

export class VaultListResponseDto {
  @ApiProperty({
    description: 'List of vaults',
    type: [VaultListItemDto],
  })
  vaults: VaultListItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Season summary information',
    type: SeasonSummaryDto,
  })
  season_summary: SeasonSummaryDto;
}