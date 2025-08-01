import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StakingSubgraphService } from './staking-subgraph.service';
import { AlchemyStakingService } from './alchemy-staking.service';
import { SeasonContextService } from './season-context.service';
import { VaultConfigService } from '../config/vault-config.service';
import {
  VaultPosition,
  DataResponse,
  ChainType,
  StakingTransaction,
} from '../../domain/types/staking-types';
import {
  CrossSeasonPosition,
  VaultStatusType,
  SeasonStatusType,
} from '../../domain/types/season.types';

interface CrossSeasonVaultMapping {
  fromVaultId: string;
  toVaultId: string;
  fromChain: ChainType;
  toChain: ChainType;
  asset: string;
}

interface AggregatedShardsData {
  totalShards: string;
  season1Shards: string;
  season2Shards: string;
  multiplierBonus: number;
}

interface MigrationProgress {
  totalPositions: number;
  migratedPositions: number;
  pendingMigrations: number;
  migrationPercentage: number;
}

@Injectable()
export class CrossSeasonDataService {
  private readonly logger = new Logger(CrossSeasonDataService.name);
  private readonly vaultMappings: CrossSeasonVaultMapping[] = [];

  constructor(
    private readonly subgraphService: StakingSubgraphService,
    private readonly alchemyService: AlchemyStakingService,
    private readonly seasonContextService: SeasonContextService,
    private readonly vaultConfigService: VaultConfigService,
    private readonly configService: ConfigService,
  ) {
    this.initializeVaultMappings();
  }

  private initializeVaultMappings(): void {
    const vaultConfigs = this.vaultConfigService.getAllVaultSeasonConfigs();
    const baseVaults = vaultConfigs.filter((v) => v.chain === ChainType.BASE);
    const obeliskVaults = vaultConfigs.filter(
      (v) => v.chain === ChainType.OBELISK,
    );

    baseVaults.forEach((baseVault) => {
      const correspondingObeliskVault = obeliskVaults.find(
        (ov) => ov.underlyingAsset === baseVault.underlyingAsset,
      );

      if (correspondingObeliskVault) {
        this.vaultMappings.push({
          fromVaultId: baseVault.vaultId,
          toVaultId: correspondingObeliskVault.vaultId,
          fromChain: ChainType.BASE,
          toChain: ChainType.OBELISK,
          asset: baseVault.underlyingAsset,
        });
      }
    });

    this.logger.log(`Initialized ${this.vaultMappings.length} vault mappings`);
  }

  async getUserPositionsAcrossSeasons(
    wallet: string,
  ): Promise<DataResponse<CrossSeasonPosition>> {
    try {
      let positionsResponse;

      try {
        positionsResponse =
          await this.subgraphService.getUserPositionsAcrossSeasons(wallet);
      } catch (subgraphError) {
        this.logger.warn(
          'Subgraph failed, falling back to Alchemy:',
          subgraphError,
        );
        positionsResponse = await this.getUserPositionsViaAlchemy(wallet);
      }

      const seasons = await this.seasonContextService.getAllSeasons();
      const positionsBySeason: any[] = [];

      for (const season of seasons) {
        const chainPositions = positionsResponse.data[season.chain] || [];
        const vaultsForSeason = this.vaultConfigService
          .getAllVaultSeasonConfigs()
          .filter((v) => v.seasonId === season.seasonId);

        for (const vault of vaultsForSeason) {
          const position = chainPositions.find(
            (p) => p.vault.toLowerCase() === vault.vaultAddress.toLowerCase(),
          );

          if (position && parseFloat(position.assets) > 0) {
            positionsBySeason.push({
              seasonId: season.seasonId,
              chain: season.chain,
              vaultId: vault.vaultId,
              status: vault.status,
              balance: position.assets,
              requiresMigration: vault.status === VaultStatusType.DEPRECATED,
              migrationTarget: vault.status === VaultStatusType.PLANNED,
            });
          }
        }
      }

      return {
        data: {
          wallet,
          positionsBySeason,
        },
        metadata: positionsResponse.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cross-season positions for ${wallet}:`,
        error,
      );
      throw new Error(`Failed to aggregate cross-season positions`);
    }
  }

  async getHistoricalShardsEarned(
    wallet: string,
  ): Promise<DataResponse<AggregatedShardsData>> {
    try {
      let season1Transactions, season2Transactions;
      let dataSource = 'subgraph';

      try {
        const [s1Result, s2Result] = await Promise.allSettled([
          this.subgraphService.getUserTransactions({
            userAddress: wallet,
            chain: ChainType.BASE,
            limit: 1000,
          }),
          this.subgraphService.getUserTransactions({
            userAddress: wallet,
            chain: ChainType.OBELISK,
            limit: 1000,
          }),
        ]);

        season1Transactions =
          s1Result.status === 'fulfilled' ? s1Result.value.data : [];
        season2Transactions =
          s2Result.status === 'fulfilled' ? s2Result.value.data : [];
      } catch (subgraphError) {
        this.logger.warn(
          'Subgraph failed for shards calculation, using Alchemy:',
          subgraphError,
        );

        const [s1AlchemyResult, s2AlchemyResult] = await Promise.allSettled([
          this.getHistoricalTransactionsViaAlchemy(wallet, 1),
          this.getHistoricalTransactionsViaAlchemy(wallet, 2),
        ]);

        season1Transactions =
          s1AlchemyResult.status === 'fulfilled'
            ? s1AlchemyResult.value.data
            : [];
        season2Transactions =
          s2AlchemyResult.status === 'fulfilled'
            ? s2AlchemyResult.value.data
            : [];
        dataSource = 'alchemy';
      }

      const season1Shards = this.calculateShardsFromTransactions(
        season1Transactions,
        1.0,
      );

      const season2Shards = this.calculateShardsFromTransactions(
        season2Transactions,
        1.2,
      );

      const totalShards = (
        parseFloat(season1Shards) + parseFloat(season2Shards)
      ).toString();
      const multiplierBonus = parseFloat(season2Shards) * 0.2;

      return {
        data: {
          totalShards,
          season1Shards,
          season2Shards,
          multiplierBonus,
        },
        metadata: {
          source: dataSource as any,
          lastUpdated: new Date(),
          isStale: false,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to calculate shards for ${wallet}:`, error);
      throw new Error(`Failed to calculate historical shards`);
    }
  }

