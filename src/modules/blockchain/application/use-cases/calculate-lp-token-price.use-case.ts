import { Injectable, Logger } from '@nestjs/common';
import {
  IStakingSubgraphRepository,
  IStakingBlockchainRepository,
  IPriceFeedRepository,
  LPTokenData,
  TokenMetadata,
  TokenPrice,
  LPTokenPrice,
  ChainType,
  DataResponse,
} from '../../domain/types/staking-types';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';

interface CalculateLPTokenPriceInput {
  lpTokenAddress: string;
  chain: ChainType;
  blockNumber?: number;
  includeBreakdown?: boolean;
  includePriceImpact?: boolean;
}

interface CalculateLPTokenPriceOutput {
  lpTokenPrice: LPTokenPrice;
  priceBreakdown?: {
    token0: {
      address: string;
      symbol: string;
      price: number;
      reserveValue: number;
      weight: number;
    };
    token1: {
      address: string;
      symbol: string;
      price: number;
      reserveValue: number;
      weight: number;
    };
    totalLiquidity: number;
    totalSupply: number;
  };
  priceImpact?: {
    buy1Percent: number;
    sell1Percent: number;
    buy5Percent: number;
    sell5Percent: number;
  };
}

@Injectable()
export class CalculateLPTokenPriceUseCase {
  private readonly logger = new Logger(CalculateLPTokenPriceUseCase.name);

  constructor(
    private readonly subgraphRepository: IStakingSubgraphRepository,
    private readonly blockchainRepository: IStakingBlockchainRepository,
    private readonly priceFeedRepository: IPriceFeedRepository,
    private readonly vaultConfigService: VaultConfigService,
  ) {}

