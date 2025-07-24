import { Injectable, Logger } from '@nestjs/common';
import {
  IStakingSubgraphRepository,
  IStakingBlockchainRepository,
  IPriceFeedRepository,
  VaultPosition,
  EnhancedVaultPosition,
  ChainType,
  DataResponse,
  VaultType,
} from '../../domain/types/staking-types';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';

interface GetVaultPositionInput {
  userAddress: string;
  vaultAddress: string;
  chain: ChainType;
  includeUsdValue?: boolean;
  blockNumber?: number;
}

interface GetVaultPositionOutput {
  position: EnhancedVaultPosition | null;
  metadata: {
    source: 'subgraph' | 'blockchain' | 'hybrid';
    lastUpdated: Date;
    isStale: boolean;
    priceData?: {
      tokenPrice: number;
      lpTokenPrice?: number;
      totalValueUsd: number;
    };
  };
}

@Injectable()
export class GetVaultPositionUseCase {
  private readonly logger = new Logger(GetVaultPositionUseCase.name);

  constructor(
    private readonly subgraphRepository: IStakingSubgraphRepository,
    private readonly blockchainRepository: IStakingBlockchainRepository,
    private readonly priceFeedRepository: IPriceFeedRepository,
    private readonly vaultConfigService: VaultConfigService,
  ) {}

