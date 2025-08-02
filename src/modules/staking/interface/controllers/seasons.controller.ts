import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { getAddress } from 'ethers';
import { SeasonContextService } from '../../infrastructure/services/season-context.service';
import { SeasonValidationService } from '../../infrastructure/services/season-validation.service';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { CrossSeasonDataService } from '../../infrastructure/services/cross-season-data.service';
import {
  CurrentSeasonResponseDto,
  SeasonConfigDto,
  MigrationInfoDto,
  SeasonFeaturesDto,
  VaultMechanicsDto,
  MigrationConfigDto,
} from '../dto/current-season-response.dto';
import {
  SeasonDetailsResponseDto,
  VaultSeasonInfoDto,
  SeasonStatisticsDto,
  SeasonTimelineDto,
} from '../dto/season-details-response.dto';
import {
  MigrationStatusResponseDto,
  VaultMigrationStatusDto,
  MigrationSummaryDto,
} from '../dto/migration-status-response.dto';
import {
  CrossSeasonPositionsResponseDto,
  SeasonPositionDto,
  SeasonSummaryDto,
  CrossSeasonTotalDto,
  MigrationPathDto,
} from '../dto/cross-season-positions-response.dto';
import {
  SeasonConfig,
  VaultSeasonConfig,
  VaultStatusType,
} from '../../domain/types/season.types';

@ApiTags('seasons')
@Controller('staking/seasons')
export class SeasonsController {
  private readonly logger = new Logger(SeasonsController.name);