  async getVaultMigrationProgress(
    fromVaultId: string,
    toVaultId: string,
  ): Promise<DataResponse<MigrationProgress>> {
    try {
      const migrationData = await this.subgraphService.getVaultMigrationData(
        fromVaultId,
        toVaultId,
      );

      const fromVaultPositions = await this.subgraphService.getVaultPositions(
        migrationData.data.fromVaultData?.id || fromVaultId,
        ChainType.BASE,
        1000,
      );

      const toVaultPositions = await this.subgraphService.getVaultPositions(
        migrationData.data.toVaultData?.id || toVaultId,
        ChainType.OBELISK,
        1000,
      );

      const totalPositions = fromVaultPositions.data.data.length;
      const migratedPositions = toVaultPositions.data.data.length;
      const pendingMigrations = Math.max(0, totalPositions - migratedPositions);
      const migrationPercentage =
        totalPositions > 0 ? (migratedPositions / totalPositions) * 100 : 0;

      return {
        data: {
          totalPositions,
          migratedPositions,
          pendingMigrations,
          migrationPercentage,
        },
        metadata: migrationData.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get migration progress for ${fromVaultId} -> ${toVaultId}:`,
        error,
      );
      throw new Error(`Failed to get vault migration progress`);
    }
  }

  async getCrossSeasonAnalytics(): Promise<
    DataResponse<{
      totalTVL: string;
      totalTVLUsd: number;
      tvlByChain: Record<
        ChainType,
        { totalAssets: string; totalAssetsUsd: number }
      >;
      activeSeasons: number;
      totalVaults: number;
      migrationProgress: MigrationProgress[];
    }>
  > {
    try {
      const [tvlData, seasons] = await Promise.all([
        this.subgraphService.getCrossSeasonTVL(),
        this.seasonContextService.getAllSeasons(),
      ]);

      const activeSeasons = seasons.filter(
        (s) => s.status === SeasonStatusType.ACTIVE,
      ).length;
      const allVaults = this.vaultConfigService.getAllVaultSeasonConfigs();
      const totalVaults = allVaults.length;

      const migrationProgress = await Promise.all(
        this.vaultMappings.map((mapping) =>
          this.getVaultMigrationProgress(
            mapping.fromVaultId,
            mapping.toVaultId,
          ),
        ),
      );

      return {
        data: {
          ...tvlData.data,
          activeSeasons,
          totalVaults,
          migrationProgress: migrationProgress.map((p) => p.data),
        },
        metadata: tvlData.metadata,
      };
    } catch (error) {
      this.logger.error('Failed to get cross-season analytics:', error);
      throw new Error('Failed to aggregate cross-season analytics');
    }
  }

  async getHistoricalTransactionsByUser(
    wallet: string,
    seasonId?: number,
  ): Promise<DataResponse<StakingTransaction[]>> {
    try {
      const chains = seasonId
        ? [seasonId === 1 ? ChainType.BASE : ChainType.OBELISK]
        : [ChainType.BASE, ChainType.OBELISK];

      const transactionResults = await Promise.allSettled(
        chains.map((chain) =>
          this.subgraphService.getUserTransactions({
            userAddress: wallet,
            chain,
            limit: 1000,
          }),
        ),
      );

      const allTransactions = transactionResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value.data)
        .sort((a, b) => b.timestamp - a.timestamp);

      return {
        data: allTransactions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get historical transactions for ${wallet}:`,
        error,
      );
      throw new Error('Failed to get historical transactions');
    }
  }