  async execute(input: CalculateLPTokenPriceInput): Promise<CalculateLPTokenPriceOutput> {
    const { lpTokenAddress, chain, blockNumber, includeBreakdown = false, includePriceImpact = false } = input;

    // Validate inputs
    this.validateInput(input);

    try {
      // Get LP token data from subgraph (preferred) or blockchain
      const lpTokenData = await this.getLPTokenData(lpTokenAddress, chain, blockNumber);
      
      // Get component token metadata
      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      // Get component token prices
      const [token0Price, token1Price] = await Promise.all([
        this.priceFeedRepository.getTokenPrice(lpTokenData.token0, chain),
        this.priceFeedRepository.getTokenPrice(lpTokenData.token1, chain),
      ]);

      // Calculate LP token price
      const lpTokenPrice = this.calculatePrice(lpTokenData, token0Metadata, token1Metadata, token0Price, token1Price);

      const result: CalculateLPTokenPriceOutput = { lpTokenPrice };

      // Add price breakdown if requested
      if (includeBreakdown) {
        result.priceBreakdown = this.calculatePriceBreakdown(
          lpTokenData,
          token0Metadata,
          token1Metadata,
          token0Price,
          token1Price,
        );
      }

      // Add price impact if requested
      if (includePriceImpact) {
        result.priceImpact = this.calculatePriceImpact(lpTokenData, token0Metadata, token1Metadata);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to calculate LP token price for ${lpTokenAddress}:`, error);
      throw new Error(`Failed to calculate LP token price: ${error.message}`);
    }
  }

  async calculateMultipleLPTokenPrices(
    lpTokenAddresses: string[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<Map<string, LPTokenPrice>> {
    try {
      const pricePromises = lpTokenAddresses.map(async (address) => {
        try {
          const result = await this.execute({ lpTokenAddress: address, chain, blockNumber });
          return [address.toLowerCase(), result.lpTokenPrice] as const;
        } catch (error) {
          this.logger.warn(`Failed to calculate price for LP token ${address}:`, error);
          return [address.toLowerCase(), null] as const;
        }
      });

      const results = await Promise.all(pricePromises);
      
      const priceMap = new Map<string, LPTokenPrice>();
      for (const [address, price] of results) {
        if (price) {
          priceMap.set(address, price);
        }
      }

      return priceMap;
    } catch (error) {
      this.logger.error(`Failed to calculate multiple LP token prices:`, error);
      throw error;
    }
  }

  private validateInput(input: CalculateLPTokenPriceInput): void {
    const { lpTokenAddress, chain } = input;

    if (!lpTokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(lpTokenAddress)) {
      throw new Error('Invalid LP token address format');
    }

    if (!this.vaultConfigService.validateChain(chain)) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  private async getLPTokenData(
    lpTokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<LPTokenData> {
    try {
      // Try subgraph first
      const subgraphResult = await this.subgraphRepository.getLPTokenData(lpTokenAddress, chain);
      
      // Check if subgraph data is fresh enough
      if (this.isSubgraphDataFresh(subgraphResult, blockNumber)) {
        return subgraphResult.data!;
      }

      // Fallback to blockchain
      this.logger.warn(`Subgraph data is stale for LP token ${lpTokenAddress}, using blockchain`);
      return await this.blockchainRepository.getLPTokenData(lpTokenAddress, chain, blockNumber);
    } catch (error) {
      this.logger.error(`Failed to get LP token data for ${lpTokenAddress}:`, error);
      throw error;
    }
  }

  private isSubgraphDataFresh(subgraphResult: DataResponse<LPTokenData | null>, targetBlock?: number): boolean {
    if (!subgraphResult.data || !subgraphResult.metadata.syncStatus) {
      return false;
    }

    const { blocksBehind, isHealthy } = subgraphResult.metadata.syncStatus;
    
    if (!isHealthy || blocksBehind > 50) {
      return false;
    }

    if (targetBlock) {
      const { latestBlock } = subgraphResult.metadata.syncStatus;
      return latestBlock >= targetBlock;
    }

    return true;
  }

  private calculatePrice(
    lpTokenData: LPTokenData,
    token0Metadata: TokenMetadata,
    token1Metadata: TokenMetadata,
    token0Price: TokenPrice,
    token1Price: TokenPrice,
  ): LPTokenPrice {
    try {
      // Convert reserves to human-readable format
      const reserve0 = this.formatTokenAmount(lpTokenData.reserve0, token0Metadata.decimals);
      const reserve1 = this.formatTokenAmount(lpTokenData.reserve1, token1Metadata.decimals);
      const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18); // LP tokens typically have 18 decimals

      // Calculate reserve values in USD
      const reserve0ValueUsd = reserve0 * token0Price.priceUsd;
      const reserve1ValueUsd = reserve1 * token1Price.priceUsd;
      const totalLiquidityUsd = reserve0ValueUsd + reserve1ValueUsd;

      // Calculate LP token price
      const pricePerToken = totalSupply > 0 ? totalLiquidityUsd / totalSupply : 0;

      // Calculate token weights
      const token0Weight = totalLiquidityUsd > 0 ? reserve0ValueUsd / totalLiquidityUsd : 0;
      const token1Weight = totalLiquidityUsd > 0 ? reserve1ValueUsd / totalLiquidityUsd : 0;

      return {
        lpTokenAddress: lpTokenData.address.toLowerCase(),
        token0: token0Metadata.address.toLowerCase(),
        token1: token1Metadata.address.toLowerCase(),
        token0Symbol: token0Metadata.symbol,
        token1Symbol: token1Metadata.symbol,
        priceUsd: pricePerToken,
        reserve0: lpTokenData.reserve0,
        reserve1: lpTokenData.reserve1,
        reserve0Formatted: reserve0.toString(),
        reserve1Formatted: reserve1.toString(),
        reserve0ValueUsd: reserve0ValueUsd,
        reserve1ValueUsd: reserve1ValueUsd,
        totalLiquidityUsd: totalLiquidityUsd,
        totalSupply: lpTokenData.totalSupply,
        totalSupplyFormatted: totalSupply.toString(),
        token0Weight: token0Weight,
        token1Weight: token1Weight,
        lastUpdated: new Date(),
        blockNumber: lpTokenData.blockNumber,
        source: 'calculated',
      };
    } catch (error) {
      this.logger.error(`Failed to calculate LP token price:`, error);
      throw error;
    }
  }

  private calculatePriceBreakdown(
    lpTokenData: LPTokenData,
    token0Metadata: TokenMetadata,
    token1Metadata: TokenMetadata,
    token0Price: TokenPrice,
    token1Price: TokenPrice,
  ): CalculateLPTokenPriceOutput['priceBreakdown'] {
    const reserve0 = this.formatTokenAmount(lpTokenData.reserve0, token0Metadata.decimals);
    const reserve1 = this.formatTokenAmount(lpTokenData.reserve1, token1Metadata.decimals);
    const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18);

    const reserve0ValueUsd = reserve0 * token0Price.priceUsd;
    const reserve1ValueUsd = reserve1 * token1Price.priceUsd;
    const totalLiquidity = reserve0ValueUsd + reserve1ValueUsd;

    const token0Weight = totalLiquidity > 0 ? reserve0ValueUsd / totalLiquidity : 0;
    const token1Weight = totalLiquidity > 0 ? reserve1ValueUsd / totalLiquidity : 0;

    return {
      token0: {
        address: token0Metadata.address.toLowerCase(),
        symbol: token0Metadata.symbol,
        price: token0Price.priceUsd,
        reserveValue: reserve0ValueUsd,
        weight: token0Weight,
      },
      token1: {
        address: token1Metadata.address.toLowerCase(),
        symbol: token1Metadata.symbol,
        price: token1Price.priceUsd,
        reserveValue: reserve1ValueUsd,
        weight: token1Weight,
      },
      totalLiquidity,
      totalSupply,
    };
  }

  private calculatePriceImpact(
    lpTokenData: LPTokenData,
    token0Metadata: TokenMetadata,
    token1Metadata: TokenMetadata,
  ): CalculateLPTokenPriceOutput['priceImpact'] {
    try {
      const reserve0 = this.formatTokenAmount(lpTokenData.reserve0, token0Metadata.decimals);
      const reserve1 = this.formatTokenAmount(lpTokenData.reserve1, token1Metadata.decimals);

      // Calculate price impact for different trade sizes
      // Using Uniswap V2 formula: impact = (amountIn / (reserveIn + amountIn)) * 100
      
      const calculateImpact = (tradePercent: number): { buy: number; sell: number } => {
        const tradeAmount0 = reserve0 * (tradePercent / 100);
        const tradeAmount1 = reserve1 * (tradePercent / 100);

        // Buy impact (buying token0 with token1)
        const buyImpact = (tradeAmount1 / (reserve1 + tradeAmount1)) * 100;
        
        // Sell impact (selling token0 for token1)
        const sellImpact = (tradeAmount0 / (reserve0 + tradeAmount0)) * 100;

        return { buy: buyImpact, sell: sellImpact };
      };

      const impact1Percent = calculateImpact(1);
      const impact5Percent = calculateImpact(5);

      return {
        buy1Percent: impact1Percent.buy,
        sell1Percent: impact1Percent.sell,
        buy5Percent: impact5Percent.buy,
        sell5Percent: impact5Percent.sell,
      };
    } catch (error) {
      this.logger.warn(`Failed to calculate price impact:`, error);
      return {
        buy1Percent: 0,
        sell1Percent: 0,
        buy5Percent: 0,
        sell5Percent: 0,
      };
    }
  }

  private formatTokenAmount(rawAmount: string, decimals: number): number {
    try {
      const divisor = Math.pow(10, decimals);
      return parseFloat(rawAmount) / divisor;
    } catch (error) {
      this.logger.warn(`Failed to format token amount ${rawAmount}:`, error);
      return 0;
    }
  }

  // Helper method for calculating LP share value from asset amounts
  async calculateLPShareFromAssets(
    token0Amount: string,
    token1Amount: string,
    lpTokenAddress: string,
    chain: ChainType,
  ): Promise<{
    lpTokenAmount: string;
    shareOfPool: number;
    estimatedPriceImpact: number;
  }> {
    try {
      const lpTokenData = await this.getLPTokenData(lpTokenAddress, chain);
      
      // Get token metadata for decimal calculations
      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      const providedAmount0 = this.formatTokenAmount(token0Amount, token0Metadata.decimals);
      const providedAmount1 = this.formatTokenAmount(token1Amount, token1Metadata.decimals);
      
      const reserve0 = this.formatTokenAmount(lpTokenData.reserve0, token0Metadata.decimals);
      const reserve1 = this.formatTokenAmount(lpTokenData.reserve1, token1Metadata.decimals);
      const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18);

      // Calculate LP tokens to mint (using minimum ratio to prevent arbitrage)
      const ratio0 = totalSupply > 0 ? providedAmount0 / reserve0 : 0;
      const ratio1 = totalSupply > 0 ? providedAmount1 / reserve1 : 0;
      const lpTokensToMint = Math.min(ratio0, ratio1) * totalSupply;

      // Calculate share of pool
      const newTotalSupply = totalSupply + lpTokensToMint;
      const shareOfPool = newTotalSupply > 0 ? lpTokensToMint / newTotalSupply : 0;

      // Estimate price impact
      const liquidityImpact = lpTokensToMint / totalSupply;
      const estimatedPriceImpact = liquidityImpact * 100; // Simple approximation

      return {
        lpTokenAmount: (lpTokensToMint * Math.pow(10, 18)).toString(), // Convert back to wei
        shareOfPool: shareOfPool * 100, // Percentage
        estimatedPriceImpact,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate LP share from assets:`, error);
      throw error;
    }
  }

