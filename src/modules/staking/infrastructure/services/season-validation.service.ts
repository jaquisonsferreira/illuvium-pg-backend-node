import { Injectable, Logger } from '@nestjs/common';
import { SeasonContextService } from './season-context.service';
import { VaultConfigService } from '../config/vault-config.service';
import {
  SeasonValidationResult,
  SeasonOperationContext,
  SeasonContext,
  SeasonConfig,
  MigrationStatus,
  SeasonStatusType,
  VaultStatusType,
} from '../../domain/types/season.types';

@Injectable()
export class SeasonValidationService {
  private readonly logger = new Logger(SeasonValidationService.name);

  constructor(
    private readonly seasonContextService: SeasonContextService,
    private readonly vaultConfigService: VaultConfigService,
  ) {}

  async validateSeasonOperation(
    context: SeasonOperationContext,
  ): Promise<SeasonValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      const seasonContext = await this.seasonContextService.getSeasonContext();
      if (!seasonContext) {
        errors.push('No season context available');
        return {
          isValid: false,
          errors,
          warnings,
          seasonContext: {} as SeasonContext,
        };
      }

      const season = await this.seasonContextService.getSeasonById(
        context.seasonId,
      );
      if (!season) {
        errors.push(`Season ${context.seasonId} not found`);
        return {
          isValid: false,
          errors,
          warnings,
          seasonContext,
        };
      }

      await this.validateGlobalConstraints(errors, warnings);
      await this.validateSeasonConstraints(season, context, errors, warnings);
      await this.validateVaultConstraints(context, errors);
      await this.validateOperationSpecificConstraints(
        season,
        context,
        errors,
        warnings,
      );
      await this.validateTimingConstraints(season, context, errors, warnings);