  async getVaultCorrelationData(
    fromVaultId: string,
    toVaultId: string,
  ): Promise<
    DataResponse<{
      correlatedUsers: number;
      migrationRate: number;
      averageMigrationTime: number;
      totalMigratedValue: string;
    }>
  > {
    try {
      const mapping = this.vaultMappings.find(
        (m) => m.fromVaultId === fromVaultId && m.toVaultId === toVaultId,
      );

      if (!mapping) {
        throw new Error(`No mapping found for ${fromVaultId} -> ${toVaultId}`);
      }

      const [fromPositions, toPositions] = await Promise.all([
        this.subgraphService.getVaultPositions(
          mapping.fromVaultId,
          mapping.fromChain,
          1000,
        ),
        this.subgraphService.getVaultPositions(
          mapping.toVaultId,
          mapping.toChain,
          1000,
        ),
      ]);

      const fromUsers = new Set(fromPositions.data.data.map((p) => p.user));
      const toUsers = new Set(toPositions.data.data.map((p) => p.user));

      const correlatedUsers = [...fromUsers].filter((user) =>
        toUsers.has(user),
      ).length;
      const migrationRate =
        fromUsers.size > 0 ? (correlatedUsers / fromUsers.size) * 100 : 0;

      const totalMigratedValue = toPositions.data.data
        .reduce((total, position) => total + BigInt(position.assets), BigInt(0))
        .toString();

      return {
        data: {
          correlatedUsers,
          migrationRate,
          averageMigrationTime: 0, // Would need migration event timestamps
          totalMigratedValue,
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get vault correlation data:`, error);
      throw new Error('Failed to get vault correlation data');
    }
  }

  private calculateShardsFromTransactions(
    transactions: StakingTransaction[],
    multiplier: number,
  ): string {
    const totalDeposits = transactions
      .filter((tx) => tx.type === 'deposit')
      .reduce((total, tx) => total + BigInt(tx.amount), BigInt(0));

    const shardsPerToken = BigInt(1); // 1 shard per token staked
    const baseShards = totalDeposits * shardsPerToken;
    const bonusShards = BigInt(
      Math.floor(Number(baseShards) * (multiplier - 1)),
    );

    return (baseShards + bonusShards).toString();
  }

  getVaultMapping(fromVaultId: string): CrossSeasonVaultMapping | undefined {
    return this.vaultMappings.find((m) => m.fromVaultId === fromVaultId);
  }

  getAllVaultMappings(): CrossSeasonVaultMapping[] {
    return [...this.vaultMappings];
  }

  private async getUserPositionsViaAlchemy(
    wallet: string,
  ): Promise<DataResponse<Record<ChainType, VaultPosition[]>>> {
    const chains = [ChainType.BASE, ChainType.OBELISK];
    const results: Record<ChainType, VaultPosition[]> = {
      [ChainType.BASE]: [],
      [ChainType.OBELISK]: [],
    };

    const vaultConfigs = this.vaultConfigService.getAllVaultSeasonConfigs();

    await Promise.allSettled(
      chains.map(async (chain) => {
        try {
          const chainVaults = vaultConfigs.filter((v) => v.chain === chain);
          const positions: VaultPosition[] = [];

          for (const vault of chainVaults) {
            try {
              const position = await this.alchemyService.getUserPosition(
                chain,
                vault.vaultAddress,
                wallet,
              );

              if (position && parseFloat(position.assets) > 0) {
                positions.push(position);
              }
            } catch (vaultError) {
              this.logger.warn(
                `Failed to get position for vault ${vault.vaultId} on ${chain}:`,
                vaultError,
              );
            }
          }

          results[chain] = positions;
        } catch (error) {
          this.logger.warn(
            `Failed to get positions for ${wallet} on ${chain} via Alchemy:`,
            error,
          );
          results[chain] = [];
        }
      }),
    );

    return {
      data: results,
      metadata: {
        source: 'alchemy',
        lastUpdated: new Date(),
        isStale: false,
      },
    };
  }

  private async getHistoricalTransactionsViaAlchemy(
    wallet: string,
    seasonId?: number,
  ): Promise<DataResponse<StakingTransaction[]>> {
    try {
      const chains = seasonId
        ? [seasonId === 1 ? ChainType.BASE : ChainType.OBELISK]
        : [ChainType.BASE, ChainType.OBELISK];

      const vaultConfigs = this.vaultConfigService
        .getAllVaultSeasonConfigs()
        .filter((v) => !seasonId || v.seasonId === seasonId);

      const allTransactions: StakingTransaction[] = [];

      for (const chain of chains) {
        const chainVaults = vaultConfigs.filter((v) => v.chain === chain);

        for (const vault of chainVaults) {
          try {
            const transactions = await this.alchemyService.getUserTransactions({
              userAddress: wallet,
              chain,
              limit: 100,
            });

            allTransactions.push(...transactions.data);
          } catch (error) {
            this.logger.warn(
              `Failed to get transactions for ${vault.vaultId}:`,
              error,
            );
          }
        }
      }

      const sortedTransactions = allTransactions.sort(
        (a, b) => b.timestamp - a.timestamp,
      );

      return {
        data: sortedTransactions,
        metadata: {
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get historical transactions via Alchemy for ${wallet}:`,
        error,
      );
      throw new Error('Failed to get historical transactions via Alchemy');
    }
  }
}
