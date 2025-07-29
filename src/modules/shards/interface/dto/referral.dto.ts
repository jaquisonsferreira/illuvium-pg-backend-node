import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ReferralQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by specific season ID',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  season?: number;

  @ApiPropertyOptional({
    description: 'Chain override (defaults based on season)',
    enum: ['base', 'ethereum', 'o'],
    example: 'base',
  })
  @IsOptional()
  @IsIn(['base', 'ethereum', 'o'])
  chain?: 'base' | 'ethereum' | 'o';
}

export class ActiveReferralDto {
  @ApiProperty({
    description: 'Referee wallet address',
    example: '0x9abcdef012345678abcdef012345678abcdef01',
  })
  wallet: string;

  @ApiProperty({
    description: 'Date when referral was made',
    example: '2025-01-10',
  })
  referred_date: string;

  @ApiProperty({
    description: 'Referral status',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  status: 'active' | 'inactive';

  @ApiProperty({
    description: 'Shards earned from this referral',
    example: 50,
  })
  shards_earned: number;
}

export class ReferralResponseDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  wallet: string;

  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Number of referrals made',
    example: 3,
  })
  referrals_made: number;

  @ApiProperty({
    description: 'Maximum referrals allowed per season',
    example: 10,
  })
  referrals_limit: number;

  @ApiProperty({
    description: 'Total shards earned from referrals',
    example: 150,
  })
  total_referral_shards: number;

  @ApiPropertyOptional({
    description: 'Wallet that referred this user',
    example: '0x5678901234abcdef5678901234abcdef56789012',
  })
  referred_by?: string;

  @ApiProperty({
    description: 'Whether referee bonus is currently active',
    example: true,
  })
  referee_bonus_active: boolean;

  @ApiPropertyOptional({
    description: 'When referee bonus expires',
    example: '2025-02-14T00:00:00Z',
  })
  referee_bonus_expires?: string;

  @ApiProperty({
    description: 'List of active referrals',
    type: [ActiveReferralDto],
  })
  active_referrals: ActiveReferralDto[];
}
