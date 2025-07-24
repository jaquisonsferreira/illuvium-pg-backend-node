import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsObject,
} from 'class-validator';

export class SeasonDto {
  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Season name',
    example: 'Season 1 - Mainnet Lock',
  })
  name: string;

  @ApiProperty({
    description: 'Season description',
    example: 'First season focusing on liquidity provision and early adoption',
  })
  description: string;

  @ApiProperty({
    description: 'Start date in ISO format',
    example: '2024-12-01T00:00:00Z',
  })
  start_date: string;

  @ApiProperty({
    description: 'End date in ISO format',
    example: '2025-03-01T00:00:00Z',
  })
  end_date: string;

  @ApiProperty({
    description: 'Primary chain for this season',
    example: 'base',
  })
  primary_chain: string;

  @ApiProperty({
    description: 'Whether the season is currently active',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Vault rates for this season',
    example: {
      ILV: 80,
      'ILV/ETH': 150,
      ETH: 150,
    },
  })
  vault_rates: Record<string, number>;

  @ApiProperty({
    description: 'Total shards distributed in this season',
    example: 1500000,
  })
  total_shards_distributed: number;

  @ApiProperty({
    description: 'Number of active participants',
    example: 1234,
  })
  active_participants: number;

  @ApiPropertyOptional({
    description: 'Social conversion rate (YAP to Shards)',
    example: 100,
  })
  social_conversion_rate?: number;

  @ApiPropertyOptional({
    description: 'Referral configuration for this season',
    example: {
      max_referrals: 10,
      bonus_rate: 0.2,
      referee_multiplier: 1.2,
    },
  })
  referral_config?: Record<string, any>;
}

export class CreateSeasonDto {
  @ApiProperty({
    description: 'Season name',
    example: 'Season 2 - O Expansion',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Season description',
    example: 'Second season expanding to O chain',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Start date in ISO format',
    example: '2025-03-01T00:00:00Z',
  })
  @IsDateString()
  start_date: string;

  @ApiProperty({
    description: 'End date in ISO format',
    example: '2025-06-01T00:00:00Z',
  })
  @IsDateString()
  end_date: string;

  @ApiProperty({
    description: 'Primary chain for this season',
    example: 'o',
  })
  @IsString()
  primary_chain: string;

  @ApiProperty({
    description: 'Vault rates for this season',
    example: {
      ILV: 100,
      ETH: 200,
    },
  })
  @IsObject()
  vault_rates: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Social conversion rate',
    example: 100,
  })
  @IsNumber()
  social_conversion_rate?: number;

  @ApiPropertyOptional({
    description: 'Referral configuration',
  })
  @IsObject()
  referral_config?: Record<string, any>;
}

export class UpdateSeasonDto {
  @ApiPropertyOptional({
    description: 'Updated season name',
    example: 'Season 1 - Extended',
  })
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
  })
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated end date',
    example: '2025-04-01T00:00:00Z',
  })
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Updated vault rates',
  })
  @IsObject()
  vault_rates?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Whether the season is active',
    example: false,
  })
  @IsBoolean()
  is_active?: boolean;
}

export class SeasonsListResponseDto {
  @ApiProperty({
    description: 'List of seasons',
    type: [SeasonDto],
  })
  data: SeasonDto[];

  @ApiProperty({
    description: 'Current active season ID',
    example: 1,
  })
  current_season_id: number;
}
