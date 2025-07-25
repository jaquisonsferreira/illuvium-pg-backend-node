import { Injectable, Logger, Inject } from '@nestjs/common';
import { IPriceHistoryRepository } from '../../domain/repositories/price-history.repository.interface';
import { ITokenMetadataRepository } from '../../domain/repositories/token-metadata.repository.interface';
import { PriceHistoryEntity } from '../../domain/entities/price-history.entity';
import { CoinGeckoService } from '../../infrastructure/services/coingecko.service';

interface GetTokenPriceDto {
  tokenAddress: string;
  chain: string;
  date?: Date;
  useCache?: boolean;
  maxCacheAgeMinutes?: number;
}

interface GetHistoricalPricesDto {
  tokenAddress: string;
  chain: string;
  startDate: Date;
  endDate: Date;
  granularity?: 'minute' | 'hour' | 'day';
  fillMissingData?: boolean;
}

interface TokenPriceResult {
  tokenAddress: string;
  chain: string;
  symbol: string;
  priceUsd: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  timestamp: Date;
  source: string;
  isCached: boolean;
  cacheAgeMinutes?: number;
}

interface HistoricalPriceResult {
  tokenAddress: string;
  chain: string;
  symbol: string;
  prices: Array<{
    timestamp: Date;
    priceUsd: number;
    priceChange24h?: number;
    marketCap?: number;
    volume24h?: number;
  }>;
  averagePrice: number;
  highPrice: number;
  lowPrice: number;
  priceChange: number;
  granularity: string;
}

@Injectable()
export class GetTokenPriceUseCase {
  private readonly logger = new Logger(GetTokenPriceUseCase.name);

  constructor(
    @Inject('IPriceHistoryRepository')
    private readonly priceHistoryRepository: IPriceHistoryRepository,
    @Inject('ITokenMetadataRepository')
    private readonly tokenMetadataRepository: ITokenMetadataRepository,
    private readonly coinGeckoService: CoinGeckoService,
  ) {}