      if (warnings.length > 0) {
        this.logger.warn(
          `Season operation validation warnings: ${warnings.join(', ')}`,
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        seasonContext,
      };
    } catch (error) {
      this.logger.error('Failed to validate season operation', error);
      return {
        isValid: false,
        errors: ['Internal validation error'],
        warnings: [],
        seasonContext: {} as SeasonContext,
      };
    }
  }

  async validateDeposit(
    seasonId: number,
    vaultId: string,
    userAddress: string,
    amount: string,
  ): Promise<SeasonValidationResult> {
    const context: SeasonOperationContext = {
      operation: 'deposit',
      seasonId,
      vaultId,
      userAddress,
      amount,
    };

    return this.validateSeasonOperation(context);
  }

  async validateWithdrawal(
    seasonId: number,
    vaultId: string,
    userAddress: string,
    amount?: string,
  ): Promise<SeasonValidationResult> {
    const context: SeasonOperationContext = {
      operation: 'withdrawal',
      seasonId,
      vaultId,
      userAddress,
      amount,
    };

    return this.validateSeasonOperation(context);
  }

  async validateTransfer(
    seasonId: number,
    vaultId: string,
    userAddress: string,
    amount: string,
  ): Promise<SeasonValidationResult> {
    const context: SeasonOperationContext = {
      operation: 'transfer',
      seasonId,
      vaultId,
      userAddress,
      amount,
    };

    return this.validateSeasonOperation(context);
  }

  async validateMigration(
    fromSeasonId: number,
    toSeasonId: number,
    vaultId: string,
    userAddress: string,
  ): Promise<SeasonValidationResult> {
    try {
      const transitionValidation =
        await this.seasonContextService.validateSeasonTransition(
          fromSeasonId,
          toSeasonId,
        );

      if (!transitionValidation.isValid) {
        const seasonContext =
          await this.seasonContextService.getSeasonContext();
        return {
          isValid: false,
          errors: transitionValidation.errors,
          warnings: [],
          seasonContext: seasonContext || ({} as SeasonContext),
        };
      }

      const context: SeasonOperationContext = {
        operation: 'transfer',
        seasonId: toSeasonId,
        vaultId,
        userAddress,
      };

      return this.validateSeasonOperation(context);
    } catch (error) {
      this.logger.error('Failed to validate migration', error);
      return {
        isValid: false,
        errors: ['Internal migration validation error'],
        warnings: [],
        seasonContext: {} as SeasonContext,
      };
    }
  }

  async isOperationAllowed(
    operation: 'deposit' | 'withdrawal' | 'transfer',
    seasonId: number,
    vaultId: string,
  ): Promise<boolean> {
    try {
      const context: SeasonOperationContext = {
        operation,
        seasonId,
        vaultId,
        userAddress: '0x0000000000000000000000000000000000000000',
      };

      const result = await this.validateSeasonOperation(context);
      return result.isValid;
    } catch (error) {
      this.logger.error(`Failed to check if ${operation} is allowed`, error);
      return false;
    }
  }

  private async validateGlobalConstraints(
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    if (this.vaultConfigService.isEmergencyMode()) {
      warnings.push('System is in emergency mode - only withdrawals allowed');
    }

    if (this.vaultConfigService.isMaintenanceMode()) {
      errors.push('System is currently in maintenance mode');
    }
  }

  private async validateSeasonConstraints(
    season: SeasonConfig,
    context: SeasonOperationContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    const now = new Date();
    const startDate = new Date(season.startDate);
    const endDate = season.endDate ? new Date(season.endDate) : null;

    if (season.status === SeasonStatusType.PLANNED) {
      if (now < startDate) {
        errors.push('Season has not started yet');
      }
    }

    if (season.status === SeasonStatusType.ENDED) {
      errors.push('Season has ended');
    }

    if (season.status === SeasonStatusType.DEPRECATED) {
      if (context.operation === 'deposit') {
        errors.push('Deposits not allowed in deprecated season');
      } else {
        warnings.push('Season is deprecated - consider migrating');
      }
    }

    if (endDate && now > endDate) {
      if (context.operation === 'deposit') {
        errors.push('Season has ended - deposits not allowed');
      }
    }
  }

  private async validateVaultConstraints(
    context: SeasonOperationContext,
    errors: string[],
  ): Promise<void> {
    const vaultConfig = this.vaultConfigService.getVaultSeasonConfig(
      context.vaultId,
    );
    if (!vaultConfig) {
      errors.push(`Vault ${context.vaultId} configuration not found`);
      return;
    }

    if (vaultConfig.seasonId !== context.seasonId) {
      errors.push('Vault does not belong to the specified season');
    }

    if (
      vaultConfig.status !== VaultStatusType.ACTIVE &&
      vaultConfig.status !== VaultStatusType.PLANNED
    ) {
      errors.push(
        `Vault is ${vaultConfig.status} and not available for operations`,
      );
    }
  }

  private async validateOperationSpecificConstraints(
    season: SeasonConfig,
    context: SeasonOperationContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    switch (context.operation) {
      case 'deposit':
        await this.validateDepositConstraints(
          season,
          context,
          errors,
          warnings,
        );
        break;
      case 'withdrawal':
        await this.validateWithdrawalConstraints(
          season,
          context,
          errors,
          warnings,
        );
        break;
      case 'transfer':
        await this.validateTransferConstraints(
          season,
          context,
          errors,
          warnings,
        );
        break;
    }
  }

  private async validateDepositConstraints(
    season: SeasonConfig,
    context: SeasonOperationContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    if (!season.features.depositsEnabled) {
      errors.push('Deposits are disabled for this season');
    }

    if (context.amount) {
      const amount = parseFloat(context.amount);
      if (amount <= 0) {
        errors.push('Deposit amount must be greater than zero');
      }
    }

    if (season.migrationStatus === MigrationStatus.MIGRATING) {
      warnings.push(
        'Season is in migration - consider waiting or depositing in next season',
      );
    }
  }

  private async validateWithdrawalConstraints(
    season: SeasonConfig,
    context: SeasonOperationContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    if (!season.features.withdrawalsEnabled && !season.withdrawalEnabled) {
      errors.push('Withdrawals are disabled for this season');
    }

    if (season.features.lockedUntilMainnet) {
      errors.push('Funds are locked until mainnet launch');
    }

    if (
      season.vaultMechanics.redeemDelayDays &&
      season.vaultMechanics.redeemDelayDays > 0
    ) {
      warnings.push(
        `Withdrawal has ${season.vaultMechanics.redeemDelayDays} day delay`,
      );
    }

    if (season.vaultMechanics.earlyWithdrawalPenalty > 0) {
      warnings.push(
        `Early withdrawal penalty: ${season.vaultMechanics.earlyWithdrawalPenalty * 100}%`,
      );
    }
  }

  private async validateTransferConstraints(
    season: SeasonConfig,
    context: SeasonOperationContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    if (season.migrationStatus === MigrationStatus.STABLE) {
      warnings.push('No active migration for this season');
    }

    if (season.migrationStatus === MigrationStatus.COMPLETED) {
      errors.push('Migration period has completed');
    }
  }

  private async validateTimingConstraints(
    season: SeasonConfig,
    context: SeasonOperationContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    const now = new Date();

    if (season.migrationConfig && context.operation === 'transfer') {
      const migrationStart = new Date(
        season.migrationConfig.migrationStartTime,
      );
      const migrationEnd = new Date(season.migrationConfig.migrationEndTime);
      const migrationDeadline = new Date(
        season.migrationConfig.migrationDeadline,
      );

      if (now < migrationStart) {
        errors.push('Migration period has not started');
      }

      if (now > migrationDeadline) {
        errors.push('Migration deadline has passed');
      }

      if (now > migrationEnd && now <= migrationDeadline) {
        warnings.push(
          'Migration period has ended but deadline not yet reached',
        );
      }

      const timeUntilDeadline = migrationDeadline.getTime() - now.getTime();
      const daysUntilDeadline = Math.ceil(
        timeUntilDeadline / (1000 * 60 * 60 * 24),
      );

      if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
        warnings.push(`Migration deadline in ${daysUntilDeadline} days`);
      }
    }
  }
}
