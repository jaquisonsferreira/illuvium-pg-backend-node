import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@shared/services/http.service';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@shared/services/cache.service';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
}

interface CoinGeckoPriceResponse {
  [coinId: string]: CoinGeckoPrice;
}

@Injectable()
export class CoinGeckoService {
  private readonly logger = new Logger(CoinGeckoService.name);
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly apiKey?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.apiKey = this.configService.get<string>('COINGECKO_API_KEY');
  }

  async getTokenPrice(tokenSymbol: string): Promise<number> {
    const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:${tokenSymbol.toLowerCase()}`;

    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const coinId = this.mapSymbolToCoinId(tokenSymbol);
      const price = await this.fetchTokenPrice(coinId);

      await this.cacheService.set(cacheKey, price, SHARD_CACHE_TTL.PRICE_DATA);

      return price;
    } catch (error) {
      this.logger.error(
        `Failed to fetch price for ${tokenSymbol}`,
        error instanceof Error ? error.stack : error,
      );
      throw new Error(`Failed to fetch token price for ${tokenSymbol}`);
    }
  }

  async getMultipleTokenPrices(
    tokenSymbols: string[],
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const uncachedSymbols: string[] = [];

    for (const symbol of tokenSymbols) {
      const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:${symbol.toLowerCase()}`;
      const cached = await this.cacheService.get<number>(cacheKey);

      if (cached !== null) {
        prices.set(symbol, cached);
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    if (uncachedSymbols.length === 0) {
      return prices;
    }

    try {
      const coinIds = uncachedSymbols.map((symbol) =>
        this.mapSymbolToCoinId(symbol),
      );

      const freshPrices = await this.fetchMultipleTokenPrices(coinIds);

      for (let i = 0; i < uncachedSymbols.length; i++) {
        const symbol = uncachedSymbols[i];
        const coinId = coinIds[i];
        const price = freshPrices.get(coinId);

        if (price !== undefined) {
          prices.set(symbol, price);

          const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:${symbol.toLowerCase()}`;
          await this.cacheService.set(
            cacheKey,
            price,
            SHARD_CACHE_TTL.PRICE_DATA,
          );
        }
      }

      return prices;
    } catch (error) {
      this.logger.error(
        `Failed to fetch multiple token prices`,
        error instanceof Error ? error.stack : error,
      );
      throw new Error('Failed to fetch multiple token prices');
    }
  }

  async getHistoricalPrice(tokenSymbol: string, date: Date): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];
    const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:${tokenSymbol.toLowerCase()}:${dateStr}`;

    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const coinId = this.mapSymbolToCoinId(tokenSymbol);
      const price = await this.fetchHistoricalPrice(coinId, date);

      await this.cacheService.set(
        cacheKey,
        price,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );

      return price;
    } catch (error) {
      this.logger.error(
        `Failed to fetch historical price for ${tokenSymbol} on ${dateStr}`,
        error instanceof Error ? error.stack : error,
      );
      throw new Error(`Failed to fetch historical price for ${tokenSymbol}`);
    }
  }

  private async fetchTokenPrice(coinId: string): Promise<number> {
    const url = `${this.baseUrl}/simple/price`;
    const params: any = {
      ids: coinId,
      vs_currencies: 'usd',
    };

    if (this.apiKey) {
      params['x_cg_pro_api_key'] = this.apiKey;
    }

    const response = await firstValueFrom(
      this.httpService.get<CoinGeckoPriceResponse>(url, { params }),
    );

    const priceData = response.data[coinId];
    if (!priceData || priceData.usd === undefined) {
      throw new Error(`No price data found for ${coinId}`);
    }

    return priceData.usd;
  }

  private async fetchMultipleTokenPrices(
    coinIds: string[],
  ): Promise<Map<string, number>> {
    const url = `${this.baseUrl}/simple/price`;
    const params: any = {
      ids: coinIds.join(','),
      vs_currencies: 'usd',
    };

    if (this.apiKey) {
      params['x_cg_pro_api_key'] = this.apiKey;
    }

    const response = await firstValueFrom(
      this.httpService.get<CoinGeckoPriceResponse>(url, { params }),
    );

    const prices = new Map<string, number>();

    for (const coinId of coinIds) {
      const priceData = response.data[coinId];
      if (priceData && priceData.usd !== undefined) {
        prices.set(coinId, priceData.usd);
      }
    }

    return prices;
  }

  private async fetchHistoricalPrice(
    coinId: string,
    date: Date,
  ): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];
    const url = `${this.baseUrl}/coins/${coinId}/history`;
    const params: any = {
      date: dateStr.split('-').reverse().join('-'), // DD-MM-YYYY format
      localization: false,
    };

    if (this.apiKey) {
      params['x_cg_pro_api_key'] = this.apiKey;
    }

    const response = await firstValueFrom(
      this.httpService.get<any>(url, { params }),
    );

    const price = response.data?.market_data?.current_price?.usd;
    if (price === undefined) {
      throw new Error(
        `No historical price data found for ${coinId} on ${dateStr}`,
      );
    }

    return price;
  }

  private mapSymbolToCoinId(symbol: string): string {
    const symbolMap: Record<string, string> = {
      ETH: 'ethereum',
      USDC: 'usd-coin',
      USDT: 'tether',
      DAI: 'dai',
      WETH: 'weth',
      WBTC: 'wrapped-bitcoin',
      ILV: 'illuvium',
      IMX: 'immutable-x',
      MATIC: 'matic-network',
      ARB: 'arbitrum',
      OP: 'optimism',
    };

    const coinId = symbolMap[symbol.toUpperCase()];
    if (!coinId) {
      this.logger.warn(
        `No CoinGecko mapping found for symbol ${symbol}, using lowercase`,
      );
      return symbol.toLowerCase();
    }

    return coinId;
  }
}