  async execute(dto: GetTokenPriceDto): Promise<TokenPriceResult> {
    const {
      tokenAddress,
      chain,
      date,
      useCache = true,
      maxCacheAgeMinutes = 5,
    } = dto;

    const tokenMetadata = await this.tokenMetadataRepository.findByAddress(
      tokenAddress,
      chain,
    );

    if (!tokenMetadata) {
      throw new Error(
        `Token metadata not found for ${tokenAddress} on ${chain}`,
      );
    }

    try {
      if (date) {
        return await this.getHistoricalPrice(
          tokenAddress,
          chain,
          tokenMetadata.symbol,
          date,
        );
      }

      if (useCache) {
        const cachedPrice = await this.priceHistoryRepository.findLatestByToken(
          tokenAddress,
          chain,
        );

        if (cachedPrice && !cachedPrice.isPriceStale(maxCacheAgeMinutes)) {
          return {
            tokenAddress,
            chain,
            symbol: tokenMetadata.symbol,
            priceUsd: cachedPrice.priceUsd,
            priceChange24h: cachedPrice.priceChange24h ?? undefined,
            marketCap: cachedPrice.marketCap ?? undefined,
            volume24h: cachedPrice.volume24h ?? undefined,
            timestamp: cachedPrice.timestamp,
            source: cachedPrice.source,
            isCached: true,
            cacheAgeMinutes: cachedPrice.getAgeInMinutes(),
          };
        }
      }

      const freshPrice = await this.coinGeckoService.getTokenPrice(
        tokenMetadata.symbol,
      );

      const priceEntity = PriceHistoryEntity.create({
        tokenAddress,
        chain,
        priceUsd: freshPrice,
        timestamp: new Date(),
        source: 'coingecko',
        granularity: 'minute',
      });

      await this.priceHistoryRepository.upsert(priceEntity);

      return {
        tokenAddress,
        chain,
        symbol: tokenMetadata.symbol,
        priceUsd: freshPrice,
        timestamp: new Date(),
        source: 'coingecko',
        isCached: false,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get price for ${tokenAddress} on ${chain}:`,
        error instanceof Error ? error.stack : error,
      );
      throw new Error(
        `Failed to get token price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getHistoricalPrices(
    dto: GetHistoricalPricesDto,
  ): Promise<HistoricalPriceResult> {
    const {
      tokenAddress,
      chain,
      startDate,
      endDate,
      granularity = 'day',
      fillMissingData = false,
    } = dto;

    const tokenMetadata = await this.tokenMetadataRepository.findByAddress(
      tokenAddress,
      chain,
    );

    if (!tokenMetadata) {
      throw new Error(
        `Token metadata not found for ${tokenAddress} on ${chain}`,
      );
    }

    try {
      let prices = await this.priceHistoryRepository.findByTokenAndTimeRange(
        tokenAddress,
        chain,
        startDate,
        endDate,
        granularity,
      );

      if (fillMissingData && prices.length === 0) {
        await this.fillHistoricalData(
          tokenAddress,
          chain,
          tokenMetadata.symbol,
          startDate,
          endDate,
          granularity,
        );

        prices = await this.priceHistoryRepository.findByTokenAndTimeRange(
          tokenAddress,
          chain,
          startDate,
          endDate,
          granularity,
        );
      }

      if (prices.length === 0) {
        throw new Error('No price data available for the specified time range');
      }

      const priceValues = prices.map((p) => p.priceUsd);
      const averagePrice =
        priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
      const highPrice = Math.max(...priceValues);
      const lowPrice = Math.min(...priceValues);
      const priceChange =
        prices.length > 1
          ? ((prices[prices.length - 1].priceUsd - prices[0].priceUsd) /
              prices[0].priceUsd) *
            100
          : 0;

      return {
        tokenAddress,
        chain,
        symbol: tokenMetadata.symbol,
        prices: prices.map((p) => ({
          timestamp: p.timestamp,
          priceUsd: p.priceUsd,
          priceChange24h: p.priceChange24h ?? undefined,
          marketCap: p.marketCap ?? undefined,
          volume24h: p.volume24h ?? undefined,
        })),
        averagePrice,
        highPrice,
        lowPrice,
        priceChange,
        granularity,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get historical prices for ${tokenAddress} on ${chain}:`,
        error instanceof Error ? error.stack : error,
      );
      throw new Error(
        `Failed to get historical prices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getMultipleTokenPrices(
    tokens: Array<{ address: string; chain: string }>,
    useCache: boolean = true,
    maxCacheAgeMinutes: number = 5,
  ): Promise<TokenPriceResult[]> {
    const results: TokenPriceResult[] = [];
    const tokensNeedingFreshData: Array<{
      address: string;
      chain: string;
      symbol: string;
    }> = [];

    for (const token of tokens) {
      try {
        const tokenMetadata = await this.tokenMetadataRepository.findByAddress(
          token.address,
          token.chain,
        );

        if (!tokenMetadata) {
          this.logger.warn(
            `Token metadata not found for ${token.address} on ${token.chain}`,
          );
          continue;
        }

        if (useCache) {
          const cachedPrice =
            await this.priceHistoryRepository.findLatestByToken(
              token.address,
              token.chain,
            );

          if (cachedPrice && !cachedPrice.isPriceStale(maxCacheAgeMinutes)) {
            results.push({
              tokenAddress: token.address,
              chain: token.chain,
              symbol: tokenMetadata.symbol,
              priceUsd: cachedPrice.priceUsd,
              priceChange24h: cachedPrice.priceChange24h ?? undefined,
              marketCap: cachedPrice.marketCap ?? undefined,
              volume24h: cachedPrice.volume24h ?? undefined,
              timestamp: cachedPrice.timestamp,
              source: cachedPrice.source,
              isCached: true,
              cacheAgeMinutes: cachedPrice.getAgeInMinutes(),
            });
            continue;
          }
        }

        tokensNeedingFreshData.push({
          address: token.address,
          chain: token.chain,
          symbol: tokenMetadata.symbol,
        });
      } catch (error) {
        this.logger.error(
          `Failed to process token ${token.address} on ${token.chain}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (tokensNeedingFreshData.length > 0) {
      const symbols = [...new Set(tokensNeedingFreshData.map((t) => t.symbol))];
      const freshPrices =
        await this.coinGeckoService.getMultipleTokenPrices(symbols);

      const priceEntities: PriceHistoryEntity[] = [];

      for (const token of tokensNeedingFreshData) {
        const price = freshPrices.get(token.symbol);
        if (price) {
          const priceEntity = PriceHistoryEntity.create({
            tokenAddress: token.address,
            chain: token.chain,
            priceUsd: price,
            timestamp: new Date(),
            source: 'coingecko',
            granularity: 'minute',
          });

          priceEntities.push(priceEntity);

          results.push({
            tokenAddress: token.address,
            chain: token.chain,
            symbol: token.symbol,
            priceUsd: price,
            timestamp: new Date(),
            source: 'coingecko',
            isCached: false,
          });
        }
      }

      if (priceEntities.length > 0) {
        await this.priceHistoryRepository.createBatch(priceEntities);
      }
    }

    return results;
  }

  private async getHistoricalPrice(
    tokenAddress: string,
    chain: string,
    symbol: string,
    date: Date,
  ): Promise<TokenPriceResult> {
    const existingPrice = await this.priceHistoryRepository.findByTokenAndDate(
      tokenAddress,
      chain,
      date,
      'day',
    );

    if (existingPrice) {
      return {
        tokenAddress,
        chain,
        symbol,
        priceUsd: existingPrice.priceUsd,
        priceChange24h: existingPrice.priceChange24h ?? undefined,
        marketCap: existingPrice.marketCap ?? undefined,
        volume24h: existingPrice.volume24h ?? undefined,
        timestamp: existingPrice.timestamp,
        source: existingPrice.source,
        isCached: true,
        cacheAgeMinutes: existingPrice.getAgeInMinutes(),
      };
    }

    const historicalPrice = await this.coinGeckoService.getHistoricalPrice(
      symbol,
      date,
    );

    const priceEntity = PriceHistoryEntity.create({
      tokenAddress,
      chain,
      priceUsd: historicalPrice,
      timestamp: date,
      source: 'coingecko',
      granularity: 'day',
    });

    await this.priceHistoryRepository.create(priceEntity);

    return {
      tokenAddress,
      chain,
      symbol,
      priceUsd: historicalPrice,
      timestamp: date,
      source: 'coingecko',
      isCached: false,
    };
  }

  private async fillHistoricalData(
    tokenAddress: string,
    chain: string,
    symbol: string,
    startDate: Date,
    endDate: Date,
    granularity: string,
  ): Promise<void> {
    const currentDate = new Date(startDate);
    const priceEntities: PriceHistoryEntity[] = [];

    while (currentDate <= endDate) {
      try {
        const price = await this.coinGeckoService.getHistoricalPrice(
          symbol,
          currentDate,
        );

        const priceEntity = PriceHistoryEntity.create({
          tokenAddress,
          chain,
          priceUsd: price,
          timestamp: new Date(currentDate),
          source: 'coingecko',
          granularity,
        });

        priceEntities.push(priceEntity);
      } catch (error) {
        this.logger.warn(
          `Failed to get historical price for ${symbol} on ${currentDate.toISOString()}:`,
          error instanceof Error ? error.message : error,
        );
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (priceEntities.length > 0) {
      await this.priceHistoryRepository.createBatch(priceEntities);
    }
  }
}