  constructor(
    private readonly seasonContextService: SeasonContextService,
    private readonly seasonValidationService: SeasonValidationService,
    private readonly vaultConfigService: VaultConfigService,
    private readonly crossSeasonDataService: CrossSeasonDataService,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current season information' })
  @ApiResponse({
    status: 200,
    description: 'Current season details retrieved successfully',
    type: CurrentSeasonResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No current season found',
  })
  async getCurrentSeason(): Promise<CurrentSeasonResponseDto> {
    try {
      const seasonContext = await this.seasonContextService.getSeasonContext();

      if (!seasonContext) {
        throw new HttpException(
          'No current season found',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        currentSeason: this.mapSeasonToDto(seasonContext.currentSeason),
        nextSeason: seasonContext.nextSeason
          ? this.mapSeasonToDto(seasonContext.nextSeason)
          : undefined,
        migrationInfo: seasonContext.migrationInfo
          ? this.mapMigrationInfoToDto(seasonContext.migrationInfo)
          : undefined,
        estimatedMigrationDate: seasonContext.estimatedMigrationDate,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get current season', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':seasonId')
  @ApiOperation({ summary: 'Get detailed information for a specific season' })
  @ApiParam({ name: 'seasonId', description: 'Season ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Season details retrieved successfully',
    type: SeasonDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Season not found',
  })
  async getSeasonDetails(
    @Param('seasonId', ParseIntPipe) seasonId: number,
  ): Promise<SeasonDetailsResponseDto> {
    try {
      const season = await this.seasonContextService.getSeasonById(seasonId);

      if (!season) {
        throw new HttpException(
          `Season ${seasonId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const vaults = this.getVaultsForSeason(seasonId);
      const statistics = await this.getSeasonStatistics(seasonId);
      const timeline = await this.getSeasonTimeline(season);
      const isActive = await this.seasonContextService.isSeasonActive(seasonId);

      return {
        season: this.mapSeasonToDto(season),
        vaults: vaults.map((vault) => this.mapVaultSeasonInfoToDto(vault)),
        statistics,
        timeline,
        isActive,
        canDeposit: season.features.depositsEnabled && isActive,
        canWithdraw: season.features.withdrawalsEnabled,
        canMigrate: season.migrationConfig !== null && isActive,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get season ${seasonId} details`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/migrations/status')
  @ApiOperation({ summary: 'Get migration status for user positions' })
  @ApiQuery({
    name: 'wallet',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Migration status retrieved successfully',
    type: MigrationStatusResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid wallet address',
  })
  async getMigrationStatus(
    @Query('wallet') wallet: string,
  ): Promise<MigrationStatusResponseDto> {
    try {
      if (!this.isValidEthereumAddress(wallet)) {
        throw new HttpException(
          'Invalid wallet address',
          HttpStatus.BAD_REQUEST,
        );
      }

      const checksummedWallet = getAddress(wallet);

      const vaultConfigs = this.vaultConfigService.getAllVaultSeasonConfigs();
      const vaultStatuses: VaultMigrationStatusDto[] = [];
      const totalValue = '0';
      let vaultsRequiringMigration = 0;
      let completedMigrations = 0;

      for (const vaultConfig of vaultConfigs) {
        const balance = '0'; // TODO: Implement actual balance fetching
        const status = this.mapVaultMigrationStatus(vaultConfig, balance);
        vaultStatuses.push(status);

        if (status.requiresMigration) {
          vaultsRequiringMigration++;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        if (status.status === 'deprecated') {
          completedMigrations++;
        }
      }

      const summary: MigrationSummaryDto = {
        totalVaults: vaultConfigs.length,
        vaultsRequiringMigration,
        completedMigrations,
        totalValueToMigrate: totalValue,
        migrationProgress:
          vaultConfigs.length > 0
            ? (completedMigrations / vaultConfigs.length) * 100
            : 0,
        allMigrationsComplete: vaultsRequiringMigration === 0,
      };

      const migrationTimeRemaining =
        await this.seasonContextService.getMigrationTimeRemaining();
      const migrationPeriodActive =
        await this.seasonContextService.isMigrationPeriod();

      return {
        wallet: checksummedWallet,
        vaults: vaultStatuses,
        summary,
        migrationDeadline: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(), // TODO: Get actual deadline
        timeRemaining: migrationTimeRemaining || 0,
        migrationPeriodActive,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/positions/cross-season')
  @ApiOperation({ summary: 'Get user positions across all seasons' })
  @ApiQuery({
    name: 'wallet',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Cross-season positions retrieved successfully',
    type: CrossSeasonPositionsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid wallet address',
  })
  async getCrossSeasonPositions(
    @Query('wallet') wallet: string,
  ): Promise<CrossSeasonPositionsResponseDto> {
    try {
      if (!this.isValidEthereumAddress(wallet)) {
        throw new HttpException(
          'Invalid wallet address',
          HttpStatus.BAD_REQUEST,
        );
      }

      const checksummedWallet = getAddress(wallet);

      const [crossSeasonPositions, shardsData, allSeasons] = await Promise.all([
        this.crossSeasonDataService.getUserPositionsAcrossSeasons(
          checksummedWallet,
        ),
        this.crossSeasonDataService.getHistoricalShardsEarned(
          checksummedWallet,
        ),
        this.seasonContextService.getAllSeasons(),
      ]);

      const positions: SeasonPositionDto[] = [];
      const seasonSummaries: SeasonSummaryDto[] = [];
      const migrationPaths: MigrationPathDto[] = [];

      for (const season of allSeasons) {
        const seasonPositions =
          crossSeasonPositions.data.positionsBySeason.filter(
            (p) => p.seasonId === season.seasonId,
          );

        let seasonTotalValue = '0';
        const seasonPositionCount = seasonPositions.length;
        const positionsRequiringMigration = seasonPositions.filter(
          (p) => p.requiresMigration,
        ).length;

        const seasonTotalBigInt = seasonPositions.reduce(
          (total, pos) => total + BigInt(pos.balance),
          BigInt(0),
        );
        seasonTotalValue = seasonTotalBigInt.toString();

        for (const pos of seasonPositions) {
          const vault = this.vaultConfigService
            .getAllVaultSeasonConfigs()
            .find((v) => v.vaultId === pos.vaultId);

          if (vault) {
            positions.push(
              this.mapSeasonPositionFromCrossSeasonData(season, vault, pos),
            );
          }
        }

        const isActive = await this.seasonContextService.isSeasonActive(
          season.seasonId,
        );
        const seasonShardsEarned =
          season.seasonId === 1
            ? shardsData.data.season1Shards
            : shardsData.data.season2Shards;

        seasonSummaries.push({
          seasonId: season.seasonId,
          seasonName: season.seasonName,
          totalValue: seasonTotalValue,
          totalValueUsd: seasonTotalValue, // TODO: Convert to USD with price feed
          positionCount: seasonPositionCount,
          totalShardsEarned: seasonShardsEarned,
          isActive,
          positionsRequiringMigration,
        });

        if (season.migrationConfig) {
          migrationPaths.push(this.mapMigrationPath(season));
        }
      }

      const totalValueBigInt = seasonSummaries.reduce(
        (total, summary) => total + BigInt(summary.totalValue),
        BigInt(0),
      );

      const totals: CrossSeasonTotalDto = {
        totalValue: totalValueBigInt.toString(),
        totalValueUsd: totalValueBigInt.toString(), // TODO: Convert to USD
        totalPositions: positions.filter((p) => parseFloat(p.balance) > 0)
          .length,
        totalShardsEarned: shardsData.data.totalShards,
        activeSeasons: seasonSummaries.filter((s) => s.isActive).length,
        positionsRequiringMigration: seasonSummaries.reduce(
          (sum, s) => sum + s.positionsRequiringMigration,
          0,
        ),
        estimatedMigrationValue: seasonSummaries
          .filter((s) => s.positionsRequiringMigration > 0)
          .reduce((total, s) => total + BigInt(s.totalValue), BigInt(0))
          .toString(),
      };

      const hasPendingMigrations = totals.positionsRequiringMigration > 0;
      const nextMigrationDeadline =
        migrationPaths.length > 0
          ? migrationPaths[0].migrationDeadline
          : undefined;

      return {
        wallet: checksummedWallet,
        positionsBySeason: positions,
        seasonSummaries,
        totals,
        migrationPaths,
        hasPendingMigrations,
        nextMigrationDeadline,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get cross-season positions', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private mapSeasonToDto(season: SeasonConfig): SeasonConfigDto {
    return {
      seasonId: season.seasonId,
      seasonName: season.seasonName,
      chain: season.chain,
      startDate: season.startDate,
      endDate: season.endDate || undefined,
      status: season.status as any,
      withdrawalEnabled: season.withdrawalEnabled,
      migrationStatus: season.migrationStatus as any,
      features: season.features as SeasonFeaturesDto,
      vaultMechanics: {
        ...season.vaultMechanics,
        type: season.vaultMechanics.type as any,
      } as VaultMechanicsDto,
      migrationConfig: season.migrationConfig
        ? ({
            ...season.migrationConfig,
            fromChain: season.migrationConfig.fromChain,
            toChain: season.migrationConfig.toChain,
          } as MigrationConfigDto)
        : undefined,
    };
  }

  private mapMigrationInfoToDto(migrationInfo: any): MigrationInfoDto {
    return {
      status: migrationInfo.status,
      newVaultId: migrationInfo.newVaultId,
      newChain: migrationInfo.newChain,
      migrationDeadline: migrationInfo.migrationDeadline,
      userActionRequired: migrationInfo.userActionRequired,
      migrationGuideUrl: migrationInfo.migrationGuideUrl,
    };
  }

  private getVaultsForSeason(seasonId: number): VaultSeasonConfig[] {
    return this.vaultConfigService
      .getAllVaultSeasonConfigs()
      .filter((vault) => vault.seasonId === seasonId);
  }

  private async getSeasonStatistics(
    seasonId: number,
  ): Promise<SeasonStatisticsDto> {
    // TODO: Implement actual statistics calculation
    return {
      totalValueLocked: '0',
      totalStakers: 0,
      averageApr: 0,
      totalRewardsDistributed: '0',
      daysRemaining: undefined,
    };
  }

  private async getSeasonTimeline(
    season: SeasonConfig,
  ): Promise<SeasonTimelineDto> {
    const now = new Date();

    let daysUntilMigration: number | undefined;
    let migrationTimeRemaining: number | undefined;

    if (season.migrationConfig) {
      const migrationStart = new Date(
        season.migrationConfig.migrationStartTime,
      );
      if (now < migrationStart) {
        daysUntilMigration = Math.ceil(
          (migrationStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      const migrationDeadline = new Date(
        season.migrationConfig.migrationDeadline,
      );
      if (now < migrationDeadline) {
        migrationTimeRemaining = migrationDeadline.getTime() - now.getTime();
      }
    }

    return {
      startDate: season.startDate,
      endDate: season.endDate || undefined,
      migrationStartDate: season.migrationConfig?.migrationStartTime,
      migrationEndDate: season.migrationConfig?.migrationEndTime,
      migrationDeadline: season.migrationConfig?.migrationDeadline,
      daysUntilMigration,
      migrationTimeRemaining,
    };
  }

  private mapVaultSeasonInfoToDto(
    vault: VaultSeasonConfig,
  ): VaultSeasonInfoDto {
    return {
      vaultId: vault.vaultId,
      vaultAddress: vault.vaultAddress,
      name: vault.name,
      status: vault.status,
      underlyingAsset: vault.underlyingAsset,
      withdrawalEnabled: vault.mechanics.withdrawalEnabled,
      lockedUntilMainnet: vault.mechanics.lockedUntilMainnet,
      redeemDelayDays: vault.mechanics.redeemDelayDays,
    };
  }

  private mapVaultMigrationStatus(
    vault: VaultSeasonConfig,
    balance: string,
  ): VaultMigrationStatusDto {
    const requiresMigration =
      vault.status === VaultStatusType.DEPRECATED && parseFloat(balance) > 0;

    return {
      vaultId: vault.vaultId,
      status: vault.status as any,
      vaultStatus: this.getVaultStatusDescription(vault.status),
      currentBalance: balance,
      requiresMigration,
      migrationAvailable: requiresMigration,
      historicalData: {
        season1Deposits: balance,
        totalShardsEarned: '0', // TODO: Calculate actual shards
      },
    };
  }

  private mapSeasonPosition(
    season: SeasonConfig,
    vault: VaultSeasonConfig,
    balance: string,
  ): SeasonPositionDto {
    return {
      seasonId: season.seasonId,
      seasonName: season.seasonName,
      chain: season.chain,
      vaultId: vault.vaultId,
      vaultName: vault.name,
      status: vault.status as any,
      balance,
      balanceUsd: balance, // TODO: Convert to USD
      asset: vault.underlyingAsset,
      requiresMigration: vault.status === VaultStatusType.DEPRECATED,
      migrationTarget: vault.status === VaultStatusType.PLANNED,
      shardsEarned: '0', // TODO: Calculate actual shards
      daysStaked: 0, // TODO: Calculate actual days
      depositDate: new Date().toISOString(), // TODO: Get actual deposit date
      canWithdraw: vault.mechanics.withdrawalEnabled,
      redeemDelayDays: vault.mechanics.redeemDelayDays,
    };
  }

  private mapSeasonPositionFromCrossSeasonData(
    season: SeasonConfig,
    vault: VaultSeasonConfig,
    crossSeasonPos: any,
  ): SeasonPositionDto {
    return {
      seasonId: season.seasonId,
      seasonName: season.seasonName,
      chain: season.chain,
      vaultId: vault.vaultId,
      vaultName: vault.name,
      status: crossSeasonPos.status,
      balance: crossSeasonPos.balance,
      balanceUsd: crossSeasonPos.balance, // TODO: Convert to USD with price feed
      asset: vault.underlyingAsset,
      requiresMigration: crossSeasonPos.requiresMigration,
      migrationTarget: crossSeasonPos.migrationTarget,
      shardsEarned: '0', // TODO: Calculate from balance and multiplier
      daysStaked: 0, // TODO: Calculate from deposit timestamp
      depositDate: new Date().toISOString(), // TODO: Get from transaction history
      canWithdraw: vault.mechanics.withdrawalEnabled,
      redeemDelayDays: vault.mechanics.redeemDelayDays,
    };
  }

  private mapMigrationPath(season: SeasonConfig): MigrationPathDto {
    if (!season.migrationConfig) {
      throw new Error('Season has no migration configuration');
    }

    const fromVaults = this.getVaultsForSeason(season.seasonId - 1);
    const toVaults = this.getVaultsForSeason(season.seasonId);

    return {
      fromVaultId: fromVaults[0]?.vaultId || '',
      toVaultId: toVaults[0]?.vaultId || '',
      fromChain: season.migrationConfig.fromChain,
      toChain: season.migrationConfig.toChain,
      migrationDeadline: season.migrationConfig.migrationDeadline,
      userActionRequired: season.migrationConfig.userActionRequired,
      migrationGuideUrl: season.migrationConfig.migrationGuideUrl,
    };
  }

  private getVaultStatusDescription(status: string): string {
    switch (status) {
      case 'active':
        return 'Active and accepting deposits';
      case 'planned':
        return 'Planned for future use';
      case 'deprecated':
        return 'Deprecated - migration recommended';
      case 'migrating':
        return 'Currently in migration';
      default:
        return 'Unknown status';
    }
  }

  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
