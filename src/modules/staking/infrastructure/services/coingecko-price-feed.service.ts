import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { TokenPrice, ChainType } from '../../domain/types/staking-types';
import {
  PriceFeedException,
  TokenNotSupportedException,
} from '../../domain/exceptions/price-feed.exception';
import { CacheService } from '../../../../shared/application/cache/cache.service';

interface CoinGeckoPrice {
  [key: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

/**
 * CoinGecko Price Feed Service
 *
 * Currently implements only the getTokenPrice method which is actively used.
 * Other methods from IPriceFeedRepository are placeholders for future expansion
 * when additional price feed functionality is needed.
 */
@Injectable()
export class CoinGeckoPriceFeedService implements IPriceFeedRepository {
  private readonly logger = new Logger(CoinGeckoPriceFeedService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly tokenIdMap: Map<string, string> = new Map([
    ['0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E', 'illuvium'],
    ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'ethereum'],
    ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'usd-coin'],
    ['0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'wrapped-bitcoin'],
    ['0xdAC17F958D2ee523a2206206994597C13D831ec7', 'tether'],
    ['0x6B175474E89094C44Da98b954EedeAC495271d0F', 'dai'],
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {
    this.apiKey = this.configService.get<string>('COINGECKO_API_KEY', '');
  }

  async getTokenPrice(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenPrice> {
    try {
      const cacheKey = `price:${tokenAddress.toLowerCase()}:${chain}`;
      const cachedPrice = await this.cacheService.get<TokenPrice>(
        cacheKey,
        'price-feed',
      );
      if (cachedPrice && !this.isPriceStale(cachedPrice.lastUpdated)) {
        return cachedPrice;
      }

      const coinGeckoId = this.getCoinGeckoId(tokenAddress);
      if (!coinGeckoId) {
        throw new TokenNotSupportedException(tokenAddress);
      }

      const url = `${this.baseUrl}/simple/price`;
      const params: any = {
        ids: coinGeckoId,
        vs_currencies: 'usd',
        include_24hr_change: true,
      };

      if (this.apiKey) {
        params['x_cg_pro_api_key'] = this.apiKey;
      }

      const response = await lastValueFrom(
        this.httpService
          .get<CoinGeckoPrice>(url, { params })
          .pipe(map((res) => res.data)),
      );

      const priceData = response[coinGeckoId];
      if (!priceData) {
        throw new Error(`No price data returned for ${coinGeckoId}`);
      }

      const tokenPrice: TokenPrice = {
        tokenAddress: tokenAddress.toLowerCase(),
        symbol: coinGeckoId.toUpperCase(),
        priceUsd: priceData.usd,
        change24h: priceData.usd_24h_change || 0,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      };

      await this.cacheService.set(cacheKey, tokenPrice, 300, 'price-feed');

      return tokenPrice;
    } catch (error) {
      if (error instanceof TokenNotSupportedException) {
        throw error;
      }
      throw new PriceFeedException(
        `Failed to fetch price for ${tokenAddress}`,
        error,
      );
    }
  }

  async getMultipleTokenPrices(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenPrice[]> {
    try {
      const tokensByGeckoId = new Map<string, string[]>();

      for (const address of tokenAddresses) {
        const geckoId = this.getCoinGeckoId(address);
        if (geckoId) {
          const existing = tokensByGeckoId.get(geckoId) || [];
          existing.push(address);
          tokensByGeckoId.set(geckoId, existing);
        }
      }

      if (tokensByGeckoId.size === 0) {
        throw new PriceFeedException(
          'No supported tokens found in the provided addresses',
        );
      }

      const geckoIds = Array.from(tokensByGeckoId.keys()).join(',');
      const url = `${this.baseUrl}/simple/price`;
      const params: any = {
        ids: geckoIds,
        vs_currencies: 'usd',
        include_24hr_change: true,
      };

      if (this.apiKey) {
        params['x_cg_pro_api_key'] = this.apiKey;
      }

      const response = await lastValueFrom(
        this.httpService
          .get<CoinGeckoPrice>(url, { params })
          .pipe(map((res) => res.data)),
      );

      const prices: TokenPrice[] = [];

      for (const [geckoId, addressList] of tokensByGeckoId.entries()) {
        const priceData = response[geckoId];
        if (priceData) {
          for (const address of addressList) {
            const tokenPrice: TokenPrice = {
              tokenAddress: address.toLowerCase(),
              symbol: geckoId.toUpperCase(),
              priceUsd: priceData.usd,
              change24h: priceData.usd_24h_change || 0,
              lastUpdated: new Date(),
              source: 'coingecko',
              isStale: false,
            };

            prices.push(tokenPrice);

            const cacheKey = `price:${address.toLowerCase()}:${chain}`;
            await this.cacheService.set(
              cacheKey,
              tokenPrice,
              300,
              'price-feed',
            );
          }
        } else {
          this.logger.warn(`No price data found for CoinGecko ID: ${geckoId}`);
        }
      }

      const missingTokens = tokenAddresses.filter(
        (address) =>
          !prices.some((p) => p.tokenAddress === address.toLowerCase()),
      );

      if (missingTokens.length > 0) {
        this.logger.warn(
          `No price data found for tokens: ${missingTokens.join(', ')}`,
        );
      }

      return prices;
    } catch (error) {
      if (error instanceof PriceFeedException) {
        throw error;
      }
      throw new PriceFeedException(
        'Failed to fetch multiple prices from CoinGecko',
        error,
      );
    }
  }

  async getHistoricalPrice(
    tokenAddress: string,
    timestamp: Date,
    chain: ChainType,
  ): Promise<TokenPrice> {
    try {
      const coinGeckoId = this.getCoinGeckoId(tokenAddress);
      if (!coinGeckoId) {
        throw new TokenNotSupportedException(tokenAddress);
      }

      const date = `${timestamp.getDate().toString().padStart(2, '0')}-${(timestamp.getMonth() + 1).toString().padStart(2, '0')}-${timestamp.getFullYear()}`;

      const url = `${this.baseUrl}/coins/${coinGeckoId}/history`;
      const params: any = {
        date,
        localization: false,
      };

      if (this.apiKey) {
        params['x_cg_pro_api_key'] = this.apiKey;
      }

      const response = await lastValueFrom(
        this.httpService.get<any>(url, { params }).pipe(map((res) => res.data)),
      );

      const priceUsd = response.market_data?.current_price?.usd || 0;

      return {
        tokenAddress: tokenAddress.toLowerCase(),
        symbol: coinGeckoId.toUpperCase(),
        priceUsd,
        change24h: 0,
        lastUpdated: timestamp,
        source: 'coingecko',
        isStale: false,
      };
    } catch (error) {
      if (error instanceof TokenNotSupportedException) {
        throw error;
      }
      throw new PriceFeedException(
        `Failed to fetch historical price for ${tokenAddress}`,
        error,
      );
    }
  }

  private getCoinGeckoId(tokenAddress: string): string | null {
    const idByAddress = this.tokenIdMap.get(tokenAddress);
    return idByAddress || null;
  }

  private isPriceStale(lastUpdated: Date): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastUpdated < fiveMinutesAgo;
  }

  async getTokenPriceByCoinGeckoId(coinGeckoId: string): Promise<TokenPrice> {
    throw new PriceFeedException('Method not implemented');
  }

  async getMultipleTokenPricesByCoinGeckoIds(
    coinGeckoIds: string[],
  ): Promise<TokenPrice[]> {
    throw new PriceFeedException('Method not implemented');
  }

  async getTokenPriceHistory(
    tokenAddress: string,
    chain: ChainType,
    fromTimestamp: number,
    toTimestamp: number,
    granularity?: 'hourly' | 'daily',
  ): Promise<{ timestamp: number; price: number }[]> {
    return [];
  }

  async getTokenPriceHistoryByCoinGeckoId(
    coinGeckoId: string,
    fromTimestamp: number,
    toTimestamp: number,
    granularity?: 'hourly' | 'daily',
  ): Promise<{ timestamp: number; price: number }[]> {
    return [];
  }

  async getTokenMetadata(tokenAddress: string, chain: ChainType): Promise<any> {
    return null;
  }

  async getMultipleTokensMetadata(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<any[]> {
    return [];
  }

  async searchToken(query: string, chain?: ChainType): Promise<any[]> {
    return [];
  }

  async getSupportedPlatforms(): Promise<any[]> {
    return [];
  }

  async getTokenAddressByCoinGeckoId(
    coinGeckoId: string,
    platform: string,
  ): Promise<string | null> {
    return null;
  }

  async getCoinGeckoIdByTokenAddress(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<string | null> {
    return this.getCoinGeckoId(tokenAddress);
  }

  async getTokenMarketData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<any> {
    return null;
  }

  async getTrendingTokens(): Promise<any[]> {
    return [];
  }

  async getSimplePrice(
    tokenAddress: string,
    chain: ChainType,
    includePriceChange?: boolean,
  ): Promise<any> {
    const price = await this.getTokenPrice(tokenAddress, chain);
    return {
      price: price.priceUsd,
      priceChange24h: price.change24h,
      priceChangePercentage24h: price.change24h,
      lastUpdated: price.lastUpdated,
    };
  }

  async getMultipleSimplePrices(
    tokenAddresses: string[],
    chain: ChainType,
    includePriceChange?: boolean,
  ): Promise<Map<string, any>> {
    const prices = await this.getMultipleTokenPrices(tokenAddresses, chain);
    const priceMap = new Map();

    for (const price of prices) {
      priceMap.set(price.tokenAddress, {
        price: price.priceUsd,
        priceChange24h: price.change24h,
        priceChangePercentage24h: price.change24h,
        lastUpdated: price.lastUpdated,
      });
    }

    return priceMap;
  }

  async validateToken(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<boolean> {
    return this.getCoinGeckoId(tokenAddress) !== null;
  }

  async getRateLimitStatus(): Promise<any> {
    return {
      remaining: 100,
      limit: 100,
      resetTime: new Date(Date.now() + 3600000),
    };
  }

  async healthCheck(): Promise<any> {
    return {
      isHealthy: true,
      latency: 50,
      rateLimitRemaining: 100,
      lastSuccessfulCall: new Date(),
    };
  }

  async getDeFiProtocolData(protocolId: string): Promise<any> {
    return null;
  }

  async getTokenIcon(
    tokenAddress: string,
    chain: ChainType,
    size?: 'small' | 'large',
  ): Promise<string | null> {
    return null;
  }

  async getMultipleTokenIcons(
    tokenAddresses: string[],
    chain: ChainType,
    size?: 'small' | 'large',
  ): Promise<Map<string, string>> {
    return new Map();
  }

  async refreshTokenData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<void> {
    const cacheKey = `price:${tokenAddress.toLowerCase()}:${chain}`;
    await this.cacheService.delete(cacheKey, 'price-feed');
  }

  async clearCache(): Promise<void> {
    await this.cacheService.clearNamespace('price-feed');
  }

  async getCacheStats(): Promise<any> {
    return {
      totalCachedTokens: 0,
      cacheHitRate: 0,
      averageCacheAge: 0,
      oldestCacheEntry: new Date(),
      newestCacheEntry: new Date(),
    };
  }
}
