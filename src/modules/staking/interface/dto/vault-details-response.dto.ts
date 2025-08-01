import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CurrentStatsDto {
  @ApiProperty({
    description: 'Total value locked (formatted)',
    example: '85.00M',
  })
  tvl: string;

  @ApiProperty({
    description: 'Total value locked (raw)',
    example: '85000000.00',
  })
  tvl_raw: string;

  @ApiProperty({
    description: 'Vault size in underlying asset',
    example: '5,312.50 ILV/ETH',
  })
  vault_size: string;

  @ApiProperty({
    description: 'Current token price in USD',
    example: '1500.00',
  })
  token_price: string;

  @ApiProperty({ description: '24 hour price change', example: '+1.8%' })
  '24h_change': string;
}

export class ChartDataPointDto {
  @ApiProperty({
    description: 'Timestamp in ISO 8601 format',
    example: '2024-12-15T04:30:00Z',
  })
  timestamp: string;

  @ApiProperty({ description: 'Value at this point', example: 75000000.0 })
  value: number;
}

export class ChartDataDto {
  @ApiProperty({ description: 'TVL chart data', type: [ChartDataPointDto] })
  tvl: { [key: string]: ChartDataPointDto[] };

  @ApiProperty({ description: 'Volume chart data', type: [ChartDataPointDto] })
  volume: { [key: string]: ChartDataPointDto[] };

  @ApiProperty({ description: 'Fees chart data', type: [ChartDataPointDto] })
  fees: { [key: string]: ChartDataPointDto[] };
}

export class UserPositionDto {
  @ApiProperty({
    description: 'User wallet address',
    example: '0x1234567890abcdef1234567890abcdef1234ABCD',
  })
  wallet_address: string;

  @ApiProperty({
    description: 'Staked balance of underlying asset',
    example: '5.25',
  })
  underlying_asset_staked_balance: string;

  @ApiProperty({
    description: 'Raw staked balance',
    example: '5250000000000000000',
  })
  underlying_asset_staked_balance_raw: string;

  @ApiProperty({
    description: 'Balance in wallet',
    example: '2.75',
  })
  underlying_asset_balance_in_wallet: string;

  @ApiProperty({
    description: 'Raw wallet balance',
    example: '2750000000000000000',
  })
  underlying_asset_balance_in_wallet_raw: string;

  @ApiProperty({
    description: 'USD value of staked balance',
    example: '7875.00',
  })
  underlying_balance_usd: string;

  @ApiProperty({
    description: 'Pending shards to claim',
    example: '315',
  })
  pending_shards: string;

  @ApiProperty({
    description: 'Total earned shards',
    example: '1200',
  })
  earned_shards: string;

  @ApiProperty({
    description: 'Whether unstaking is enabled',
    example: false,
  })
  is_unstake_enabled: boolean;
}

export class HistoricalStatsDto {
  @ApiProperty({
    description: 'All time deposits',
    example: '85000000.00',
  })
  all_time_deposits: string;

  @ApiProperty({
    description: 'All time withdrawals',
    example: '0.00',
  })
  all_time_withdrawals: string;

  @ApiProperty({
    description: 'Highest TVL recorded',
    example: '85000000.00',
  })
  highest_tvl: string;
}

export class VaultDetailsResponseDto {
  @ApiProperty({
    description: 'Vault identifier',
    example: 'ILV_ETH_vault_base',
  })
  vault_id: string;

  @ApiProperty({
    description: 'Vault contract address',
    example: '0x853e4A8C1C7B9A4F5D6E9C8B7A5F2E1D0C9B8A7E',
  })
  vault_address: string;

  @ApiProperty({
    description: 'Vault name',
    example: 'Illuvium / Ethereum LP Vault',
  })
  name: string;

  @ApiProperty({
    description: 'Underlying asset name',
    example: 'Illuvium / Ethereum LP',
  })
  underlying_asset: string;

  @ApiProperty({ description: 'Underlying asset ticker', example: 'ILV/ETH' })
  underlying_asset_ticker: string;

  @ApiProperty({
    description: 'Underlying asset address',
    example: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
  })
  underlying_asset_address: string;

  @ApiProperty({ description: 'Token icon URLs' })
  token_icons: {
    primary: string;
    secondary?: string | null;
  };

  @ApiProperty({ description: 'Blockchain network', example: 'base' })
  chain: string;

  @ApiProperty({ description: 'Season identifier', example: 1 })
  season_id: number;

  @ApiProperty({ description: 'Vault status', example: 'active' })
  status: string;

  @ApiProperty({
    description: 'Vault description',
    example:
      'This vault allows you to stake ILV/ETH LP tokens and earn 300 Shards / $1,000 as rewards.',
  })
  description: string;

  @ApiProperty({ description: 'Reward rate', example: '300 Shards / $1,000' })
  reward_rate: string;

  @ApiProperty({ description: 'Current statistics', type: CurrentStatsDto })
  current_stats: CurrentStatsDto;

  @ApiProperty({ description: 'Vault mechanics' })
  mechanics: {
    locked_until_mainnet: boolean;
    withdrawal_enabled: boolean;
    redeem_delay_days?: number | null;
    minimum_deposit?: string | null;
    maximum_deposit?: string | null;
    deposit_enabled: boolean;
  };

  @ApiProperty({ description: 'Chart data for analytics', type: ChartDataDto })
  chart_data: ChartDataDto;

  @ApiPropertyOptional({
    description: 'User position data (only when wallet address provided)',
    type: UserPositionDto,
    nullable: true,
  })
  user_position?: UserPositionDto | null;

  @ApiProperty({
    description: 'Historical statistics',
    type: HistoricalStatsDto,
  })
  historical_stats: HistoricalStatsDto;
}
