import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Specific season ID (defaults to current)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  season?: number;

  @ApiPropertyOptional({
    description: 'Time period for leaderboard',
    enum: ['all_time', '24h', '7d', '30d'],
    example: 'all_time',
  })
  @IsOptional()
  @IsIn(['all_time', '24h', '7d', '30d'])
  timeframe?: 'all_time' | '24h' | '7d' | '30d';

  @ApiPropertyOptional({
    description: 'Page number (defaults to 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (defaults to 100, max 200)',
    example: 100,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search for specific wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include user position in response',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  include_user_position?: boolean;

  @ApiPropertyOptional({
    description: 'User wallet address for position lookup',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsOptional()
  @IsString()
  user_wallet?: string;
}

export class LeaderboardEntryDto {
  @ApiProperty({
    description: 'Leaderboard rank',
    example: 1,
  })
  rank: number;

  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  wallet: string;

  @ApiProperty({
    description: 'Total shards earned',
    example: 5000,
  })
  total_shards: number;

  @ApiProperty({
    description: 'Staking shards',
    example: 3000,
  })
  staking_shards: number;

  @ApiProperty({
    description: 'Social shards',
    example: 1000,
  })
  social_shards: number;

  @ApiProperty({
    description: 'Developer shards',
    example: 800,
  })
  developer_shards: number;

  @ApiProperty({
    description: 'Referral shards',
    example: 200,
  })
  referral_shards: number;

  @ApiPropertyOptional({
    description: 'Change in rank (positive = up, negative = down)',
    example: 2,
  })
  rank_change?: number;

  @ApiPropertyOptional({
    description: 'Last activity timestamp',
    example: '2025-01-15T14:30:00Z',
  })
  last_activity?: string;
}

export class UserPositionDto {
  @ApiProperty({
    description: 'User wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  wallet: string;

  @ApiProperty({
    description: 'User rank',
    example: 42,
  })
  rank: number;

  @ApiProperty({
    description: 'Total shards earned by user',
    example: 1200,
  })
  total_shards: number;

  @ApiProperty({
    description: 'Staking shards',
    example: 800,
  })
  staking_shards: number;

  @ApiProperty({
    description: 'Social shards',
    example: 300,
  })
  social_shards: number;

  @ApiProperty({
    description: 'Developer shards',
    example: 50,
  })
  developer_shards: number;

  @ApiProperty({
    description: 'Referral shards',
    example: 50,
  })
  referral_shards: number;
}

export class LeaderboardPaginationDto {
  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 100,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of participants',
    example: 1500,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 15,
  })
  totalPages: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({
    description: 'Season identifier',
    example: 1,
  })
  season_id: number;

  @ApiProperty({
    description: 'Timeframe for the leaderboard',
    example: 'all_time',
  })
  timeframe: string;

  @ApiProperty({
    description: 'Leaderboard entries',
    type: [LeaderboardEntryDto],
  })
  data: LeaderboardEntryDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: LeaderboardPaginationDto,
  })
  pagination: LeaderboardPaginationDto;

  @ApiPropertyOptional({
    description: 'User position (if requested)',
    type: UserPositionDto,
  })
  user_position?: UserPositionDto;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T04:30:00Z',
  })
  last_updated: string;
}
