import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ShardBalanceQueryDto {
  @ApiPropertyOptional({
    description: 'Specific season ID (defaults to current)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  season?: number;

  @ApiPropertyOptional({
    description: 'Chain override (defaults based on season)',
    enum: ['base', 'ethereum', 'obelisk'],
    example: 'base',
  })
  @IsOptional()
  @IsIn(['base', 'ethereum', 'obelisk'])
  chain?: 'base' | 'ethereum' | 'obelisk';

  @ApiPropertyOptional({
    description: 'Include historical season data',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_all_seasons?: boolean;
}

export class VaultBreakdownDto {
  @ApiProperty({
    description: 'Vault identifier',
    example: 'ILV_vault_base',
  })
  vault_id: string;

  @ApiProperty({
    description: 'Asset symbol',
    example: 'ILV',
  })
  asset: string;

  @ApiProperty({
    description: 'Blockchain chain',
    example: 'base',
  })
  chain: string;

  @ApiProperty({
    description: 'Shards earned from this vault',
    example: 300,
  })
  shards_earned: number;
}

export class CurrentSeasonDto {
  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Season name',
    example: 'Season 1 - Mainnet Lock',
  })
  season_name: string;

  @ApiProperty({
    description: 'Staking shards earned',
    example: 300,
  })
  staking_shards: number;

  @ApiProperty({
    description: 'Social shards earned',
    example: 120,
  })
  social_shards: number;

  @ApiProperty({
    description: 'Developer shards earned',
    example: 500,
  })
  developer_shards: number;

  @ApiProperty({
    description: 'Referral shards earned',
    example: 50,
  })
  referral_shards: number;

  @ApiProperty({
    description: 'Total shards for this season',
    example: 970,
  })
  total_shards: number;

  @ApiProperty({
    description: 'Breakdown by vault',
    type: [VaultBreakdownDto],
  })
  vaults_breakdown: VaultBreakdownDto[];
}

export class SeasonHistoryDto {
  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Total shards earned in this season',
    example: 970,
  })
  total_shards: number;

  @ApiProperty({
    description: 'Rank in this season',
    example: 42,
  })
  rank: number;
}

export class ShardBalanceResponseDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  wallet: string;

  @ApiProperty({
    description: 'Current season data',
    type: CurrentSeasonDto,
  })
  current_season: CurrentSeasonDto;

  @ApiProperty({
    description: 'Total shards from all seasons',
    example: 970,
  })
  total_shards_from_all_seasons: number;

  @ApiPropertyOptional({
    description: 'Season history (if include_all_seasons=true)',
    type: [SeasonHistoryDto],
  })
  season_history?: SeasonHistoryDto[];

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T04:30:00Z',
  })
  last_updated: string;
}
