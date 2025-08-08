import { ConfigService } from '@nestjs/config';
import { ChainType } from '../../domain/types/staking-types';
import {
  SeasonStatusType,
  MigrationStatus,
  VaultMechanicsType,
  VaultStatusType,
} from '../../domain/types/season.types';

export interface SeasonConfig {
  seasonId: number;
  seasonName: string;
  chain: ChainType;
  startDate: string;
  endDate: string | null;
  status: SeasonStatusType;
  withdrawalEnabled: boolean;
  migrationStatus: MigrationStatus;
  features: {
    depositsEnabled: boolean;
    withdrawalsEnabled: boolean;
    lockedUntilMainnet: boolean;
    rewardsMultiplier: number;
  };
  vaultMechanics: {
    type: VaultMechanicsType;
    lockDuration: number;
    earlyWithdrawalPenalty: number;
    compoundingEnabled: boolean;
    redeemDelayDays?: number;
  };
  migrationConfig: {
    fromChain: ChainType;
    toChain: ChainType;
    migrationStartTime: string;
    migrationEndTime: string;
    migrationDeadline: string;
    userActionRequired: boolean;
    migrationGuideUrl: string;
  } | null;
}

export interface VaultConfig {
  vaultId: string;
  vaultAddress: string;
  name: string;
  chain: ChainType;
  seasonId: number;
  status: VaultStatusType;
  underlyingAsset: string;
  underlyingAssetAddress: string;
  mechanics: {
    withdrawalEnabled: boolean;
    lockedUntilMainnet?: boolean;
    minLockDuration: number;
    maxLockDuration: number;
    redeemDelayDays: number;
  };
}

export class SeasonsConfigService {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  private getVaultAddress(envKey: string, defaultValue?: string): string {
    return this.configService.get<string>(envKey, defaultValue || '');
  }

  private getTokenAddress(envKey: string, defaultValue?: string): string {
    return this.configService.get<string>(envKey, defaultValue || '');
  }

  getSeasons(): Record<string, SeasonConfig> {
    return {
      '1': {
        seasonId: 1,
        seasonName: 'Season 1',
        chain: ChainType.BASE,
        startDate: '2025-06-01T00:00:00Z',
        endDate: '2025-09-01T00:00:00Z',
        status: SeasonStatusType.ACTIVE,
        withdrawalEnabled: false,
        migrationStatus: MigrationStatus.STABLE,
        features: {
          depositsEnabled: true,
          withdrawalsEnabled: true,
          lockedUntilMainnet: true,
          rewardsMultiplier: 1.0,
        },
        vaultMechanics: {
          type: VaultMechanicsType.LOCKED,
          lockDuration: 0,
          earlyWithdrawalPenalty: 0,
          compoundingEnabled: true,
        },
        migrationConfig: null,
      },
      '2': {
        seasonId: 2,
        seasonName: 'Season 2',
        chain: ChainType.OBELISK,
        startDate: '2025-09-01T00:00:00Z',
        endDate: null,
        status: SeasonStatusType.PLANNED,
        withdrawalEnabled: true,
        migrationStatus: MigrationStatus.UPCOMING,
        features: {
          depositsEnabled: true,
          withdrawalsEnabled: true,
          lockedUntilMainnet: false,
          rewardsMultiplier: 1.2,
        },
        vaultMechanics: {
          type: VaultMechanicsType.ERC4626,
          lockDuration: 14,
          earlyWithdrawalPenalty: 0.1,
          compoundingEnabled: true,
          redeemDelayDays: 14,
        },
        migrationConfig: {
          fromChain: ChainType.BASE,
          toChain: ChainType.OBELISK,
          migrationStartTime: '2025-08-25T00:00:00Z',
          migrationEndTime: '2025-09-08T00:00:00Z',
          migrationDeadline: '2025-10-01T00:00:00Z',
          userActionRequired: true,
          migrationGuideUrl: 'https://docs.obelisk.gg/migration',
        },
      },
    };
  }

