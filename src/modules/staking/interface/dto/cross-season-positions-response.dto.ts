import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CrossSeasonVaultStatusDto {
  ACTIVE = 'active',
  PLANNED = 'planned',
  DEPRECATED = 'deprecated',
  MIGRATING = 'migrating',
}

export class SeasonPositionDto {
  @ApiProperty({ description: 'Season ID' })
  @IsNumber()
  readonly seasonId: number;

  @ApiProperty({ description: 'Season name' })
  @IsString()
  readonly seasonName: string;

  @ApiProperty({ description: 'Chain this position is on' })
  @IsString()
  readonly chain: string;

  @ApiProperty({ description: 'Vault ID' })
  @IsString()
  readonly vaultId: string;

  @ApiProperty({ description: 'Vault name' })
  @IsString()
  readonly vaultName: string;

  @ApiProperty({ description: 'Vault status', enum: CrossSeasonVaultStatusDto })
  @IsEnum(CrossSeasonVaultStatusDto)
  readonly status: CrossSeasonVaultStatusDto;

  @ApiProperty({ description: 'Current balance in vault' })
  @IsString()
  readonly balance: string;

  @ApiProperty({ description: 'Balance in USD equivalent' })
  @IsString()
  readonly balanceUsd: string;

  @ApiProperty({ description: 'Underlying asset symbol' })
  @IsString()
  readonly asset: string;

  @ApiProperty({ description: 'Whether this position requires migration' })
  @IsBoolean()
  readonly requiresMigration: boolean;

  @ApiProperty({ description: 'Whether this is a migration target vault' })
  @IsBoolean()
  readonly migrationTarget: boolean;

  @ApiProperty({ description: 'Shards earned from this position' })
  @IsString()
  readonly shardsEarned: string;

  @ApiProperty({ description: 'Days staked in this position' })
  @IsNumber()
  readonly daysStaked: number;

  @ApiProperty({ description: 'Deposit date' })
  @IsString()
  readonly depositDate: string;

  @ApiProperty({
    description: 'Whether withdrawals are enabled',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly canWithdraw?: boolean;

  @ApiProperty({ description: 'Redeem delay in days', required: false })
  @IsOptional()
  @IsNumber()
  readonly redeemDelayDays?: number;
}

export class SeasonSummaryDto {
  @ApiProperty({ description: 'Season ID' })
  @IsNumber()
  readonly seasonId: number;

  @ApiProperty({ description: 'Season name' })
  @IsString()
  readonly seasonName: string;

  @ApiProperty({ description: 'Total value locked in this season' })
  @IsString()
  readonly totalValue: string;

  @ApiProperty({ description: 'Total value in USD' })
  @IsString()
  readonly totalValueUsd: string;

  @ApiProperty({ description: 'Number of positions in this season' })
  @IsNumber()
  readonly positionCount: number;

  @ApiProperty({ description: 'Total shards earned in this season' })
  @IsString()
  readonly totalShardsEarned: string;

  @ApiProperty({ description: 'Whether season is currently active' })
  @IsBoolean()
  readonly isActive: boolean;

  @ApiProperty({ description: 'Number of positions requiring migration' })
  @IsNumber()
  readonly positionsRequiringMigration: number;
}

export class CrossSeasonTotalDto {
  @ApiProperty({ description: 'Total value across all seasons' })
  @IsString()
  readonly totalValue: string;

  @ApiProperty({ description: 'Total value in USD across all seasons' })
  @IsString()
  readonly totalValueUsd: string;

  @ApiProperty({ description: 'Total number of positions' })
  @IsNumber()
  readonly totalPositions: number;

  @ApiProperty({ description: 'Total shards earned across all seasons' })
  @IsString()
  readonly totalShardsEarned: string;

  @ApiProperty({ description: 'Number of active seasons' })
  @IsNumber()
  readonly activeSeasons: number;

  @ApiProperty({ description: 'Number of positions requiring migration' })
  @IsNumber()
  readonly positionsRequiringMigration: number;

  @ApiProperty({ description: 'Estimated total migration value' })
  @IsString()
  readonly estimatedMigrationValue: string;
}

export class MigrationPathDto {
  @ApiProperty({ description: 'Source vault ID' })
  @IsString()
  readonly fromVaultId: string;

  @ApiProperty({ description: 'Target vault ID' })
  @IsString()
  readonly toVaultId: string;

  @ApiProperty({ description: 'Source chain' })
  @IsString()
  readonly fromChain: string;

  @ApiProperty({ description: 'Target chain' })
  @IsString()
  readonly toChain: string;

  @ApiProperty({ description: 'Migration deadline' })
  @IsString()
  readonly migrationDeadline: string;

  @ApiProperty({ description: 'Whether user action is required' })
  @IsBoolean()
  readonly userActionRequired: boolean;

  @ApiProperty({ description: 'Migration guide URL' })
  @IsString()
  readonly migrationGuideUrl: string;
}

export class CrossSeasonPositionsResponseDto {
  @ApiProperty({ description: 'User wallet address' })
  @IsString()
  readonly wallet: string;

  @ApiProperty({ description: 'Positions by season' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeasonPositionDto)
  readonly positionsBySeason: SeasonPositionDto[];

  @ApiProperty({ description: 'Summary by season' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeasonSummaryDto)
  readonly seasonSummaries: SeasonSummaryDto[];

  @ApiProperty({ description: 'Cross-season totals' })
  @ValidateNested()
  @Type(() => CrossSeasonTotalDto)
  readonly totals: CrossSeasonTotalDto;

  @ApiProperty({ description: 'Available migration paths' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationPathDto)
  readonly migrationPaths: MigrationPathDto[];

  @ApiProperty({ description: 'Whether any migrations are required' })
  @IsBoolean()
  readonly hasPendingMigrations: boolean;

  @ApiProperty({ description: 'Next migration deadline', required: false })
  @IsOptional()
  @IsString()
  readonly nextMigrationDeadline?: string;

  @ApiProperty({ description: 'Current server timestamp' })
  @IsString()
  readonly timestamp: string;
}
