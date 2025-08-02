import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeasonConfigDto } from './current-season-response.dto';

export class VaultSeasonInfoDto {
  @ApiProperty({ description: 'Vault ID' })
  @IsString()
  readonly vaultId: string;

  @ApiProperty({ description: 'Vault address' })
  @IsString()
  readonly vaultAddress: string;

  @ApiProperty({ description: 'Vault name' })
  @IsString()
  readonly name: string;

  @ApiProperty({ description: 'Vault status' })
  @IsString()
  readonly status: string;

  @ApiProperty({ description: 'Underlying asset' })
  @IsString()
  readonly underlyingAsset: string;

  @ApiProperty({ description: 'Whether withdrawal is enabled' })
  @IsBoolean()
  readonly withdrawalEnabled: boolean;

  @ApiProperty({ description: 'Whether locked until mainnet', required: false })
  @IsOptional()
  @IsBoolean()
  readonly lockedUntilMainnet?: boolean;

  @ApiProperty({ description: 'Redeem delay in days', required: false })
  @IsOptional()
  @IsNumber()
  readonly redeemDelayDays?: number;
}

export class SeasonStatisticsDto {
  @ApiProperty({ description: 'Total value locked in USD' })
  @IsString()
  readonly totalValueLocked: string;

  @ApiProperty({ description: 'Total number of stakers' })
  @IsNumber()
  readonly totalStakers: number;

  @ApiProperty({ description: 'Average APR' })
  @IsNumber()
  readonly averageApr: number;

  @ApiProperty({ description: 'Total rewards distributed' })
  @IsString()
  readonly totalRewardsDistributed: string;

  @ApiProperty({ description: 'Days remaining in season', required: false })
  @IsOptional()
  @IsNumber()
  readonly daysRemaining?: number;
}

export class SeasonTimelineDto {
  @ApiProperty({ description: 'Season start date' })
  @IsString()
  readonly startDate: string;

  @ApiProperty({ description: 'Season end date', required: false })
  @IsOptional()
  @IsString()
  readonly endDate?: string;

  @ApiProperty({ description: 'Migration start date', required: false })
  @IsOptional()
  @IsString()
  readonly migrationStartDate?: string;

  @ApiProperty({ description: 'Migration end date', required: false })
  @IsOptional()
  @IsString()
  readonly migrationEndDate?: string;

  @ApiProperty({ description: 'Migration deadline', required: false })
  @IsOptional()
  @IsString()
  readonly migrationDeadline?: string;

  @ApiProperty({ description: 'Days until migration starts', required: false })
  @IsOptional()
  @IsNumber()
  readonly daysUntilMigration?: number;

  @ApiProperty({
    description: 'Migration time remaining in milliseconds',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly migrationTimeRemaining?: number;
}

export class SeasonDetailsResponseDto {
  @ApiProperty({ description: 'Season configuration' })
  @ValidateNested()
  @Type(() => SeasonConfigDto)
  readonly season: SeasonConfigDto;

  @ApiProperty({ description: 'Available vaults in this season' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaultSeasonInfoDto)
  readonly vaults: VaultSeasonInfoDto[];

  @ApiProperty({ description: 'Season statistics' })
  @ValidateNested()
  @Type(() => SeasonStatisticsDto)
  readonly statistics: SeasonStatisticsDto;

  @ApiProperty({ description: 'Season timeline information' })
  @ValidateNested()
  @Type(() => SeasonTimelineDto)
  readonly timeline: SeasonTimelineDto;

  @ApiProperty({ description: 'Whether season is currently active' })
  @IsBoolean()
  readonly isActive: boolean;

  @ApiProperty({ description: 'Whether deposits are currently allowed' })
  @IsBoolean()
  readonly canDeposit: boolean;

  @ApiProperty({ description: 'Whether withdrawals are currently allowed' })
  @IsBoolean()
  readonly canWithdraw: boolean;

  @ApiProperty({ description: 'Whether migration is available' })
  @IsBoolean()
  readonly canMigrate: boolean;

  @ApiProperty({ description: 'Current server timestamp' })
  @IsString()
  readonly timestamp: string;
}