  getVaultConfigs(): Record<string, VaultConfig> {
    const ilvVaultBase = this.getVaultAddress('ILV_VAULT_BASE_ADDRESS');
    const ilvEthLpVaultBase = this.getVaultAddress(
      'ILV_ETH_LP_VAULT_BASE_ADDRESS',
    );
    const ilvTokenAddress = this.getTokenAddress('TOKEN_ILV_ADDRESS');
    const ilvEthTokenAddress = this.getTokenAddress('TOKEN_ILV_ETH_ADDRESS');

    const ilvVaultObelisk = this.getVaultAddress(
      'ILV_VAULT_OBELISK_ADDRESS',
      ilvVaultBase,
    );
    const ilvEthLpVaultObelisk = this.getVaultAddress(
      'ILV_ETH_LP_VAULT_OBELISK_ADDRESS',
      ilvEthLpVaultBase,
    );

    return {
      ILV_vault_base: {
        vaultId: 'ILV_vault_base',
        vaultAddress: ilvVaultBase,
        name: 'Illuvium Staking',
        chain: ChainType.BASE,
        seasonId: 1,
        status: VaultStatusType.ACTIVE,
        underlyingAsset: 'ILV',
        underlyingAssetAddress: ilvTokenAddress,
        mechanics: {
          withdrawalEnabled: true,
          lockedUntilMainnet: false,
          minLockDuration: 1,
          maxLockDuration: 31536000,
          redeemDelayDays: 0,
        },
      },
      ILV_vault_obelisk: {
        vaultId: 'ILV_vault_obelisk',
        vaultAddress: ilvVaultObelisk,
        name: 'Illuvium Staking',
        chain: ChainType.OBELISK,
        seasonId: 2,
        status: VaultStatusType.PLANNED,
        underlyingAsset: 'ILV',
        underlyingAssetAddress: ilvTokenAddress,
        mechanics: {
          withdrawalEnabled: true,
          minLockDuration: 1,
          maxLockDuration: 31536000,
          redeemDelayDays: 0,
        },
      },
      ILV_ETH_LP_vault_base: {
        vaultId: 'ILV_ETH_LP_vault_base',
        vaultAddress: ilvEthLpVaultBase,
        name: 'ILV/ETH LP Staking',
        chain: ChainType.BASE,
        seasonId: 1,
        status: VaultStatusType.ACTIVE,
        underlyingAsset: 'ILV/ETH',
        underlyingAssetAddress: ilvEthTokenAddress,
        mechanics: {
          withdrawalEnabled: true,
          lockedUntilMainnet: false,
          minLockDuration: 1,
          maxLockDuration: 31536000,
          redeemDelayDays: 0,
        },
      },
      ILV_ETH_LP_vault_obelisk: {
        vaultId: 'ILV_ETH_LP_vault_obelisk',
        vaultAddress: ilvEthLpVaultObelisk,
        name: 'ILV/ETH LP Staking',
        chain: ChainType.OBELISK,
        seasonId: 2,
        status: VaultStatusType.PLANNED,
        underlyingAsset: 'ILV/ETH',
        underlyingAssetAddress: ilvEthTokenAddress,
        mechanics: {
          withdrawalEnabled: true,
          minLockDuration: 1,
          maxLockDuration: 31536000,
          redeemDelayDays: 0,
        },
      },
    };
  }

  getActiveSeasons(): SeasonConfig[] {
    const seasons = this.getSeasons();
    return Object.values(seasons).filter(
      (s) => s.status === SeasonStatusType.ACTIVE,
    );
  }

  getVaultsForSeason(seasonId: number): VaultConfig[] {
    const vaults = this.getVaultConfigs();
    return Object.values(vaults).filter((v) => v.seasonId === seasonId);
  }

  getVaultsByChain(chain: ChainType): VaultConfig[] {
    const vaults = this.getVaultConfigs();
    return Object.values(vaults).filter((v) => v.chain === chain);
  }

  getActiveVaults(): VaultConfig[] {
    const vaults = this.getVaultConfigs();
    return Object.values(vaults).filter(
      (v) => v.status === VaultStatusType.ACTIVE,
    );
  }
}

export function createSeasonsConfig(configService: ConfigService) {
  return new SeasonsConfigService(configService);
}
