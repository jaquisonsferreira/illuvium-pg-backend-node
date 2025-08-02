import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES } from '../../constants';
import { CoinGeckoService } from '../services/coingecko.service';
import { CacheService } from '@shared/services/cache.service';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';

export interface PriceUpdateJobData {
  tokens: string[];
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
  source?: 'scheduled' | 'manual' | 'event';
}

export interface BatchPriceUpdateJobData extends PriceUpdateJobData {
  batchSize?: number;
  updateFrequency?: 'minute' | 'hourly' | 'daily';
}

@Processor(SHARD_QUEUES.PRICE_UPDATE)
@Injectable()
export class PriceUpdateProcessorJob {
  private readonly logger = new Logger(PriceUpdateProcessorJob.name);
  private readonly defaultTokens = ['ILV', 'ETH', 'USDC', 'USDT', 'DAI'];

  constructor(
    private readonly coinGeckoService: CoinGeckoService,
    private readonly cacheService: CacheService,
  ) {}

  @Process()
  async process(job: Job<PriceUpdateJobData>): Promise<void> {
    const {
      tokens = this.defaultTokens,
      priority = 'normal',
      source = 'scheduled',
    } = job.data;

    this.logger.log(
      `Processing price update job ${job.id} for ${tokens.length} tokens (priority: ${priority}, source: ${source})`,
    );

    try {
      await job.progress(10);

      const prices = await this.coinGeckoService.getMultipleTokenPrices(tokens);

      await job.progress(50);

      await this.updatePriceCache(prices);

      await job.progress(80);

      await this.recordPriceHistory(prices);

      await job.progress(100);

      this.logger.log(`Successfully updated prices for ${prices.size} tokens`);
    } catch (error) {
      this.logger.error(
        `Failed to process price update job ${job.id}:`,
        error instanceof Error ? error.stack : error,
      );

      const retryCount = job.data.retryCount || 0;
      if (retryCount < 3) {
        throw new Error(
          `Price update failed, retry ${retryCount + 1}/3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      await this.handleFailedUpdate(tokens, error);
    }
  }

  @Process('update-single-token')
  async updateSingleToken(
    job: Job<{ token: string; priority?: string }>,
  ): Promise<void> {
    const { token, priority = 'normal' } = job.data;

    this.logger.debug(
      `Updating single token price: ${token} (priority: ${priority})`,
    );

    try {
      const price = await this.coinGeckoService.getTokenPrice(token);

      await this.updatePriceCache(new Map([[token, price]]));

      await this.recordPriceHistory(new Map([[token, price]]));

      this.logger.log(`Successfully updated price for ${token}: $${price}`);
    } catch (error) {
      this.logger.error(
        `Failed to update price for ${token}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @Process('batch-price-update')
  async batchPriceUpdate(job: Job<BatchPriceUpdateJobData>): Promise<void> {
    const {
      tokens = this.defaultTokens,
      batchSize = 10,
      updateFrequency = 'hourly',
    } = job.data;

    this.logger.log(
      `Processing batch price update: ${tokens.length} tokens in batches of ${batchSize}`,
    );

    try {
      const batches = this.createBatches(tokens, batchSize);
      let processedTokens = 0;

      for (const [index, batch] of batches.entries()) {
        const progress = Math.round((index / batches.length) * 100);
        await job.progress(progress);

        const prices =
          await this.coinGeckoService.getMultipleTokenPrices(batch);

        await this.updatePriceCache(prices);

        await this.recordPriceHistory(prices);

        processedTokens += batch.length;

        this.logger.debug(
          `Processed batch ${index + 1}/${batches.length}: ${batch.length} tokens`,
        );

        if (index < batches.length - 1) {
          await this.delay(1000);
        }
      }

      await job.progress(100);

      this.logger.log(
        `Batch update completed: ${processedTokens} tokens processed`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to process batch price update:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @Process('historical-price-update')
  async updateHistoricalPrices(
    job: Job<{ token: string; dates: string[] }>,
  ): Promise<void> {
    const { token, dates } = job.data;

    this.logger.log(
      `Updating historical prices for ${token}: ${dates.length} dates`,
    );

    try {
      const historicalPrices = new Map<string, number>();

      for (const [index, dateStr] of dates.entries()) {
        const progress = Math.round((index / dates.length) * 100);
        await job.progress(progress);

        const date = new Date(dateStr);
        const price = await this.coinGeckoService.getHistoricalPrice(
          token,
          date,
        );

        historicalPrices.set(dateStr, price);

        await this.delay(500);
      }

      await this.storeHistoricalPrices(token, historicalPrices);

      await job.progress(100);

      this.logger.log(
        `Successfully updated ${historicalPrices.size} historical prices for ${token}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update historical prices for ${token}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async updatePriceCache(prices: Map<string, number>): Promise<void> {
    const cacheKey = SHARD_CACHE_KEYS.PRICES;
    const existingPrices =
      (await this.cacheService.get<Record<string, number>>(cacheKey)) || {};

    const updatedPrices = { ...existingPrices };
    for (const [token, price] of prices.entries()) {
      updatedPrices[token] = price;
    }

    await this.cacheService.set(
      cacheKey,
      updatedPrices,
      SHARD_CACHE_TTL.PRICES,
    );

    for (const [token, price] of prices.entries()) {
      const individualKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:${token.toLowerCase()}`;
      await this.cacheService.set(
        individualKey,
        price,
        SHARD_CACHE_TTL.PRICE_DATA,
      );
    }
  }

  private async recordPriceHistory(prices: Map<string, number>): Promise<void> {
    const timestamp = new Date().toISOString();

    for (const [token, price] of prices.entries()) {
      const historyKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:history:${token.toLowerCase()}`;
      const history = (await this.cacheService.get<any[]>(historyKey)) || [];

      history.push({
        price,
        timestamp,
        source: 'coingecko',
      });

      if (history.length > 288) {
        history.shift();
      }

      await this.cacheService.set(
        historyKey,
        history,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );
    }
  }

  private async storeHistoricalPrices(
    token: string,
    prices: Map<string, number>,
  ): Promise<void> {
    const historyKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:historical:${token.toLowerCase()}`;
    const existingHistory =
      (await this.cacheService.get<Record<string, number>>(historyKey)) || {};

    const updatedHistory = { ...existingHistory };
    for (const [date, price] of prices.entries()) {
      updatedHistory[date] = price;
    }

    await this.cacheService.set(
      historyKey,
      updatedHistory,
      SHARD_CACHE_TTL.HISTORICAL_DATA,
    );
  }

  private async handleFailedUpdate(
    tokens: string[],
    error: unknown,
  ): Promise<void> {
    const fallbackKey = `${SHARD_CACHE_KEYS.PRICES}:fallback`;
    const fallbackPrices =
      await this.cacheService.get<Record<string, number>>(fallbackKey);

    if (fallbackPrices) {
      const availablePrices = new Map<string, number>();

      for (const token of tokens) {
        if (fallbackPrices[token]) {
          availablePrices.set(token, fallbackPrices[token]);
        }
      }

      if (availablePrices.size > 0) {
        await this.updatePriceCache(availablePrices);
        this.logger.warn(
          `Used fallback prices for ${availablePrices.size}/${tokens.length} tokens`,
        );
      }
    }

    await this.recordFailedUpdate(tokens, error);
  }

  private async recordFailedUpdate(
    tokens: string[],
    error: unknown,
  ): Promise<void> {
    const failureKey = `${SHARD_CACHE_KEYS.PRICES}:failures`;
    const failures = (await this.cacheService.get<any[]>(failureKey)) || [];

    failures.push({
      tokens,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    if (failures.length > 100) {
      failures.shift();
    }

    await this.cacheService.set(
      failureKey,
      failures,
      SHARD_CACHE_TTL.HISTORICAL_DATA,
    );
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
