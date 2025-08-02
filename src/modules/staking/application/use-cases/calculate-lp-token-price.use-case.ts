import { Injectable, Logger, Inject } from '@nestjs/common';
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
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';

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
    @Inject('IStakingSubgraphRepository')
    private readonly subgraphRepository: IStakingSubgraphRepository,
    @Inject('IStakingBlockchainRepository')
    private readonly blockchainRepository: IStakingBlockchainRepository,
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
    private readonly vaultConfigService: VaultConfigService,
    private readonly tokenDecimalsService: TokenDecimalsService,
  ) {}

  async execute(
    input: CalculateLPTokenPriceInput,
  ): Promise<CalculateLPTokenPriceOutput> {
    const {
      lpTokenAddress,
      chain,
      blockNumber,
      includeBreakdown = false,
      includePriceImpact = false,
    } = input;

    this.validateInput(input);

    try {
      const lpTokenData = await this.getLPTokenData(
        lpTokenAddress,
        chain,
        blockNumber,
      );

      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      const [token0Price, token1Price] = await Promise.all([
        this.priceFeedRepository.getTokenPrice(lpTokenData.token0, chain),
        this.priceFeedRepository.getTokenPrice(lpTokenData.token1, chain),
      ]);

      const lpTokenPrice = this.calculatePrice(
        lpTokenData,
        token0Metadata,
        token1Metadata,
        token0Price,
        token1Price,
      );

      const result: CalculateLPTokenPriceOutput = { lpTokenPrice };

      if (includeBreakdown) {
        result.priceBreakdown = this.calculatePriceBreakdown(
          lpTokenData,
          token0Metadata,
          token1Metadata,
          token0Price,
          token1Price,
        );
      }

      if (includePriceImpact) {
        result.priceImpact = this.calculatePriceImpact(
          lpTokenData,
          token0Metadata,
          token1Metadata,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to calculate LP token price for ${lpTokenAddress}:`,
        error,
      );
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
          const result = await this.execute({
            lpTokenAddress: address,
            chain,
            blockNumber,
          });
          return [address.toLowerCase(), result.lpTokenPrice] as const;
        } catch (error) {
          this.logger.warn(
            `Failed to calculate price for LP token ${address}:`,
            error,
          );
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
      this.logger.log(
        `Getting LP token data for ${lpTokenAddress} on chain ${chain}`,
      );
      const subgraphResult = await this.subgraphRepository.getLPTokenData(
        lpTokenAddress,
        chain,
      );

      if (this.isSubgraphDataFresh(subgraphResult, blockNumber)) {
        return subgraphResult.data!;
      }

      this.logger.warn(
        `Subgraph data is stale for LP token ${lpTokenAddress}, using blockchain`,
      );
      return await this.blockchainRepository.getLPTokenData(
        lpTokenAddress,
        chain,
        blockNumber,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get LP token data for ${lpTokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  private isSubgraphDataFresh(
    subgraphResult: DataResponse<LPTokenData | null>,
    targetBlock?: number,
  ): boolean {
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
      const reserve0 = this.formatTokenAmount(
        lpTokenData.reserve0,
        token0Metadata.decimals,
      );
      const reserve1 = this.formatTokenAmount(
        lpTokenData.reserve1,
        token1Metadata.decimals,
      );
      const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18);

      const reserve0ValueUsd = reserve0 * token0Price.priceUsd;
      const reserve1ValueUsd = reserve1 * token1Price.priceUsd;
      const totalLiquidityUsd = reserve0ValueUsd + reserve1ValueUsd;

      const pricePerToken =
        totalSupply > 0 ? totalLiquidityUsd / totalSupply : 0;

      const token0Weight =
        totalLiquidityUsd > 0 ? reserve0ValueUsd / totalLiquidityUsd : 0;
      const token1Weight =
        totalLiquidityUsd > 0 ? reserve1ValueUsd / totalLiquidityUsd : 0;

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
    const reserve0 = this.formatTokenAmount(
      lpTokenData.reserve0,
      token0Metadata.decimals,
    );
    const reserve1 = this.formatTokenAmount(
      lpTokenData.reserve1,
      token1Metadata.decimals,
    );
    const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18);

    const reserve0ValueUsd = reserve0 * token0Price.priceUsd;
    const reserve1ValueUsd = reserve1 * token1Price.priceUsd;
    const totalLiquidity = reserve0ValueUsd + reserve1ValueUsd;

    const token0Weight =
      totalLiquidity > 0 ? reserve0ValueUsd / totalLiquidity : 0;
    const token1Weight =
      totalLiquidity > 0 ? reserve1ValueUsd / totalLiquidity : 0;

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
      const reserve0 = this.formatTokenAmount(
        lpTokenData.reserve0,
        token0Metadata.decimals,
      );
      const reserve1 = this.formatTokenAmount(
        lpTokenData.reserve1,
        token1Metadata.decimals,
      );

      const calculateImpact = (
        tradePercent: number,
      ): { buy: number; sell: number } => {
        const tradeAmount0 = reserve0 * (tradePercent / 100);
        const tradeAmount1 = reserve1 * (tradePercent / 100);

        const buyImpact = (tradeAmount1 / (reserve1 + tradeAmount1)) * 100;

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
      const formatted = this.tokenDecimalsService.formatTokenAmount(
        rawAmount,
        decimals,
      );
      return parseFloat(formatted);
    } catch (error) {
      this.logger.warn(`Failed to format token amount ${rawAmount}:`, error);
      return 0;
    }
  }

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

      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      const providedAmount0 = this.formatTokenAmount(
        token0Amount,
        token0Metadata.decimals,
      );
      const providedAmount1 = this.formatTokenAmount(
        token1Amount,
        token1Metadata.decimals,
      );

      const reserve0 = this.formatTokenAmount(
        lpTokenData.reserve0,
        token0Metadata.decimals,
      );
      const reserve1 = this.formatTokenAmount(
        lpTokenData.reserve1,
        token1Metadata.decimals,
      );
      const totalSupply = this.formatTokenAmount(lpTokenData.totalSupply, 18);

      const ratio0 = totalSupply > 0 ? providedAmount0 / reserve0 : 0;
      const ratio1 = totalSupply > 0 ? providedAmount1 / reserve1 : 0;
      const lpTokensToMint = Math.min(ratio0, ratio1) * totalSupply;

      const newTotalSupply = totalSupply + lpTokensToMint;
      const shareOfPool =
        newTotalSupply > 0 ? lpTokensToMint / newTotalSupply : 0;

      const liquidityImpact = lpTokensToMint / totalSupply;
      const estimatedPriceImpact = liquidityImpact * 100;

      return {
        lpTokenAmount: this.tokenDecimalsService.parseTokenAmount(
          lpTokensToMint.toString(),
          18,
        ),
        shareOfPool: shareOfPool * 100,
        estimatedPriceImpact,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate LP share from assets:`, error);
      throw error;
    }
  }

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

      const shareOfPool = totalSupply > 0 ? lpTokens / totalSupply : 0;

      const [token0Metadata, token1Metadata] = await Promise.all([
        this.blockchainRepository.getTokenMetadata(lpTokenData.token0, chain),
        this.blockchainRepository.getTokenMetadata(lpTokenData.token1, chain),
      ]);

      const reserve0 = this.formatTokenAmount(
        lpTokenData.reserve0,
        token0Metadata.decimals,
      );
      const reserve1 = this.formatTokenAmount(
        lpTokenData.reserve1,
        token1Metadata.decimals,
      );

      const token0Amount = reserve0 * shareOfPool;
      const token1Amount = reserve1 * shareOfPool;

      return {
        token0Amount: this.tokenDecimalsService.parseTokenAmount(
          token0Amount.toString(),
          token0Metadata.decimals,
        ),
        token1Amount: this.tokenDecimalsService.parseTokenAmount(
          token1Amount.toString(),
          token1Metadata.decimals,
        ),
        shareOfPool: shareOfPool * 100,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate assets from LP tokens:`, error);
      throw error;
    }
  }
}
