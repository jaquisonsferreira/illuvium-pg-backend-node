import {
  BusinessLogicError,
  ContextError,
  ErrorCodes,
} from '@shared/errors/validation.error';

export interface SeasonConfig {
  id: number;
  name: string;
  startDate: Date;
  endDate?: Date;
  supportedChains: string[];
  withdrawalsEnabled: boolean;
  depositEnabled: boolean;
}

export interface VaultStatus {
  vaultId: string;
  chain: string;
  seasonId: number;
  isActive: boolean;
  isDeprecated: boolean;
  withdrawalsLocked: boolean;
}

export class ContextValidator {
  static validateSeasonalOperation(
    operation: 'deposit' | 'withdrawal',
    seasonConfig: SeasonConfig,
    currentSeason: number,
  ): void {
    if (seasonConfig.id !== currentSeason) {
      throw new ContextError(
        ErrorCodes.SEASON_MISMATCH,
        `Operation not allowed in season ${seasonConfig.id}`,
        {
          requested_season: seasonConfig.id,
          current_season: currentSeason,
          operation: operation,
        },
      );
    }

    if (operation === 'withdrawal' && !seasonConfig.withdrawalsEnabled) {
      throw new BusinessLogicError(
        ErrorCodes.WITHDRAWAL_DISABLED,
        'Withdrawals are locked until Obelisk mainnet launch',
        {
          vault_status: 'locked',
          season_id: seasonConfig.id,
          estimated_unlock: 'Q2 2025',
        },
      );
    }

    if (operation === 'deposit' && !seasonConfig.depositEnabled) {
      throw new BusinessLogicError(
        ErrorCodes.VAULT_DEPRECATED,
        `Deposits are disabled for season ${seasonConfig.id}`,
        {
          season_id: seasonConfig.id,
          reason: 'Season has ended or been deprecated',
        },
      );
    }
  }

  static validateChainContext(chain: string, seasonConfig: SeasonConfig): void {
    if (!seasonConfig.supportedChains.includes(chain)) {
      throw new ContextError(
        ErrorCodes.CHAIN_MISMATCH,
        `Chain ${chain} not supported in season ${seasonConfig.id}`,
        {
          requested_chain: chain,
          season_id: seasonConfig.id,
          supported_chains: seasonConfig.supportedChains,
        },
      );
    }
  }

  static validateVaultContext(
    vaultId: string,
    chain: string,
    vaultStatus: VaultStatus | null,
    availableVaults: string[] = [],
  ): void {
    if (!vaultStatus) {
      throw new ContextError(
        ErrorCodes.VAULT_NOT_FOUND,
        `Vault ${vaultId} does not exist on ${chain} chain`,
        {
          vault_id: vaultId,
          chain: chain,
          available_vaults: availableVaults,
        },
      );
    }

    if (!vaultStatus.isActive) {
      throw new BusinessLogicError(
        ErrorCodes.VAULT_DEPRECATED,
        `Vault ${vaultId} is not active`,
        {
          vault_id: vaultId,
          chain: chain,
          reason: 'Vault has been deactivated',
        },
      );
    }

    if (vaultStatus.isDeprecated) {
      throw new BusinessLogicError(
        ErrorCodes.VAULT_DEPRECATED,
        `Vault ${vaultId} has been deprecated`,
        {
          vault_id: vaultId,
          chain: chain,
          migration_info: 'Please use the updated vault configuration',
        },
      );
    }
  }

  static validateSeasonTransition(
    currentSeason: number,
    requestedSeason: number,
    isTransitionPeriod: boolean = false,
  ): void {
    if (requestedSeason > currentSeason) {
      throw new ContextError(
        ErrorCodes.SEASON_MISMATCH,
        `Season ${requestedSeason} has not started yet`,
        {
          requested_season: requestedSeason,
          current_season: currentSeason,
        },
      );
    }

    if (requestedSeason < currentSeason && !isTransitionPeriod) {
      throw new ContextError(
        ErrorCodes.SEASON_MISMATCH,
        `Season ${requestedSeason} has ended`,
        {
          requested_season: requestedSeason,
          current_season: currentSeason,
          message: 'Historical data may be available in read-only mode',
        },
      );
    }

    if (isTransitionPeriod) {
      // During transition, warn about potential data inconsistencies
      console.warn(
        `Season transition in progress from ${currentSeason} to ${currentSeason + 1}`,
      );
    }
  }

  static validateCrossSeasonalDataAccess(
    requestedSeasons: number[],
    currentSeason: number,
    maxHistoricalSeasons: number = 3,
  ): void {
    const uniqueSeasons = [...new Set(requestedSeasons)];

    for (const season of uniqueSeasons) {
      if (season > currentSeason) {
        throw new ContextError(
          ErrorCodes.SEASON_MISMATCH,
          `Cannot access future season ${season}`,
          {
            requested_season: season,
            current_season: currentSeason,
          },
        );
      }

      if (season < currentSeason - maxHistoricalSeasons) {
        throw new ContextError(
          ErrorCodes.SEASON_MISMATCH,
          `Season ${season} data is no longer available`,
          {
            requested_season: season,
            oldest_available_season: currentSeason - maxHistoricalSeasons,
            current_season: currentSeason,
          },
        );
      }
    }
  }

  static validateVaultMigration(
    oldVaultId: string,
    newVaultId: string,
    migrationStatus: {
      isActive: boolean;
      deadline?: Date;
      autoMigrate: boolean;
    },
  ): void {
    if (!migrationStatus.isActive) {
      throw new BusinessLogicError(
        ErrorCodes.VAULT_DEPRECATED,
        'Vault migration is not active',
        {
          old_vault: oldVaultId,
          new_vault: newVaultId,
        },
      );
    }

    if (migrationStatus.deadline && new Date() > migrationStatus.deadline) {
      throw new BusinessLogicError(
        ErrorCodes.VAULT_DEPRECATED,
        'Vault migration deadline has passed',
        {
          old_vault: oldVaultId,
          new_vault: newVaultId,
          deadline: migrationStatus.deadline.toISOString(),
          auto_migrate: migrationStatus.autoMigrate,
        },
      );
    }
  }

  static validateLPTokenContext(
    tokenSymbol: string,
    supportedLPTokens: string[],
  ): void {
    const isLPToken = tokenSymbol.includes('/');

    if (isLPToken && !supportedLPTokens.includes(tokenSymbol)) {
      throw new ContextError(
        ErrorCodes.VAULT_NOT_FOUND,
        `LP token ${tokenSymbol} is not supported`,
        {
          requested_token: tokenSymbol,
          supported_lp_tokens: supportedLPTokens,
        },
      );
    }
  }
}
