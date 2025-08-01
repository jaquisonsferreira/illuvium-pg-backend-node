import {
  LPTokenData as ILPTokenData,
  LPTokenPrice,
} from '../types/staking-types';

export class LPToken implements ILPTokenData {
  constructor(
    public readonly address: string,
    public readonly token0: string,
    public readonly token1: string,
    public readonly reserve0: string,
    public readonly reserve1: string,
    public readonly totalSupply: string,
    public readonly blockNumber: number,
    public readonly timestamp: number,
  ) {}

  calculatePricePerToken(
    token0Price: { priceUsd: number },
    token1Price: { priceUsd: number },
    token0Decimals: number = 18,
    token1Decimals: number = 18,
  ): LPTokenPrice {
    try {
      const reserve0Decimal =
        parseFloat(this.reserve0) / Math.pow(10, token0Decimals);
      const reserve1Decimal =
        parseFloat(this.reserve1) / Math.pow(10, token1Decimals);
      const totalSupplyDecimal =
        parseFloat(this.totalSupply) / Math.pow(10, 18);

      const reserve0ValueUsd = reserve0Decimal * token0Price.priceUsd;
      const reserve1ValueUsd = reserve1Decimal * token1Price.priceUsd;
      const totalLiquidityUsd = reserve0ValueUsd + reserve1ValueUsd;

      const pricePerToken =
        totalSupplyDecimal > 0 ? totalLiquidityUsd / totalSupplyDecimal : 0;

      const token0Weight =
        totalLiquidityUsd > 0 ? reserve0ValueUsd / totalLiquidityUsd : 0;
      const token1Weight =
        totalLiquidityUsd > 0 ? reserve1ValueUsd / totalLiquidityUsd : 0;

      return {
        lpTokenAddress: this.address,
        token0: this.token0,
        token1: this.token1,
        token0Symbol: '',
        token1Symbol: '',
        priceUsd: pricePerToken,
        reserve0: this.reserve0,
        reserve1: this.reserve1,
        reserve0Formatted: reserve0Decimal.toString(),
        reserve1Formatted: reserve1Decimal.toString(),
        reserve0ValueUsd,
        reserve1ValueUsd,
        totalLiquidityUsd,
        totalSupply: this.totalSupply,
        totalSupplyFormatted: totalSupplyDecimal.toString(),
        token0Weight,
        token1Weight,
        lastUpdated: new Date(),
        blockNumber: this.blockNumber,
        source: 'calculated',
      };
    } catch {
      return {
        lpTokenAddress: this.address,
        token0: this.token0,
        token1: this.token1,
        token0Symbol: '',
        token1Symbol: '',
        priceUsd: 0,
        reserve0: this.reserve0,
        reserve1: this.reserve1,
        reserve0Formatted: '0',
        reserve1Formatted: '0',
        reserve0ValueUsd: 0,
        reserve1ValueUsd: 0,
        totalLiquidityUsd: 0,
        totalSupply: this.totalSupply,
        totalSupplyFormatted: '0',
        token0Weight: 0,
        token1Weight: 0,
        lastUpdated: new Date(),
        blockNumber: this.blockNumber,
        source: 'calculated',
      };
    }
  }

  calculateLPShareFromAssets(
    token0Amount: string,
    token1Amount: string,
    token0Decimals: number = 18,
    token1Decimals: number = 18,
  ): {
    lpTokenAmount: string;
    shareOfPool: number;
  } {
    try {
      const providedAmount0 =
        parseFloat(token0Amount) / Math.pow(10, token0Decimals);
      const providedAmount1 =
        parseFloat(token1Amount) / Math.pow(10, token1Decimals);

      const reserve0 = parseFloat(this.reserve0) / Math.pow(10, token0Decimals);
      const reserve1 = parseFloat(this.reserve1) / Math.pow(10, token1Decimals);
      const totalSupply = parseFloat(this.totalSupply) / Math.pow(10, 18);

      const ratio0 = totalSupply > 0 ? providedAmount0 / reserve0 : 0;
      const ratio1 = totalSupply > 0 ? providedAmount1 / reserve1 : 0;
      const lpTokensToMint = Math.min(ratio0, ratio1) * totalSupply;

      const newTotalSupply = totalSupply + lpTokensToMint;
      const shareOfPool =
        newTotalSupply > 0 ? lpTokensToMint / newTotalSupply : 0;

      return {
        lpTokenAmount: (lpTokensToMint * Math.pow(10, 18)).toString(),
        shareOfPool: shareOfPool * 100,
      };
    } catch {
      return {
        lpTokenAmount: '0',
        shareOfPool: 0,
      };
    }
  }

  calculateAssetsFromLPTokens(
    lpTokenAmount: string,
    token0Decimals: number = 18,
    token1Decimals: number = 18,
  ): {
    token0Amount: string;
    token1Amount: string;
    shareOfPool: number;
  } {
    try {
      const lpTokens = parseFloat(lpTokenAmount) / Math.pow(10, 18);
      const totalSupply = parseFloat(this.totalSupply) / Math.pow(10, 18);

      const shareOfPool = totalSupply > 0 ? lpTokens / totalSupply : 0;

      const reserve0 = parseFloat(this.reserve0) / Math.pow(10, token0Decimals);
      const reserve1 = parseFloat(this.reserve1) / Math.pow(10, token1Decimals);

      const token0Amount = reserve0 * shareOfPool;
      const token1Amount = reserve1 * shareOfPool;

      return {
        token0Amount: (token0Amount * Math.pow(10, token0Decimals)).toString(),
        token1Amount: (token1Amount * Math.pow(10, token1Decimals)).toString(),
        shareOfPool: shareOfPool * 100,
      };
    } catch {
      return {
        token0Amount: '0',
        token1Amount: '0',
        shareOfPool: 0,
      };
    }
  }

  calculatePriceImpact(
    amountIn: string,
    isToken0: boolean,
    decimals: number = 18,
  ): number {
    try {
      const amount = parseFloat(amountIn) / Math.pow(10, decimals);

      const reserve0 = parseFloat(this.reserve0) / Math.pow(10, decimals);
      const reserve1 = parseFloat(this.reserve1) / Math.pow(10, decimals);

      if (isToken0) {
        return (amount / (reserve0 + amount)) * 100;
      } else {
        return (amount / (reserve1 + amount)) * 100;
      }
    } catch {
      return 0;
    }
  }

  toJSON(): ILPTokenData {
    return {
      address: this.address,
      token0: this.token0,
      token1: this.token1,
      reserve0: this.reserve0,
      reserve1: this.reserve1,
      totalSupply: this.totalSupply,
      blockNumber: this.blockNumber,
      timestamp: this.timestamp,
    };
  }

  static fromSubgraphData(data: {
    address: string;
    token0: string;
    token1: string;
    reserve0: string;
    reserve1: string;
    totalSupply: string;
    blockNumber: number;
    timestamp: number;
  }): LPToken {
    return new LPToken(
      data.address,
      data.token0,
      data.token1,
      data.reserve0,
      data.reserve1,
      data.totalSupply,
      data.blockNumber,
      data.timestamp,
    );
  }
}
