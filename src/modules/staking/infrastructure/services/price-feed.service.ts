import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  IPriceFeedRepository,
  TokenPrice,
  TokenMetadata,
  ChainType,
} from '../../domain/types/staking-types';
import { CacheService } from '@shared/services/cache.service';

interface CoinGeckoConfig {
  baseUrl: string;
  apiKey?: string;
  rateLimitPerMinute: number;
  timeoutMs: number;
  retryAttempts: number;
}

interface CoinGeckoPrice {
  [tokenId: string]: {
    usd: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  };
}

interface CoinGeckoTokenData {
  id: string;
  symbol: string;
  name: string;
  platforms: {
    [platform: string]: string;
  };
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
  market_data?: {
    current_price?: { usd?: number };
    price_change_24h?: number;
    price_change_percentage_24h?: number;
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    circulating_supply?: number;
    total_supply?: number;
    ath?: { usd?: number };
    ath_date?: { usd?: string };
    atl?: { usd?: number };
    atl_date?: { usd?: string };
  };
}

@Injectable()
export class PriceFeedService implements IPriceFeedRepository {
  private readonly logger = new Logger(PriceFeedService.name);
  private httpClient: AxiosInstance;
  private readonly config: CoinGeckoConfig;
  private readonly platformMappings: Map<ChainType, string> = new Map([
    [ChainType.BASE, 'base'],
    [ChainType.OBELISK, 'obelisk'], // Custom platform for Obelisk
  ]);

  private readonly CACHE_NAMESPACE = 'price-feed';
  private readonly PRICE_CACHE_TTL = 5 * 60; // 5 minutes in seconds
  private readonly METADATA_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.config = {
      baseUrl: this.configService.get<string>(
        'COINGECKO_BASE_URL',
        'https://api.coingecko.com/api/v3',
      ),
      apiKey: this.configService.get<string>('COINGECKO_API_KEY'),
      rateLimitPerMinute: this.configService.get<number>(
        'COINGECKO_RATE_LIMIT',
        30,
      ),
      timeoutMs: this.configService.get<number>('COINGECKO_TIMEOUT_MS', 10000),
      retryAttempts: this.configService.get<number>(
        'COINGECKO_RETRY_ATTEMPTS',
        3,
      ),
    };

