import { Injectable, Logger } from '@nestjs/common';
import { VaultConfigService } from '../config/vault-config.service';
import {
  SeasonContext,
  SeasonConfig,
  MigrationStatus,
  SeasonStatusType,
} from '../../domain/types/season.types';

@Injectable()
export class SeasonContextService {
  private readonly logger = new Logger(SeasonContextService.name);

  constructor(private readonly vaultConfigService: VaultConfigService) {}

  async getSeasonContext(): Promise<SeasonContext | null> {
    try {
      const currentSeason = this.vaultConfigService.getCurrentSeasonFromFile();
      if (!currentSeason) {
        this.logger.warn('No current season found');
        return null;
      }

      const nextSeason = this.vaultConfigService.getNextSeasonFromFile();

      const migrationInfo = this.buildMigrationInfo(currentSeason, nextSeason);
      const estimatedMigrationDate = this.calculateEstimatedMigrationDate(
        currentSeason,
        nextSeason,
      );

      return {
        currentSeason,
        nextSeason,
        migrationInfo,
        estimatedMigrationDate,
      };
    } catch (error) {
      this.logger.error('Failed to get season context', error);
      throw error;
    }
  }

  async getCurrentSeason(): Promise<SeasonConfig | null> {
    try {
      return this.vaultConfigService.getCurrentSeasonFromFile() || null;
    } catch (error) {
      this.logger.error('Failed to get current season', error);
      throw error;
    }
  }

  async getSeasonById(seasonId: number): Promise<SeasonConfig | null> {
    try {
      return this.vaultConfigService.getSeasonConfigFromFile(seasonId) || null;
    } catch (error) {
      this.logger.error(`Failed to get season ${seasonId}`, error);
      throw error;
    }
  }

  async getAllSeasons(): Promise<SeasonConfig[]> {
    try {
      return this.vaultConfigService.getAllSeasonConfigsFromFile();
    } catch (error) {
      this.logger.error('Failed to get all seasons', error);
      throw error;
    }
  }

  async isSeasonActive(seasonId: number): Promise<boolean> {
    try {
      const season = await this.getSeasonById(seasonId);
      if (!season) return false;

      const now = new Date();
      return (
        season.status === SeasonStatusType.ACTIVE &&
        new Date(season.startDate) <= now &&
        (!season.endDate || new Date(season.endDate) > now)
      );
    } catch (error) {
      this.logger.error(
        `Failed to check if season ${seasonId} is active`,
        error,
      );
      return false;
    }
  }

  async isMigrationPeriod(): Promise<boolean> {
    try {
      const context = await this.getSeasonContext();
      if (!context?.migrationInfo) return false;

      return context.migrationInfo.status === MigrationStatus.MIGRATING;
    } catch (error) {
      this.logger.error('Failed to check migration period', error);
      return false;
    }
  }

  async getMigrationTimeRemaining(): Promise<number | null> {
    try {
      const context = await this.getSeasonContext();
      if (!context?.migrationInfo?.migrationDeadline) return null;

      const deadline = new Date(context.migrationInfo.migrationDeadline);
      const now = new Date();

      return Math.max(0, deadline.getTime() - now.getTime());
    } catch (error) {
      this.logger.error('Failed to get migration time remaining', error);
      return null;
    }
  }

  async validateSeasonTransition(
    fromSeasonId: number,
    toSeasonId: number,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const errors: string[] = [];

      const fromSeason = await this.getSeasonById(fromSeasonId);
      const toSeason = await this.getSeasonById(toSeasonId);

      if (!fromSeason) {
        errors.push(`Source season ${fromSeasonId} not found`);
      }

      if (!toSeason) {
        errors.push(`Target season ${toSeasonId} not found`);
      }

      if (fromSeason && toSeason) {
        if (toSeasonId !== fromSeasonId + 1) {
          errors.push('Seasons must be consecutive');
        }

        if (!toSeason.migrationConfig) {
          errors.push('Target season has no migration configuration');
        }

        if (fromSeason.chain === toSeason.chain) {
          errors.push('Migration requires different chains');
        }

        const now = new Date();
        if (toSeason.migrationConfig) {
          const migrationStart = new Date(
            toSeason.migrationConfig.migrationStartTime,
          );
          const migrationEnd = new Date(
            toSeason.migrationConfig.migrationEndTime,
          );

          if (now < migrationStart) {
            errors.push('Migration period has not started');
          }

          if (now > migrationEnd) {
            errors.push('Migration period has ended');
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error('Failed to validate season transition', error);
      return {
        isValid: false,
        errors: ['Internal error validating season transition'],
      };
    }
  }

  private buildMigrationInfo(
    currentSeason: SeasonConfig,
    nextSeason?: SeasonConfig,
  ): SeasonContext['migrationInfo'] {
    if (!nextSeason?.migrationConfig) return undefined;

    const now = new Date();
    const migrationStart = new Date(
      nextSeason.migrationConfig.migrationStartTime,
    );
    const migrationEnd = new Date(nextSeason.migrationConfig.migrationEndTime);
    const migrationDeadline = new Date(
      nextSeason.migrationConfig.migrationDeadline,
    );

    let status: MigrationStatus;
    if (now < migrationStart) {
      status = MigrationStatus.UPCOMING;
    } else if (now <= migrationEnd) {
      status = MigrationStatus.MIGRATING;
    } else if (now <= migrationDeadline) {
      status = MigrationStatus.COMPLETED;
    } else {
      status = MigrationStatus.STABLE;
    }

    const vaultConfigs = this.vaultConfigService.getAllVaultSeasonConfigs();
    const newVaultId = vaultConfigs.find(
      (vault) =>
        vault.seasonId === nextSeason.seasonId &&
        vault.chain === nextSeason.chain,
    )?.vaultId;

    return {
      status,
      newVaultId,
      newChain: nextSeason.chain,
      migrationDeadline: nextSeason.migrationConfig.migrationDeadline,
      userActionRequired: nextSeason.migrationConfig.userActionRequired,
      migrationGuideUrl: nextSeason.migrationConfig.migrationGuideUrl,
    };
  }

  private calculateEstimatedMigrationDate(
    currentSeason: SeasonConfig,
    nextSeason?: SeasonConfig,
  ): string | undefined {
    if (!nextSeason?.migrationConfig) return undefined;

    return nextSeason.migrationConfig.migrationStartTime;
  }
}
