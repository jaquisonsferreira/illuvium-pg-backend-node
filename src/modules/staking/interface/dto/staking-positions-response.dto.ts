import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenIconsDto {
  @ApiProperty({
    description: 'Primary token icon URL',
    example:
      'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
  })
  primary: string;

  @ApiPropertyOptional({
    description: 'Secondary token icon URL (for LP tokens)',
    example:
      'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
    nullable: true,
  })
  secondary: string | null;
}

export class PositionDto {
  @ApiProperty({
    description: 'Unique position identifier',
    example: 'ILV #1',
  })
  position_id: string;

  @ApiProperty({
    description: 'Vault identifier',
    example: 'ilv_vault',
  })
  vault_id: string;

  @ApiProperty({
    description: 'Underlying asset ticker symbol',
    example: 'ILV',
  })
  underlying_asset_ticker: string;

  @ApiProperty({
    description: 'Total shards earned for this position',
    example: '3200',
  })
  earned_shards: string;

  @ApiProperty({
    description: 'Human-readable staked amount',
    example: '125.50',
  })
  staked_amount: string;

  @ApiProperty({
    description: 'Raw staked amount with full precision',
    example: '125500000000000000000',
  })
  staked_amount_raw: string;

  @ApiProperty({
    description: 'Lock duration in human-readable format',
    example: '365 days',
  })
  lock_duration: string;

  @ApiProperty({
    description: 'Shards earning multiplier based on lock duration',
    example: '2.00',
  })
  shards_multiplier: string;

  @ApiProperty({
    description: 'Whether the position is currently locked',
    example: true,
  })
  isLocked: boolean;

  @ApiProperty({
    description: 'ISO timestamp of when the position was created',
    example: '2025-03-15T10:30:00Z',
  })
  deposit_date: string;

  @ApiProperty({
    description: 'ISO timestamp of when the position unlocks',
    example: '2025-09-15T10:30:00Z',
  })
  unlock_date: string;
}

export class VaultDto {
  @ApiProperty({
    description: 'Unique vault identifier',
    example: 'ilv_vault',
  })
  vault_id: string;

  @ApiProperty({
    description: 'Human-readable vault name',
    example: 'ILV',
  })
  vault_name: string;

  @ApiProperty({
    description: 'Ticker symbol of the underlying asset',
    example: 'ILV',
  })
  underlying_asset_ticker: string;

  @ApiProperty({
    description: 'Vault contract address',
    example: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
  })
  vault_address: string;

  @ApiProperty({
    description: 'Underlying asset token address',
    example: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
  })
  underlying_asset_address: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'base',
  })
  chain: string;

  @ApiProperty({
    description: 'Token icon URLs',
    type: TokenIconsDto,
  })
  token_icons: TokenIconsDto;

  @ApiProperty({
    description: 'Total value locked in human-readable format',
    example: '$100.00M',
  })
  tvl: string;

  @ApiProperty({
    description: 'Raw TVL value',
    example: '100000000.00',
  })
  tvl_raw: string;

  @ApiProperty({
    description: 'Maximum vault capacity',
    example: '2200.00',
  })
  vault_size: string;

  @ApiProperty({
    description: 'Current token price in USD',
    example: '9.56',
  })
  token_price: string;

  @ApiProperty({
    description: '24-hour price change percentage',
    example: '+2.4%',
  })
  '24h_change': string;

  @ApiProperty({
    description: 'Shards earning rate per 1000 USD',
    example: '80',
  })
  shards_rate: string;

  @ApiProperty({
    description: 'Whether the user has any stake in this vault',
    example: true,
  })
  userHasStake: boolean;

  @ApiProperty({
    description: 'Total amount staked by user in this vault',
    example: '200.50',
  })
  user_total_staked: string;

  @ApiProperty({
    description: 'Raw total staked amount',
    example: '200500000000000000000',
  })
  user_total_staked_raw: string;

  @ApiProperty({
    description: 'Number of active positions in this vault',
    example: 2,
  })
  user_active_positions_count: number;

  @ApiProperty({
    description: 'Total shards earned from this vault',
    example: '6400',
  })
  user_total_earned_shards: string;

  @ApiProperty({
    description: 'User wallet balance of underlying asset',
    example: '50.25',
  })
  underlying_asset_balance_in_wallet: string;

  @ApiProperty({
    description: 'Raw wallet balance',
    example: '50250000000000000000',
  })
  underlying_asset_balance_in_wallet_raw: string;

  @ApiProperty({
    description: 'User positions in this vault',
    type: [PositionDto],
  })
  positions: PositionDto[];
}

export class CurrentSeasonDto {
  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Season name',
    example: 'Season 1',
  })
  season_name: string;

  @ApiProperty({
    description: 'Primary chain for this season',
    example: 'base',
  })
  chain: string;
}

export class UserSummaryDto {
  @ApiProperty({
    description: 'Total portfolio value in USD',
    example: '9075.00',
  })
  total_portfolio_value_usd: string;

  @ApiProperty({
    description: 'Total number of positions across all vaults',
    example: 4,
  })
  total_user_positions: number;

  @ApiProperty({
    description: 'Number of vaults with active stakes',
    example: 2,
  })
  total_vaults_with_stakes: number;

  @ApiProperty({
    description: 'Total ILV tokens staked',
    example: '200.50',
  })
  total_user_staked_ilv: string;

  @ApiProperty({
    description: 'Total ILV/ETH LP tokens staked',
    example: '179.50',
  })
  total_user_staked_ilv_eth: string;

  @ApiProperty({
    description: 'Total shards earned across all positions',
    example: '10180',
  })
  total_user_earned_shards: string;
}

export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 2,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 1,
  })
  total_pages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: false,
  })
  has_next: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  has_previous: boolean;
}

export class StakingPositionsResponseDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef1234ABCD',
  })
  wallet: string;

  @ApiProperty({
    description: 'Current season information',
    type: CurrentSeasonDto,
  })
  current_season: CurrentSeasonDto;

  @ApiProperty({
    description: 'List of vaults with user positions',
    type: [VaultDto],
  })
  vaults: VaultDto[];

  @ApiProperty({
    description: 'Summary of user staking portfolio',
    type: UserSummaryDto,
  })
  user_summary: UserSummaryDto;

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'ISO timestamp of last data update',
    example: '2025-01-15T04:30:00Z',
  })
  last_updated: string;
}