  // Helper method for calculating asset amounts from LP tokens
  async calculateAssetsFromLPTokens(
    lpTokenAmount: string,
    lpTokenAddress: string,
    chain: ChainType,
  ): Promise<{
    token0Amount: string;
    token1Amount: string;
    shareOfPool: number;
  }> {
    try {
      const lpTokenData = await this.getLPTokenData(lpTokenAddress, chain);
      
      const lpTokens = this.formatTokenAmount(lpTokenAmount, 18);
      const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18);
      
      // Calculate share of pool
      const shareOfPool = totalSupply > 0 ? lpTokens / totalSupply : 0;

      // Get token metadata for decimal calculations
      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      // Calculate proportional amounts
      const reserve0 = this.formatTokenAmount(lpTokenData.reserve0, token0Metadata.decimals);
      const reserve1 = this.formatTokenAmount(lpTokenData.reserve1, token1Metadata.decimals);

      const token0Amount = reserve0 * shareOfPool;
      const token1Amount = reserve1 * shareOfPool;

      return {
        token0Amount: (token0Amount * Math.pow(10, token0Metadata.decimals)).toString(),
        token1Amount: (token1Amount * Math.pow(10, token1Metadata.decimals)).toString(),
        shareOfPool: shareOfPool * 100, // Percentage
      };
    } catch (error) {
      this.logger.error(`Failed to calculate assets from LP tokens:`, error);
      throw error;
    }
  }
} 