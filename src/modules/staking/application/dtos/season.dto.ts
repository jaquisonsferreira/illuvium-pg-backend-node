import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ChainType } from '../../domain/types/staking-types';
import { MigrationStatus } from '../../domain/types/season.types';

export enum SeasonState {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  MIGRATION = 'migration',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export class SeasonMigrationConfigDto {
  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  fromChain: ChainType;

  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  toChain: ChainType;

  @ApiProperty()
  @IsNumber()
  migrationStartTime: number;

  @ApiProperty()
  @IsNumber()
  migrationEndTime: number;

  @ApiProperty()
  @IsBoolean()
  autoMigrationEnabled: boolean;

  @ApiProperty()
  @IsNumber()
  migrationPenalty: number;

  @ApiProperty()
  @IsNumber()
  migrationRewardBonus: number;

  @ApiProperty({ type: [String] })
  supportedVaults: string[];

  @ApiProperty()
  @IsNumber()
  migrationDeadline: number;
}

export class SeasonSpecificConfigDto {
  @ApiProperty()
  @IsNumber()
  aprBonus: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  earlyBirdBonus?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  loyaltyBonus?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  migrationBonus?: number;
}

export class SeasonMetadataDto {
  @ApiProperty()
  @IsString()
  theme: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class SeasonDto {
  @ApiProperty()
  @IsNumber()
  seasonNumber: number;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  primaryChain: ChainType;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @IsNumber()
  startTimestamp: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  endTimestamp?: number;

  @ApiProperty()
  @IsBoolean()
  withdrawalEnabled: boolean;

  @ApiProperty()
  @IsBoolean()
  depositEnabled: boolean;

  @ApiProperty({ enum: MigrationStatus })
  @IsEnum(MigrationStatus)
  migrationStatus: MigrationStatus;

  @ApiProperty()
  @IsNumber()
  rewardsMultiplier: number;

  @ApiProperty()
  @IsString()
  totalRewardsPool: string;

  @ApiProperty()
  @IsNumber()
  minStakingPeriod: number;

  @ApiProperty()
  @IsNumber()
  maxStakingPeriod: number;

  @ApiProperty()
  @IsBoolean()
  emergencyWithdrawalEnabled: boolean;

  @ApiProperty({ type: SeasonSpecificConfigDto })
  @ValidateNested()
  @Type(() => SeasonSpecificConfigDto)
  seasonConfig: SeasonSpecificConfigDto;

  @ApiPropertyOptional({ type: SeasonMigrationConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeasonMigrationConfigDto)
  migrationConfig?: SeasonMigrationConfigDto;

  @ApiProperty({ type: SeasonMetadataDto })
  @ValidateNested()
  @Type(() => SeasonMetadataDto)
  metadata: SeasonMetadataDto;
}

export class SeasonSummaryDto {
  @ApiProperty()
  @IsNumber()
  seasonNumber: number;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: SeasonState })
  @IsEnum(SeasonState)
  state: SeasonState;

  @ApiProperty()
  @IsNumber()
  progress: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  migrationProgress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeRemaining?: number;

  @ApiProperty()
  @IsNumber()
  effectiveAPR: number;

  @ApiProperty()
  @IsBoolean()
  canDeposit: boolean;

  @ApiProperty()
  @IsBoolean()
  canWithdraw: boolean;

  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  primaryChain: ChainType;

  @ApiProperty()
  @IsString()
  totalRewardsPool: string;
}

export class SeasonContextDto {
  @ApiProperty({ type: SeasonDto })
  @ValidateNested()
  @Type(() => SeasonDto)
  currentSeason: SeasonDto;

  @ApiPropertyOptional({ type: SeasonDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeasonDto)
  nextSeason?: SeasonDto;

  @ApiProperty()
  @IsNumber()
  timestamp: number;

  @ApiProperty()
  @IsString()
  version: string;
}

export class SeasonValidationDto {
  @ApiProperty()
  @IsBoolean()
  isValid: boolean;

  @ApiProperty({ type: [String] })
  errors: string[];

  @ApiProperty({ type: [String] })
  warnings: string[];

  @ApiProperty()
  @IsString()
  operationType: 'deposit' | 'withdrawal' | 'migration' | 'transfer';

  @ApiProperty()
  @IsNumber()
  timestamp: number;
}

export class MigrationInfoDto {
  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  fromChain: ChainType;

  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  toChain: ChainType;

  @ApiProperty()
  @IsNumber()
  migrationProgress: number;

  @ApiProperty()
  @IsNumber()
  timeUntilStart: number;

  @ApiProperty()
  @IsNumber()
  timeUntilEnd: number;

  @ApiProperty()
  @IsNumber()
  timeUntilDeadline: number;

  @ApiProperty()
  @IsBoolean()
  autoMigrationEnabled: boolean;

  @ApiProperty()
  @IsNumber()
  migrationRewardBonus: number;

  @ApiProperty({ type: [String] })
  supportedVaults: string[];
}

export class SeasonTransitionDto {
  @ApiProperty()
  @IsNumber()
  fromSeason: number;

  @ApiProperty()
  @IsNumber()
  toSeason: number;

  @ApiProperty()
  @IsNumber()
  transitionTime: number;

  @ApiProperty()
  @IsBoolean()
  autoTransition: boolean;

  @ApiProperty()
  @IsBoolean()
  migrationRequired: boolean;

  @ApiProperty()
  @IsNumber()
  gracePeriod: number;
}
