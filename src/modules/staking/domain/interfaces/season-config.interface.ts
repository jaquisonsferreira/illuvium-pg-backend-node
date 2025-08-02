import { ChainType } from '../types/staking-types';

export enum MigrationStatus {
  NOT_APPLICABLE = 'not_applicable',
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SeasonState {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  MIGRATION = 'migration',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export interface SeasonMigrationConfig {
  readonly fromChain: ChainType;
  readonly toChain: ChainType;
  readonly migrationStartTime: number;
  readonly migrationEndTime: number;
  readonly autoMigrationEnabled: boolean;
  readonly migrationPenalty: number;
  readonly migrationRewardBonus: number;
  readonly supportedVaults: string[];
  readonly migrationDeadline: number;
}

export interface SeasonSpecificConfig {
  readonly aprBonus: number;
  readonly earlyBirdBonus?: number;
  readonly loyaltyBonus?: number;
  readonly migrationBonus?: number;
  readonly customParams?: Record<string, any>;
}

export interface SeasonMetadata {
  readonly theme: string;
  readonly bannerUrl?: string;
  readonly iconUrl?: string;
  readonly description?: string;
  readonly customData?: Record<string, any>;
}

export interface SeasonConfigInterface {
  readonly seasonNumber: number;
  readonly name: string;
  readonly description: string;
  readonly primaryChain: ChainType;
  readonly isActive: boolean;
  readonly startTimestamp: number;
  readonly endTimestamp?: number;
  readonly withdrawalEnabled: boolean;
  readonly depositEnabled: boolean;
  readonly migrationStatus: MigrationStatus;
  readonly rewardsMultiplier: number;
  readonly totalRewardsPool: string;
  readonly minStakingPeriod: number;
  readonly maxStakingPeriod: number;
  readonly emergencyWithdrawalEnabled: boolean;
  readonly seasonConfig: SeasonSpecificConfig;
  readonly migrationConfig?: SeasonMigrationConfig;
  readonly metadata: SeasonMetadata;
}

export interface GlobalSeasonSettings {
  readonly defaultMinStakingPeriod: number;
  readonly defaultMaxStakingPeriod: number;
  readonly defaultRewardsMultiplier: number;
  readonly emergencyMode: boolean;
  readonly maintenanceMode: boolean;
  readonly supportedChains: ChainType[];
  readonly migrationGracePeriod: number;
  readonly seasonTransitionBuffer: number;
}

export interface SeasonConfigFile {
  readonly seasons: SeasonConfigInterface[];
  readonly globalSettings: GlobalSeasonSettings;
  readonly metadata: {
    readonly version: string;
    readonly lastUpdated: string;
    readonly configHash: string;
    readonly author: string;
  };
}

export interface SeasonOperationValidation {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly context: {
    readonly currentSeason?: SeasonConfigInterface;
    readonly operationType: 'deposit' | 'withdrawal' | 'migration' | 'transfer';
    readonly timestamp: number;
  };
}

export interface SeasonTransition {
  readonly fromSeason: number;
  readonly toSeason: number;
  readonly transitionTime: number;
  readonly autoTransition: boolean;
  readonly migrationRequired: boolean;
  readonly gracePeriod: number;
}