  async execute(input: GetVaultPositionInput): Promise<GetVaultPositionOutput> {
    const {
      userAddress,
      vaultAddress,
      chain,
      includeUsdValue = true,
      blockNumber,
    } = input;

    // Validate inputs
    this.validateInput(input);

    // Get vault configuration
    const vaultConfig = this.vaultConfigService.getVaultConfig(vaultAddress);
    if (!vaultConfig) {
      throw new Error(
        `Vault configuration not found for address: ${vaultAddress}`,
      );
    }

    try {
      // Try subgraph first (primary data source)
      const subgraphResult = await this.getPositionFromSubgraph(
        userAddress,
        vaultAddress,
        chain,
      );

      // Check if subgraph data is fresh enough
      const isFresh = await this.isSubgraphDataFresh(
        subgraphResult,
        chain,
        blockNumber,
      );

      let position: VaultPosition | null;
      let source: 'subgraph' | 'blockchain' | 'hybrid' = 'subgraph';
      let isStale = false;

      if (isFresh && subgraphResult.data) {
        position = subgraphResult.data;
        isStale = subgraphResult.metadata.isStale;
      } else {
        // Fallback to blockchain RPC
        this.logger.warn(
          `Subgraph data is stale for ${vaultAddress}, falling back to blockchain`,
        );
        position = await this.getPositionFromBlockchain(
          userAddress,
          vaultAddress,
          chain,
          blockNumber,
        );
        source = 'blockchain';
        isStale = false; // Blockchain data is always fresh
      }

      if (!position) {
        return {
          position: null,
          metadata: {
            source,
            lastUpdated: new Date(),
            isStale,
          },
        };
      }

      // Enhance position with additional data
      const enhancedPosition = await this.enhancePosition(
        position,
        vaultConfig,
        includeUsdValue,
      );

      // Calculate price data if requested
      let priceData;
      if (includeUsdValue) {
        priceData = await this.calculatePriceData(
          enhancedPosition,
          vaultConfig,
        );
      }

      return {
        position: enhancedPosition,
        metadata: {
          source,
          lastUpdated: new Date(),
          isStale,
          priceData,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vault position for ${userAddress} in ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to retrieve vault position: ${error.message}`);
    }
  }

  private validateInput(input: GetVaultPositionInput): void {
    const { userAddress, vaultAddress, chain } = input;

    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new Error('Invalid user address format');
    }

    if (!vaultAddress || !/^0x[a-fA-F0-9]{40}$/.test(vaultAddress)) {
      throw new Error('Invalid vault address format');
    }

    if (!this.vaultConfigService.validateChain(chain)) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    if (!this.vaultConfigService.validateVaultAddress(vaultAddress)) {
      throw new Error(`Unknown vault address: ${vaultAddress}`);
    }
  }

  private async getPositionFromSubgraph(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultPosition | null>> {
    try {
      return await this.subgraphRepository.getUserPosition(
        userAddress,
        vaultAddress,
        chain,
      );
    } catch (error) {
      this.logger.warn(`Subgraph query failed for ${userAddress}:`, error);
      throw error;
    }
  }

  private async getPositionFromBlockchain(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<VaultPosition | null> {
    try {
      return await this.blockchainRepository.getVaultPosition(
        userAddress,
        vaultAddress,
        chain,
        blockNumber,
      );
    } catch (error) {
      this.logger.error(`Blockchain query failed for ${userAddress}:`, error);
      throw error;
    }
  }

  private async isSubgraphDataFresh(
    subgraphResult: DataResponse<VaultPosition | null>,
    chain: ChainType,
    targetBlock?: number,
  ): Promise<boolean> {
    if (!subgraphResult.metadata.syncStatus) {
      return false;
    }

    const { blocksBehind, isHealthy } = subgraphResult.metadata.syncStatus;

    // Consider data fresh if subgraph is healthy and less than 50 blocks behind
    if (!isHealthy || blocksBehind > 50) {
      return false;
    }

    // If specific block is requested, check if subgraph has indexed it
    if (targetBlock) {
      const { latestBlock } = subgraphResult.metadata.syncStatus;
      return latestBlock >= targetBlock;
    }

    return true;
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

    // Add LP token specific data if applicable
    if (vaultConfig.type === VaultType.LP_TOKEN && includeUsdValue) {
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

  private async calculatePriceData(
    position: EnhancedVaultPosition,
    vaultConfig: any,
  ): Promise<{
    tokenPrice: number;
    lpTokenPrice?: number;
    totalValueUsd: number;
  }> {
    try {
      if (vaultConfig.type === VaultType.SINGLE_TOKEN) {
        // Single token price calculation
        const tokenPrice = await this.priceFeedRepository.getTokenPrice(
          vaultConfig.asset,
          vaultConfig.chain,
        );
        const totalValueUsd =
          parseFloat(position.formattedBalances.assets) * tokenPrice.priceUsd;

        return {
          tokenPrice: tokenPrice.priceUsd,
          totalValueUsd,
        };
      } else if (
        vaultConfig.type === VaultType.LP_TOKEN &&
        position.lpTokenData
      ) {
        // LP token price calculation
        const lpTokenPrice = await this.calculateLPTokenPrice(
          position.lpTokenData,
          vaultConfig.chain,
        );
        const totalValueUsd =
          parseFloat(position.formattedBalances.assets) * lpTokenPrice;

        return {
          tokenPrice: 0, // Not applicable for LP tokens
          lpTokenPrice,
          totalValueUsd,
        };
      }

      return {
        tokenPrice: 0,
        totalValueUsd: 0,
      };
    } catch (error) {
      this.logger.warn(`Failed to calculate price data:`, error);
      return {
        tokenPrice: 0,
        totalValueUsd: 0,
      };
    }
  }

  private async calculateLPTokenPrice(
    lpTokenData: any,
    chain: ChainType,
  ): Promise<number> {
    try {
      // Get prices for both tokens in the LP
      const [token0Price, token1Price] = await Promise.all([
        this.priceFeedRepository.getTokenPrice(lpTokenData.token0, chain),
        this.priceFeedRepository.getTokenPrice(lpTokenData.token1, chain),
      ]);

      // Get token metadata for decimal calculations
      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      // Calculate LP token price: (reserve0 * price0 + reserve1 * price1) / totalSupply
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
      ); // LP tokens typically have 18 decimals

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
      return balance.toFixed(6); // 6 decimal places for display
    } catch (error) {
      this.logger.warn(`Failed to format balance ${rawBalance}:`, error);
      return '0';
    }
  }
}
