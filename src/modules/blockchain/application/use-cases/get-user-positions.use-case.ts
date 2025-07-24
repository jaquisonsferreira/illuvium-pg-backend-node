import { Injectable, Logger } from '@nestjs/common';
import {
  IStakingSubgraphRepository,
  IStakingBlockchainRepository,
  IPriceFeedRepository,
  VaultPosition,
  EnhancedVaultPosition,
  ChainType,
  VaultType,
  PositionQueryParams,
  DataResponse,
} from '../../domain/types/staking-types';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { GetVaultPositionUseCase } from './get-vault-position.use-case';

interface GetUserPositionsInput {
  userAddress: string;
  chain?: ChainType;
  vaultType?: VaultType;
  includeUsdValue?: boolean;
  includeEmptyPositions?: boolean;
  fromBlock?: number;
  toBlock?: number;
}

interface GetUserPositionsOutput {
  positions: EnhancedVaultPosition[];
  summary: {
    totalPositions: number;
    totalValueUsd: number;
    positionsByType: {
      singleToken: number;
      lpToken: number;
    };
    positionsByChain: Record<ChainType, number>;
  };
  metadata: {
    source: 'subgraph' | 'blockchain' | 'hybrid';
    lastUpdated: Date;
    isStale: boolean;
    syncStatus?: any;
  };
}

@Injectable()
export class GetUserPositionsUseCase {
  private readonly logger = new Logger(GetUserPositionsUseCase.name);

  constructor(
    private readonly subgraphRepository: IStakingSubgraphRepository,
    private readonly blockchainRepository: IStakingBlockchainRepository,
    private readonly priceFeedRepository: IPriceFeedRepository,
    private readonly vaultConfigService: VaultConfigService,
    private readonly getVaultPositionUseCase: GetVaultPositionUseCase,
  ) {}