    this.initializeHttpClient();
  }

  private initializeHttpClient(): void {
    const headers: Record<string, string> = {
      'User-Agent': 'Obelisk-Staking-API/1.0',
      Accept: 'application/json',
    };

    if (this.config.apiKey) {
      headers['x-cg-pro-api-key'] = this.config.apiKey;
    }

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutMs,
      headers,
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `CoinGecko request: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        this.logger.error('CoinGecko request error:', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          this.logger.warn('CoinGecko rate limit exceeded');
        } else {
          this.logger.error(`CoinGecko response error: ${error.message}`);
        }
        return Promise.reject(error);
      },
    );
  }

  async getTokenPrice(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenPrice> {
    const cacheKey = `${this.CACHE_NAMESPACE}:price:${chain}:${tokenAddress.toLowerCase()}`;

    const cached = await this.cacheService.get<TokenPrice>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const platform = this.platformMappings.get(chain);
      if (!platform) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await this.httpClient.get<CoinGeckoPrice>(
        '/simple/token_price',
        {
          params: {
            id: platform,
            contract_addresses: tokenAddress.toLowerCase(),
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_last_updated_at: true,
          },
        },
      );

      const priceData = response.data[tokenAddress.toLowerCase()];
      if (!priceData) {
        throw new Error(
          `Price not found for token ${tokenAddress} on ${chain}`,
        );
      }

      const tokenPrice: TokenPrice = {
        tokenAddress: tokenAddress.toLowerCase(),
        symbol: '', // Will be filled by metadata if needed
        priceUsd: priceData.usd,
        change24h: priceData.usd_24h_change,
        lastUpdated: new Date(
          priceData.last_updated_at
            ? priceData.last_updated_at * 1000
            : Date.now(),
        ),
        source: 'coingecko',
        isStale: false,
      };

      await this.cacheService.set(cacheKey, tokenPrice, this.PRICE_CACHE_TTL);

      return tokenPrice;
    } catch (error) {
      this.logger.error(
        `Failed to get token price for ${tokenAddress} on ${chain}:`,
        error,
      );

      const staleCached = await this.cacheService.get<TokenPrice>(cacheKey);
      if (staleCached) {
        this.logger.warn(`Returning stale price data for ${tokenAddress}`);
        return { ...staleCached, isStale: true };
      }

      throw new Error(`Failed to fetch token price from CoinGecko`);
    }
  }

  async getMultipleTokenPrices(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenPrice[]> {
    try {
      const platform = this.platformMappings.get(chain);
      if (!platform) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const addresses = tokenAddresses
        .map((addr) => addr.toLowerCase())
        .join(',');

      const response = await this.httpClient.get<CoinGeckoPrice>(
        '/simple/token_price',
        {
          params: {
            id: platform,
            contract_addresses: addresses,
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_last_updated_at: true,
          },
        },
      );

      const prices: TokenPrice[] = [];

      for (const address of tokenAddresses) {
        const lowerAddress = address.toLowerCase();
        const priceData = response.data[lowerAddress];

        if (priceData) {
          const tokenPrice: TokenPrice = {
            tokenAddress: lowerAddress,
            symbol: '',
            priceUsd: priceData.usd,
            change24h: priceData.usd_24h_change,
            lastUpdated: new Date(
              priceData.last_updated_at
                ? priceData.last_updated_at * 1000
                : Date.now(),
            ),
            source: 'coingecko',
            isStale: false,
          };

          prices.push(tokenPrice);

          // Cache individual results
          const cacheKey = `${this.CACHE_NAMESPACE}:price:${chain}:${lowerAddress}`;
          await this.cacheService.set(
            cacheKey,
            tokenPrice,
            this.PRICE_CACHE_TTL,
          );
        }
      }

      return prices;
    } catch (error) {
      this.logger.error(`Failed to get multiple token prices:`, error);
      throw new Error(`Failed to fetch multiple token prices from CoinGecko`);
    }
  }

  async getTokenPriceByCoinGeckoId(coinGeckoId: string): Promise<TokenPrice> {
    try {
      const response = await this.httpClient.get<CoinGeckoPrice>(
        '/simple/price',
        {
          params: {
            ids: coinGeckoId,
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_last_updated_at: true,
          },
        },
      );

      const priceData = response.data[coinGeckoId];
      if (!priceData) {
        throw new Error(`Price not found for CoinGecko ID: ${coinGeckoId}`);
      }

      return {
        tokenAddress: '', // Not applicable for CoinGecko ID
        symbol: coinGeckoId,
        priceUsd: priceData.usd,
        change24h: priceData.usd_24h_change,
        lastUpdated: new Date(
          priceData.last_updated_at
            ? priceData.last_updated_at * 1000
            : Date.now(),
        ),
        source: 'coingecko',
        isStale: false,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get token price by CoinGecko ID ${coinGeckoId}:`,
        error,
      );
      throw new Error(`Failed to fetch token price by CoinGecko ID`);
    }
  }

  async getMultipleTokenPricesByCoinGeckoIds(
    coinGeckoIds: string[],
  ): Promise<TokenPrice[]> {
    try {
      const ids = coinGeckoIds.join(',');

      const response = await this.httpClient.get<CoinGeckoPrice>(
        '/simple/price',
        {
          params: {
            ids,
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_last_updated_at: true,
          },
        },
      );

      return coinGeckoIds.map((id) => {
        const priceData = response.data[id];
        if (!priceData) {
          throw new Error(`Price not found for CoinGecko ID: ${id}`);
        }

        return {
          tokenAddress: '',
          symbol: id,
          priceUsd: priceData.usd,
          change24h: priceData.usd_24h_change,
          lastUpdated: new Date(
            priceData.last_updated_at
              ? priceData.last_updated_at * 1000
              : Date.now(),
          ),
          source: 'coingecko',
          isStale: false,
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to get multiple token prices by CoinGecko IDs:`,
        error,
      );
      throw new Error(`Failed to fetch multiple token prices by CoinGecko IDs`);
    }
  }

  async getTokenPriceHistory(
    tokenAddress: string,
    chain: ChainType,
    fromTimestamp: number,
    toTimestamp: number,
    granularity: 'hourly' | 'daily' = 'daily',
  ): Promise<{ timestamp: number; price: number }[]> {
    try {
      const coinGeckoId = await this.getCoinGeckoIdByTokenAddress(
        tokenAddress,
        chain,
      );
      if (!coinGeckoId) {
        throw new Error(`CoinGecko ID not found for token ${tokenAddress}`);
      }

      return this.getTokenPriceHistoryByCoinGeckoId(
        coinGeckoId,
        fromTimestamp,
        toTimestamp,
        granularity,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get token price history for ${tokenAddress}:`,
        error,
      );
      throw new Error(`Failed to fetch token price history`);
    }
  }

  async getTokenPriceHistoryByCoinGeckoId(
    coinGeckoId: string,
    fromTimestamp: number,
    toTimestamp: number,
    granularity: 'hourly' | 'daily' = 'daily',
  ): Promise<{ timestamp: number; price: number }[]> {
    try {
      const endpoint =
        granularity === 'hourly'
          ? '/coins/{id}/market_chart/range'
          : '/coins/{id}/market_chart/range';

      const response = await this.httpClient.get(
        endpoint.replace('{id}', coinGeckoId),
        {
          params: {
            vs_currency: 'usd',
            from: Math.floor(fromTimestamp / 1000),
            to: Math.floor(toTimestamp / 1000),
          },
        },
      );

      if (!response.data.prices) {
        throw new Error('No price history data returned');
      }

      return response.data.prices.map(
        ([timestamp, price]: [number, number]) => ({
          timestamp: timestamp,
          price,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to get token price history for ${coinGeckoId}:`,
        error,
      );
      throw new Error(`Failed to fetch token price history`);
    }
  }

  async getTokenMetadata(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenMetadata | null> {
    const cacheKey = `${this.CACHE_NAMESPACE}:metadata:${chain}:${tokenAddress.toLowerCase()}`;

    const cached = await this.cacheService.get<TokenMetadata>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const platform = this.platformMappings.get(chain);
      if (!platform) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await this.httpClient.get<CoinGeckoTokenData>(
        `/coins/${platform}/contract/${tokenAddress.toLowerCase()}`,
      );

      const tokenData = response.data;
      const metadata: TokenMetadata = {
        address: tokenAddress.toLowerCase(),
        symbol: tokenData.symbol.toUpperCase(),
        name: tokenData.name,
        decimals: 18, // Default, should be fetched from blockchain
        isLP: false, // Will be determined by blockchain service
        coingeckoId: tokenData.id,
      };

      await this.cacheService.set(cacheKey, metadata, this.METADATA_CACHE_TTL);

      return metadata;
    } catch (error) {
      this.logger.error(
        `Failed to get token metadata for ${tokenAddress}:`,
        error,
      );
      return null;
    }
  }

  async getMultipleTokensMetadata(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenMetadata[]> {
    const metadataPromises = tokenAddresses.map((address) =>
      this.getTokenMetadata(address, chain),
    );

    const results = await Promise.allSettled(metadataPromises);

    return results
      .filter(
        (result): result is PromiseFulfilledResult<TokenMetadata> =>
          result.status === 'fulfilled' && result.value !== null,
      )
      .map((result) => result.value);
  }

  // Placeholder implementations for other methods
  async searchToken(
    query: string,
    chain?: ChainType,
  ): Promise<
    {
      id: string;
      symbol: string;
      name: string;
      address?: string;
      iconUrl?: string;
      chain?: string;
    }[]
  > {
    throw new Error('Method not implemented yet');
  }

  async getSupportedPlatforms(): Promise<
    { id: string; name: string; chainId?: number }[]
  > {
    throw new Error('Method not implemented yet');
  }

  async getTokenAddressByCoinGeckoId(
    coinGeckoId: string,
    platform: string,
  ): Promise<string | null> {
    throw new Error('Method not implemented yet');
  }

  async getCoinGeckoIdByTokenAddress(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<string | null> {
    const metadata = await this.getTokenMetadata(tokenAddress, chain);
    return metadata?.coingeckoId || null;
  }

  async getTokenMarketData(
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
  } | null> {
    throw new Error('Method not implemented yet');
  }

  async getTrendingTokens(): Promise<
    {
      id: string;
      symbol: string;
      name: string;
      priceUsd: number;
      priceChangePercentage24h: number;
      marketCapRank: number;
    }[]
  > {
    throw new Error('Method not implemented yet');
  }

  async getSimplePrice(
    tokenAddress: string,
    chain: ChainType,
    includePriceChange?: boolean,
  ): Promise<{
    price: number;
    priceChange24h?: number;
    priceChangePercentage24h?: number;
    lastUpdated: Date;
  }> {
    const tokenPrice = await this.getTokenPrice(tokenAddress, chain);

    return {
      price: tokenPrice.priceUsd,
      priceChange24h: includePriceChange ? tokenPrice.change24h : undefined,
      priceChangePercentage24h: includePriceChange
        ? tokenPrice.change24h
        : undefined,
      lastUpdated: tokenPrice.lastUpdated,
    };
  }

  async getMultipleSimplePrices(
    tokenAddresses: string[],
    chain: ChainType,
    includePriceChange?: boolean,
  ): Promise<
    Map<
      string,
      {
        price: number;
        priceChange24h?: number;
        priceChangePercentage24h?: number;
        lastUpdated: Date;
      }
    >
  > {
    const prices = await this.getMultipleTokenPrices(tokenAddresses, chain);
    const priceMap = new Map();

    prices.forEach((tokenPrice) => {
      priceMap.set(tokenPrice.tokenAddress, {
        price: tokenPrice.priceUsd,
        priceChange24h: includePriceChange ? tokenPrice.change24h : undefined,
        priceChangePercentage24h: includePriceChange
          ? tokenPrice.change24h
          : undefined,
        lastUpdated: tokenPrice.lastUpdated,
      });
    });

    return priceMap;
  }

  async validateToken(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<boolean> {
    try {
      const metadata = await this.getTokenMetadata(tokenAddress, chain);
      return metadata !== null;
    } catch {
      return false;
    }
  }

  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    resetTime: Date;
  }> {
    // CoinGecko doesn't provide rate limit info in response headers for public API
    // This would need to be tracked internally
    throw new Error('Method not implemented yet');
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    latency: number;
    rateLimitRemaining: number;
    lastSuccessfulCall: Date;
  }> {
    const startTime = Date.now();

    try {
      await this.httpClient.get('/ping');
      const latency = Date.now() - startTime;

      return {
        isHealthy: true,
        latency,
        rateLimitRemaining: -1, // Not available from CoinGecko
        lastSuccessfulCall: new Date(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error('CoinGecko health check failed:', error);

      return {
        isHealthy: false,
        latency,
        rateLimitRemaining: -1,
        lastSuccessfulCall: new Date(0),
      };
    }
  }

  // Additional placeholder methods
  async getDeFiProtocolData(protocolId: string): Promise<{
    name: string;
    tvl: number;
    tokenAddress?: string;
    chain?: string;
  } | null> {
    throw new Error('Method not implemented yet');
  }

  async getTokenIcon(
    tokenAddress: string,
    chain: ChainType,
    size?: 'small' | 'large',
  ): Promise<string | null> {
    const metadata = await this.getTokenMetadata(tokenAddress, chain);
    // Icon URL would be extracted from metadata if available
    return null;
  }

  async getMultipleTokenIcons(
    tokenAddresses: string[],
    chain: ChainType,
    size?: 'small' | 'large',
  ): Promise<Map<string, string>> {
    throw new Error('Method not implemented yet');
  }

  async refreshTokenData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<void> {
    const priceKey = `${this.CACHE_NAMESPACE}:price:${chain}:${tokenAddress.toLowerCase()}`;
    const metadataKey = `${this.CACHE_NAMESPACE}:metadata:${chain}:${tokenAddress.toLowerCase()}`;

    await Promise.all([
      this.cacheService.del(priceKey),
      this.cacheService.del(metadataKey),
    ]);
  }

  async clearCache(): Promise<void> {
    // Note: Current cache implementation doesn't support namespace clearing
    // Would need to track all keys or implement pattern-based deletion
    await this.cacheService.flushAll();
  }

  async getCacheStats(): Promise<{
    totalCachedTokens: number;
    cacheHitRate: number;
    averageCacheAge: number;
    oldestCacheEntry: Date;
    newestCacheEntry: Date;
  }> {
    // Note: Current cache implementation doesn't support key pattern search
    // This would need to be implemented or tracked separately
    const keys: string[] = [];
    const priceKeys = keys.filter((key) => key.includes(':price:'));

    return {
      totalCachedTokens: priceKeys.length,
      cacheHitRate: 0,
      averageCacheAge: 0,
      oldestCacheEntry: new Date(),
      newestCacheEntry: new Date(),
    };
  }
}
