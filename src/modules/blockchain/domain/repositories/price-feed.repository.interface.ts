import { TokenPrice, TokenMetadata, ChainType } from '../types/staking-types';

export interface IPriceFeedRepository {
  /**
   * Gets current USD price for a single token
   */
  getTokenPrice(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenPrice>;

  /**
   * Gets current USD prices for multiple tokens
   */
  getMultipleTokenPrices(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenPrice[]>;

  /**
   * Gets token price by CoinGecko ID
   */
  getTokenPriceByCoinGeckoId(
    coinGeckoId: string,
  ): Promise<TokenPrice>;

  /**
   * Gets multiple token prices by CoinGecko IDs
   */
  getMultipleTokenPricesByCoinGeckoIds(
    coinGeckoIds: string[],
  ): Promise<TokenPrice[]>;

  /**
   * Gets historical price data for a token
   */
  getTokenPriceHistory(
    tokenAddress: string,
    chain: ChainType,
    fromTimestamp: number,
    toTimestamp: number,
    granularity?: 'hourly' | 'daily',
  ): Promise<{
    timestamp: number;
    price: number;
  }[]>;

  /**
   * Gets historical price data by CoinGecko ID
   */
  getTokenPriceHistoryByCoinGeckoId(
    coinGeckoId: string,
    fromTimestamp: number,
    toTimestamp: number,
    granularity?: 'hourly' | 'daily',
  ): Promise<{
    timestamp: number;
    price: number;
  }[]>;

  /**
   * Gets token metadata including icons and CoinGecko ID
   */
  getTokenMetadata(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenMetadata | null>;

  /**
   * Gets multiple tokens metadata
   */
  getMultipleTokensMetadata(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenMetadata[]>;

  /**
   * Searches for token by symbol or name
   */
  searchToken(
    query: string,
    chain?: ChainType,
  ): Promise<{
    id: string;
    symbol: string;
    name: string;
    address?: string;
    iconUrl?: string;
    chain?: string;
  }[]>;

  /**
   * Gets supported platforms/chains from CoinGecko
   */
  getSupportedPlatforms(): Promise<{
    id: string;
    name: string;
    chainId?: number;
  }[]>;

  /**
   * Gets token contract address for a CoinGecko ID on a specific platform
   */
  getTokenAddressByCoinGeckoId(
    coinGeckoId: string,
    platform: string,
  ): Promise<string | null>;

  /**
   * Gets CoinGecko ID for a token address on a specific platform
   */
  getCoinGeckoIdByTokenAddress(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<string | null>;

  /**
   * Gets market data for a token including market cap, volume, etc.
   */
  getTokenMarketData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<{
    marketCap: number;
    volume24h: number;
    circulatingSupply: number;
    totalSupply: number;
    priceChange24h: number;
    priceChangePercentage24h: number;
    ath: number;
    athDate: Date;
    atl: number;
    atlDate: Date;
  } | null>;

  /**
   * Gets trending tokens
   */
  getTrendingTokens(): Promise<{
    id: string;
    symbol: string;
    name: string;
    priceUsd: number;
    priceChangePercentage24h: number;
    marketCapRank: number;
  }[]>;

  /**
   * Gets simple price with 24h change for display
   */
  getSimplePrice(
    tokenAddress: string,
    chain: ChainType,
    includePriceChange?: boolean,
  ): Promise<{
    price: number;
    priceChange24h?: number;
    priceChangePercentage24h?: number;
    lastUpdated: Date;
  }>;

  /**
   * Gets multiple simple prices with 24h change
   */
  getMultipleSimplePrices(
    tokenAddresses: string[],
    chain: ChainType,
    includePriceChange?: boolean,
  ): Promise<Map<string, {
    price: number;
    priceChange24h?: number;
    priceChangePercentage24h?: number;
    lastUpdated: Date;
  }>>;

  /**
   * Validates if a token exists on CoinGecko
   */
  validateToken(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<boolean>;

  /**
   * Gets API rate limit status
   */
  getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    resetTime: Date;
  }>;

  /**
   * Health check for price feed API
   */
  healthCheck(): Promise<{
    isHealthy: boolean;
    latency: number;
    rateLimitRemaining: number;
    lastSuccessfulCall: Date;
  }>;

  /**
   * Gets DeFi protocols data (for LP token price validation)
   */
  getDeFiProtocolData(
    protocolId: string,
  ): Promise<{
    name: string;
    tvl: number;
    tokenAddress?: string;
    chain?: string;
  } | null>;

  /**
   * Gets token icon URL
   */
  getTokenIcon(
    tokenAddress: string,
    chain: ChainType,
    size?: 'small' | 'large',
  ): Promise<string | null>;

  /**
   * Gets multiple token icons
   */
  getMultipleTokenIcons(
    tokenAddresses: string[],
    chain: ChainType,
    size?: 'small' | 'large',
  ): Promise<Map<string, string>>;

  /**
   * Refreshes cached data for a token
   */
  refreshTokenData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<void>;

  /**
   * Clears cache for all tokens
   */
  clearCache(): Promise<void>;

  /**
   * Gets cache statistics
   */
  getCacheStats(): Promise<{
    totalCachedTokens: number;
    cacheHitRate: number;
    averageCacheAge: number;
    oldestCacheEntry: Date;
    newestCacheEntry: Date;
  }>;
} 