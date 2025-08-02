import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MigrationStatusDto {
  STABLE = 'stable',
  UPCOMING = 'upcoming',
  MIGRATING = 'migrating',
  COMPLETED = 'completed',
}

export enum SeasonStatusDto {
  PLANNED = 'planned',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ENDED = 'ended',
}

export enum VaultMechanicsTypeDto {
  LOCKED = 'locked',
  ERC4626 = 'erc4626',
}

export class SeasonFeaturesDto {
  @ApiProperty({ description: 'Whether deposits are enabled' })
  @IsBoolean()
  readonly depositsEnabled: boolean;

  @ApiProperty({ description: 'Whether withdrawals are enabled' })
  @IsBoolean()
  readonly withdrawalsEnabled: boolean;

  @ApiProperty({ description: 'Whether funds are locked until mainnet' })
  @IsBoolean()
  readonly lockedUntilMainnet: boolean;

  @ApiProperty({ description: 'Rewards multiplier for this season' })
  @IsNumber()
  readonly rewardsMultiplier: number;
}

export class VaultMechanicsDto {
  @ApiProperty({
    description: 'Type of vault mechanics',
    enum: VaultMechanicsTypeDto,
  })
  @IsEnum(VaultMechanicsTypeDto)
  readonly type: VaultMechanicsTypeDto;

  @ApiProperty({ description: 'Lock duration in days' })
  @IsNumber()
  readonly lockDuration: number;

  @ApiProperty({ description: 'Early withdrawal penalty (0-1)' })
  @IsNumber()
  readonly earlyWithdrawalPenalty: number;

  @ApiProperty({ description: 'Whether compounding is enabled' })
  @IsBoolean()
  readonly compoundingEnabled: boolean;

  @ApiProperty({ description: 'Redeem delay in days', required: false })
  @IsOptional()
  @IsNumber()
  readonly redeemDelayDays?: number;
}

export class MigrationConfigDto {
  @ApiProperty({ description: 'Chain migrating from' })
  @IsString()
  readonly fromChain: string;

  @ApiProperty({ description: 'Chain migrating to' })
  @IsString()
  readonly toChain: string;

  @ApiProperty({ description: 'Migration start time' })
  @IsString()
  readonly migrationStartTime: string;

  @ApiProperty({ description: 'Migration end time' })
  @IsString()
  readonly migrationEndTime: string;

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

export class MigrationInfoDto {
  @ApiProperty({ description: 'Migration status', enum: MigrationStatusDto })
  @IsEnum(MigrationStatusDto)
  readonly status: MigrationStatusDto;

  @ApiProperty({ description: 'New vault ID after migration', required: false })
  @IsOptional()
  @IsString()
  readonly newVaultId?: string;

  @ApiProperty({ description: 'New chain after migration', required: false })
  @IsOptional()
  @IsString()
  readonly newChain?: string;

  @ApiProperty({ description: 'Migration deadline', required: false })
  @IsOptional()
  @IsString()
  readonly migrationDeadline?: string;

  @ApiProperty({
    description: 'Whether user action is required',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly userActionRequired?: boolean;

  @ApiProperty({ description: 'Migration guide URL', required: false })
  @IsOptional()
  @IsString()
  readonly migrationGuideUrl?: string;
}

export class SeasonConfigDto {
  @ApiProperty({ description: 'Season ID' })
  @IsNumber()
  readonly seasonId: number;

  @ApiProperty({ description: 'Season name' })
  @IsString()
  readonly seasonName: string;

  @ApiProperty({ description: 'Primary chain for this season' })
  @IsString()
  readonly chain: string;

  @ApiProperty({ description: 'Season start date' })
  @IsString()
  readonly startDate: string;

  @ApiProperty({ description: 'Season end date', required: false })
  @IsOptional()
  @IsString()
  readonly endDate?: string;

  @ApiProperty({ description: 'Season status', enum: SeasonStatusDto })
  @IsEnum(SeasonStatusDto)
  readonly status: SeasonStatusDto;

  @ApiProperty({ description: 'Whether withdrawal is enabled' })
  @IsBoolean()
  readonly withdrawalEnabled: boolean;

  @ApiProperty({ description: 'Migration status', enum: MigrationStatusDto })
  @IsEnum(MigrationStatusDto)
  readonly migrationStatus: MigrationStatusDto;

  @ApiProperty({ description: 'Season features' })
  @ValidateNested()
  @Type(() => SeasonFeaturesDto)
  readonly features: SeasonFeaturesDto;

  @ApiProperty({ description: 'Vault mechanics configuration' })
  @ValidateNested()
  @Type(() => VaultMechanicsDto)
  readonly vaultMechanics: VaultMechanicsDto;

  @ApiProperty({ description: 'Migration configuration', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationConfigDto)
  readonly migrationConfig?: MigrationConfigDto;
}

export class CurrentSeasonResponseDto {
  @ApiProperty({ description: 'Current season configuration' })
  @ValidateNested()
  @Type(() => SeasonConfigDto)
  readonly currentSeason: SeasonConfigDto;

  @ApiProperty({ description: 'Next season configuration', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeasonConfigDto)
  readonly nextSeason?: SeasonConfigDto;

  @ApiProperty({ description: 'Migration information', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationInfoDto)
  readonly migrationInfo?: MigrationInfoDto;

  @ApiProperty({ description: 'Estimated migration date', required: false })
  @IsOptional()
  @IsString()
  readonly estimatedMigrationDate?: string;

  @ApiProperty({ description: 'Current server timestamp' })
  @IsString()
  readonly timestamp: string;
}
