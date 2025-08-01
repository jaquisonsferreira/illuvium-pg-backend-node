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

export enum MigrationVaultStatusDto {
  ACTIVE = 'active',
  PLANNED = 'planned',
  DEPRECATED = 'deprecated',
  MIGRATING = 'migrating',
}

export class HistoricalDataDto {
  @ApiProperty({ description: 'Total deposits from Season 1' })
  @IsString()
  readonly season1Deposits: string;

  @ApiProperty({ description: 'Total shards earned' })
  @IsString()
  readonly totalShardsEarned: string;

  @ApiProperty({
    description: 'Days staked in previous season',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly daysStaked?: number;

  @ApiProperty({ description: 'Peak staking balance', required: false })
  @IsOptional()
  @IsString()
  readonly peakBalance?: string;
}

export class MigrationInfoDetailDto {
  @ApiProperty({ description: 'New vault ID' })
  @IsString()
  readonly newVaultId: string;

  @ApiProperty({ description: 'New chain' })
  @IsString()
  readonly newChain: string;

  @ApiProperty({ description: 'Migration deadline' })
  @IsString()
  readonly migrationDeadline: string;

  @ApiProperty({ description: 'Whether user action is required' })
  @IsBoolean()
  readonly userActionRequired: boolean;

  @ApiProperty({ description: 'Migration guide URL' })
  @IsString()
  readonly migrationGuideUrl: string;

  @ApiProperty({ description: 'Steps remaining for migration' })
  @IsArray()
  @IsString({ each: true })
  readonly stepsRemaining: string[];

  @ApiProperty({ description: 'Estimated migration time in minutes' })
  @IsNumber()
  readonly estimatedMigrationTime: number;

  @ApiProperty({ description: 'Migration fee in ETH', required: false })
  @IsOptional()
  @IsString()
  readonly migrationFee?: string;
}

export class VaultMigrationStatusDto {
  @ApiProperty({ description: 'Vault ID' })
  @IsString()
  readonly vaultId: string;

  @ApiProperty({ description: 'Vault status', enum: MigrationVaultStatusDto })
  @IsEnum(MigrationVaultStatusDto)
  readonly status: MigrationVaultStatusDto;

  @ApiProperty({ description: 'Human-readable vault status' })
  @IsString()
  readonly vaultStatus: string;

  @ApiProperty({ description: 'Current balance in vault' })
  @IsString()
  readonly currentBalance: string;

  @ApiProperty({ description: 'Whether migration is required' })
  @IsBoolean()
  readonly requiresMigration: boolean;

  @ApiProperty({ description: 'Whether migration is available' })
  @IsBoolean()
  readonly migrationAvailable: boolean;

  @ApiProperty({ description: 'Migration information', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationInfoDetailDto)
  readonly migrationInfo?: MigrationInfoDetailDto;

  @ApiProperty({ description: 'Historical data', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => HistoricalDataDto)
  readonly historicalData?: HistoricalDataDto;

  @ApiProperty({
    description: 'Time remaining for migration in milliseconds',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly migrationTimeRemaining?: number;
}

export class MigrationSummaryDto {
  @ApiProperty({ description: 'Total number of vaults' })
  @IsNumber()
  readonly totalVaults: number;

  @ApiProperty({ description: 'Number of vaults requiring migration' })
  @IsNumber()
  readonly vaultsRequiringMigration: number;

  @ApiProperty({ description: 'Number of completed migrations' })
  @IsNumber()
  readonly completedMigrations: number;

  @ApiProperty({ description: 'Total value to migrate' })
  @IsString()
  readonly totalValueToMigrate: string;

  @ApiProperty({ description: 'Migration progress percentage (0-100)' })
  @IsNumber()
  readonly migrationProgress: number;

  @ApiProperty({ description: 'Whether all migrations are complete' })
  @IsBoolean()
  readonly allMigrationsComplete: boolean;
}

export class MigrationStatusResponseDto {
  @ApiProperty({ description: 'User wallet address' })
  @IsString()
  readonly wallet: string;

  @ApiProperty({ description: 'Migration status for each vault' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaultMigrationStatusDto)
  readonly vaults: VaultMigrationStatusDto[];

  @ApiProperty({ description: 'Migration summary' })
  @ValidateNested()
  @Type(() => MigrationSummaryDto)
  readonly summary: MigrationSummaryDto;

  @ApiProperty({ description: 'Global migration deadline' })
  @IsString()
  readonly migrationDeadline: string;

  @ApiProperty({ description: 'Time remaining for migration in milliseconds' })
  @IsNumber()
  readonly timeRemaining: number;

  @ApiProperty({ description: 'Whether migration period is active' })
  @IsBoolean()
  readonly migrationPeriodActive: boolean;

  @ApiProperty({ description: 'Current server timestamp' })
  @IsString()
  readonly timestamp: string;
}
