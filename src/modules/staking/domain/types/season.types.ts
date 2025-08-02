import { ChainType } from './staking-types';

export enum MigrationStatus {
  STABLE = 'stable',
  UPCOMING = 'upcoming',
  MIGRATING = 'migrating',
  COMPLETED = 'completed',
}

export enum SeasonStatusType {
  PLANNED = 'planned',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ENDED = 'ended',
}

export enum VaultMechanicsType {
  LOCKED = 'locked',
  ERC4626 = 'erc4626',
}

export enum VaultStatusType {
  ACTIVE = 'active',
  PLANNED = 'planned',
  DEPRECATED = 'deprecated',
  MIGRATING = 'migrating',
}

export interface SeasonFeatures {
  readonly depositsEnabled: boolean;
  readonly withdrawalsEnabled: boolean;
  readonly lockedUntilMainnet: boolean;
  readonly rewardsMultiplier: number;
}

export interface VaultMechanics {
  readonly type: VaultMechanicsType;
  readonly lockDuration: number;
  readonly earlyWithdrawalPenalty: number;
  readonly compoundingEnabled: boolean;
  readonly redeemDelayDays?: number;
}

export interface MigrationConfig {
  readonly fromChain: ChainType;
  readonly toChain: ChainType;
  readonly migrationStartTime: string;
  readonly migrationEndTime: string;
  readonly migrationDeadline: string;
  readonly userActionRequired: boolean;
  readonly migrationGuideUrl: string;
}

export interface SeasonConfig {
  readonly seasonId: number;
  readonly seasonName: string;
  readonly chain: ChainType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: SeasonStatusType;
  readonly withdrawalEnabled: boolean;
  readonly migrationStatus: MigrationStatus;
  readonly features: SeasonFeatures;
  readonly vaultMechanics: VaultMechanics;
  readonly migrationConfig: MigrationConfig | null;
}

export interface VaultSeasonConfig {
  readonly vaultId: string;
  readonly vaultAddress: string;
  readonly name: string;
  readonly chain: ChainType;
  readonly seasonId: number;
  readonly status: VaultStatusType;
  readonly underlyingAsset: string;
  readonly underlyingAssetAddress?: string;
  readonly mechanics: {
    readonly withdrawalEnabled: boolean;
    readonly lockedUntilMainnet?: boolean;
    readonly redeemDelayDays?: number;
  };
}

export interface SeasonContext {
  readonly currentSeason: SeasonConfig;
  readonly nextSeason?: SeasonConfig;
  readonly migrationInfo?: {
    readonly status: MigrationStatus;
    readonly newVaultId?: string;
    readonly newChain?: ChainType;
    readonly migrationDeadline?: string;
    readonly userActionRequired?: boolean;
    readonly migrationGuideUrl?: string;
  };
  readonly estimatedMigrationDate?: string;
}

export interface CrossSeasonPosition {
  readonly wallet: string;
  readonly positionsBySeason: Array<{
    readonly seasonId: number;
    readonly chain: ChainType;
    readonly vaultId: string;
    readonly status: VaultStatusType;
    readonly balance: string;
    readonly requiresMigration: boolean;
    readonly migrationTarget?: boolean;
  }>;
}

export interface MigrationStatusResponse {
  readonly vaultId: string;
  readonly status: VaultStatusType;
  readonly vaultStatus: string;
  readonly migrationInfo?: {
    readonly newVaultId: string;
    readonly newChain: ChainType;
    readonly migrationDeadline: string;
    readonly userActionRequired: boolean;
    readonly migrationGuideUrl: string;
  };
  readonly historicalData?: {
    readonly season1Deposits: string;
    readonly totalShardsEarned: string;
  };
}

export interface SeasonValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly seasonContext: SeasonContext;
}

export interface SeasonOperationContext {
  readonly operation: 'deposit' | 'withdrawal' | 'transfer';
  readonly seasonId: number;
  readonly vaultId: string;
  readonly userAddress: string;
  readonly amount?: string;
}

export interface SeasonConfigFile {
  readonly seasons: Record<string, SeasonConfig>;
  readonly vaultConfigs: Record<string, VaultSeasonConfig>;
}