  async execute(input: GetUserPositionsInput): Promise<GetUserPositionsOutput> {
    const {
      userAddress,
      chain,
      vaultType,
      includeUsdValue = true,
      includeEmptyPositions = false,
      fromBlock,
      toBlock,
    } = input;

    // Validate inputs
    this.validateInput(input);

    try {
      let allPositions: EnhancedVaultPosition[] = [];
      let source: 'subgraph' | 'blockchain' | 'hybrid' = 'subgraph';
      let overallIsStale = false;
      let syncStatus: any;

      // Determine which chains to query
      const chainsToQuery = chain ? [chain] : this.getActiveChainsForUser();

      // Query positions for each chain
      for (const chainType of chainsToQuery) {
        const chainPositions = await this.getPositionsForChain(
          userAddress,
          chainType,
          vaultType,
          includeUsdValue,
          includeEmptyPositions,
          fromBlock,
          toBlock,
        );

        allPositions = allPositions.concat(chainPositions.positions);

        // Update metadata based on chain results
        if (chainPositions.metadata.source === 'blockchain') {
          source = source === 'subgraph' ? 'hybrid' : 'blockchain';
        }

        if (chainPositions.metadata.isStale) {
          overallIsStale = true;
        }

        // Use the most recent sync status
        if (
          !syncStatus ||
          (chainPositions.metadata.syncStatus &&
            chainPositions.metadata.syncStatus.lastSyncTime >
              syncStatus.lastSyncTime)
        ) {
          syncStatus = chainPositions.metadata.syncStatus;
        }
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(allPositions);

      return {
        positions: allPositions,
        summary,
        metadata: {
          source,
          lastUpdated: new Date(),
          isStale: overallIsStale,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user positions for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to retrieve user positions: ${error.message}`);
    }
  }

  private validateInput(input: GetUserPositionsInput): void {
    const { userAddress, chain } = input;

    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new Error('Invalid user address format');
    }

    if (chain && !this.vaultConfigService.validateChain(chain)) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  private getActiveChainsForUser(): ChainType[] {
    // Get all chains that have active vaults
    const activeVaults = this.vaultConfigService.getActiveVaults();
    const activeChains = [...new Set(activeVaults.map((vault) => vault.chain))];
    return activeChains;
  }

  private async getPositionsForChain(
    userAddress: string,
    chain: ChainType,
    vaultType?: VaultType,
    includeUsdValue: boolean = true,
    includeEmptyPositions: boolean = false,
    fromBlock?: number,
    toBlock?: number,
  ): Promise<{
    positions: EnhancedVaultPosition[];
    metadata: {
      source: 'subgraph' | 'blockchain';
      isStale: boolean;
      syncStatus?: any;
    };
  }> {
    try {
      // Get vault configurations for the chain and type filter
      let vaultsToQuery = this.vaultConfigService.getVaultsByChain(chain);

      if (vaultType) {
        vaultsToQuery = vaultsToQuery.filter(
          (vault) => vault.type === vaultType,
        );
      }

      // Try subgraph first for bulk query
      const subgraphParams: PositionQueryParams = {
        userAddress,
        chain,
        fromBlock,
        toBlock,
      };

      let positions: EnhancedVaultPosition[] = [];
      let metadata: {
        source: 'subgraph' | 'blockchain';
        isStale: boolean;
        syncStatus?: any;
      } = {
        source: 'subgraph',
        isStale: false,
        syncStatus: undefined,
      };

      try {
        const subgraphResult =
          await this.subgraphRepository.getUserPositions(subgraphParams);

        // Check if subgraph data is fresh
        const isSubgraphFresh = this.isSubgraphDataFresh(subgraphResult);

        if (isSubgraphFresh) {
          // Process and enhance subgraph positions
          positions = await this.processSubgraphPositions(
            subgraphResult.data,
            vaultsToQuery,
            includeUsdValue,
            includeEmptyPositions,
          );

          metadata = {
            source: 'subgraph',
            isStale: subgraphResult.metadata.isStale,
            syncStatus: subgraphResult.metadata.syncStatus,
          };
        } else {
          // Fallback to individual blockchain queries
          this.logger.warn(
            `Subgraph data is stale for chain ${chain}, falling back to blockchain`,
          );
          positions = await this.getPositionsFromBlockchain(
            userAddress,
            vaultsToQuery,
            includeUsdValue,
            includeEmptyPositions,
          );

          metadata = {
            source: 'blockchain',
            isStale: false,
          };
        }
      } catch (subgraphError) {
        // Fallback to blockchain if subgraph fails
        this.logger.warn(
          `Subgraph query failed for chain ${chain}, falling back to blockchain:`,
          subgraphError,
        );
        positions = await this.getPositionsFromBlockchain(
          userAddress,
          vaultsToQuery,
          includeUsdValue,
          includeEmptyPositions,
        );

        metadata = {
          source: 'blockchain',
          isStale: false,
        };
      }

      return { positions, metadata };
    } catch (error) {
      this.logger.error(`Failed to get positions for chain ${chain}:`, error);
      throw error;
    }
  }

  private async processSubgraphPositions(
    rawPositions: VaultPosition[],
    vaultConfigs: any[],
    includeUsdValue: boolean,
    includeEmptyPositions: boolean,
  ): Promise<EnhancedVaultPosition[]> {
    const enhancedPositions: EnhancedVaultPosition[] = [];

    for (const position of rawPositions) {
      const vaultConfig = vaultConfigs.find(
        (v) => v.address.toLowerCase() === position.vault.toLowerCase(),
      );
      if (!vaultConfig) {
        this.logger.warn(`Vault config not found for ${position.vault}`);
        continue;
      }

      // Skip empty positions if not requested
      if (
        !includeEmptyPositions &&
        (position.shares === '0' || position.assets === '0')
      ) {
        continue;
      }

      const enhancedPosition = await this.enhancePosition(
        position,
        vaultConfig,
        includeUsdValue,
      );
      enhancedPositions.push(enhancedPosition);
    }

    return enhancedPositions;
  }

  private async getPositionsFromBlockchain(
    userAddress: string,
    vaultConfigs: any[],
    includeUsdValue: boolean,
    includeEmptyPositions: boolean,
  ): Promise<EnhancedVaultPosition[]> {
    const positions: EnhancedVaultPosition[] = [];

    // Use parallel processing for multiple vault queries
    const positionPromises = vaultConfigs.map(async (vaultConfig) => {
      try {
        const result = await this.getVaultPositionUseCase.execute({
          userAddress,
          vaultAddress: vaultConfig.address,
          chain: vaultConfig.chain,
          includeUsdValue,
        });

        if (
          result.position &&
          (includeEmptyPositions || result.position.assets !== '0')
        ) {
          return result.position;
        }
        return null;
      } catch (error) {
        this.logger.warn(
          `Failed to get position for vault ${vaultConfig.address}:`,
          error,
        );
        return null;
      }
    });

    const results = await Promise.all(positionPromises);

    for (const position of results) {
      if (position) {
        positions.push(position);
      }
    }

    return positions;
  }

  private isSubgraphDataFresh(
    subgraphResult: DataResponse<VaultPosition[]>,
  ): boolean {
    if (!subgraphResult.metadata.syncStatus) {
      return false;
    }

    const { blocksBehind, isHealthy } = subgraphResult.metadata.syncStatus;
    return isHealthy && blocksBehind < 50;
  }

  private async enhancePosition(
    position: VaultPosition,
    vaultConfig: any,
    includeUsdValue: boolean,
  ): Promise<EnhancedVaultPosition> {
    const enhancedPosition: EnhancedVaultPosition = {
      ...position,
      vaultInfo: {
        name: vaultConfig.name,
        symbol: vaultConfig.symbol,
        type: vaultConfig.type,
        chain: vaultConfig.chain,
      },
      assetInfo: {
        symbol: vaultConfig.tokenConfig.symbol,
        name: vaultConfig.tokenConfig.name,
        decimals: vaultConfig.tokenConfig.decimals,
        isLP: vaultConfig.tokenConfig.isLP,
      },
      formattedBalances: {
        shares: this.formatBalance(
          position.shares,
          vaultConfig.tokenConfig.decimals,
        ),
        assets: this.formatBalance(
          position.assets,
          vaultConfig.tokenConfig.decimals,
        ),
      },
    };

    // Add USD value if requested
    if (includeUsdValue) {
      try {
        enhancedPosition.usdValue = await this.calculateUsdValue(
          enhancedPosition,
          vaultConfig,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to calculate USD value for position in ${vaultConfig.address}:`,
          error,
        );
        enhancedPosition.usdValue = 0;
      }
    }

    // Add LP token data if applicable
    if (vaultConfig.type === VaultType.LP_TOKEN) {
      try {
        const lpData = await this.subgraphRepository.getLPTokenData(
          vaultConfig.asset,
          vaultConfig.chain,
        );
        if (lpData.data) {
          enhancedPosition.lpTokenData = lpData.data;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get LP token data for ${vaultConfig.asset}:`,
          error,
        );
      }
    }

    return enhancedPosition;
  }

  private async calculateUsdValue(
    position: EnhancedVaultPosition,
    vaultConfig: any,
  ): Promise<number> {
    try {
      if (vaultConfig.type === VaultType.SINGLE_TOKEN) {
        const tokenPrice = await this.priceFeedRepository.getTokenPrice(
          vaultConfig.asset,
          vaultConfig.chain,
        );
        return (
          parseFloat(position.formattedBalances.assets) * tokenPrice.priceUsd
        );
      } else if (
        vaultConfig.type === VaultType.LP_TOKEN &&
        position.lpTokenData
      ) {
        const lpTokenPrice = await this.calculateLPTokenPrice(
          position.lpTokenData,
          vaultConfig.chain,
        );
        return parseFloat(position.formattedBalances.assets) * lpTokenPrice;
      }

      return 0;
    } catch (error) {
      this.logger.warn(`Failed to calculate USD value:`, error);
      return 0;
    }
  }

  private async calculateLPTokenPrice(
    lpTokenData: any,
    chain: ChainType,
  ): Promise<number> {
    try {
      const [token0Price, token1Price] = await Promise.all([
        this.priceFeedRepository.getTokenPrice(lpTokenData.token0, chain),
        this.priceFeedRepository.getTokenPrice(lpTokenData.token1, chain),
      ]);

      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      const reserve0Value =
        parseFloat(
          this.formatBalance(lpTokenData.reserve0, token0Metadata.decimals),
        ) * token0Price.priceUsd;
      const reserve1Value =
        parseFloat(
          this.formatBalance(lpTokenData.reserve1, token1Metadata.decimals),
        ) * token1Price.priceUsd;
      const totalLiquidity = reserve0Value + reserve1Value;
      const totalSupply = parseFloat(
        this.formatBalance(lpTokenData.totalSupply, 18),
      );

      return totalSupply > 0 ? totalLiquidity / totalSupply : 0;
    } catch (error) {
      this.logger.warn(`Failed to calculate LP token price:`, error);
      return 0;
    }
  }

  private formatBalance(rawBalance: string, decimals: number): string {
    try {
      const divisor = Math.pow(10, decimals);
      const balance = parseFloat(rawBalance) / divisor;
      return balance.toFixed(6);
    } catch (error) {
      this.logger.warn(`Failed to format balance ${rawBalance}:`, error);
      return '0';
    }
  }

  private calculateSummary(
    positions: EnhancedVaultPosition[],
  ): GetUserPositionsOutput['summary'] {
    const summary = {
      totalPositions: positions.length,
      totalValueUsd: 0,
      positionsByType: {
        singleToken: 0,
        lpToken: 0,
      },
      positionsByChain: {} as Record<ChainType, number>,
    };

    for (const position of positions) {
      // Count positions by type
      if (position.vaultInfo.type === VaultType.SINGLE_TOKEN) {
        summary.positionsByType.singleToken++;
      } else if (position.vaultInfo.type === VaultType.LP_TOKEN) {
        summary.positionsByType.lpToken++;
      }

      // Count positions by chain
      const chain = position.vaultInfo.chain;
      summary.positionsByChain[chain] =
        (summary.positionsByChain[chain] || 0) + 1;

      // Sum USD values
      if (position.usdValue) {
        summary.totalValueUsd += position.usdValue;
      }
    }

    return summary;
  }
}
