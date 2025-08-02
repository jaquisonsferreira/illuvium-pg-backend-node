import { Injectable, Logger, Inject } from '@nestjs/common';
import { IPriceHistoryRepository } from '../../domain/repositories/price-history.repository.interface';
import { ITokenMetadataRepository } from '../../domain/repositories/token-metadata.repository.interface';
import { PriceHistoryEntity } from '../../domain/entities/price-history.entity';
import { CoinGeckoService } from '../../infrastructure/services/coingecko.service';

interface PopulatePriceHistoryDto {
  tokenAddress?: string;
  chain?: string;
  symbols?: string[];
  forceUpdate?: boolean;
  granularity?: 'minute' | 'hour' | 'day';
}

interface PopulateResult {
  processed: number;
  created: number;
  updated: number;
  errors: number;
  details: Array<{
    tokenAddress: string;
    chain: string;
    symbol: string;
    status: 'created' | 'updated' | 'skipped' | 'error';
    error?: string;
  }>;
}

@Injectable()
export class PopulatePriceHistoryUseCase {
  private readonly logger = new Logger(PopulatePriceHistoryUseCase.name);

  constructor(
    @Inject('IPriceHistoryRepository')
    private readonly priceHistoryRepository: IPriceHistoryRepository,
    @Inject('ITokenMetadataRepository')
    private readonly tokenMetadataRepository: ITokenMetadataRepository,
    private readonly coinGeckoService: CoinGeckoService,
  ) {}

  async execute(dto: PopulatePriceHistoryDto): Promise<PopulateResult> {
    const {
      tokenAddress,
      chain,
      symbols,
      forceUpdate = false,
      granularity = 'hour',
    } = dto;

    const result: PopulateResult = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    try {
      if (tokenAddress && chain) {
        await this.populateTokenPrice(
          tokenAddress,
          chain,
          granularity,
          forceUpdate,
          result,
        );
      } else if (symbols && symbols.length > 0) {
        await this.populateMultipleTokenPrices(
          symbols,
          granularity,
          forceUpdate,
          result,
        );
      } else {
        await this.populateAllTokenPrices(granularity, forceUpdate, result);
      }
    } catch (error) {
      this.logger.error(
        'Error during price history population:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }

    this.logger.log(
      `Population completed: ${result.processed} processed, ${result.created} created, ${result.updated} updated, ${result.errors} errors`,
    );

    return result;
  }

  private async populateTokenPrice(
    tokenAddress: string,
    chain: string,
    granularity: string,
    forceUpdate: boolean,
    result: PopulateResult,
  ): Promise<void> {
    result.processed++;

    try {
      const tokenMetadata = await this.tokenMetadataRepository.findByAddress(
        tokenAddress,
        chain,
      );

      if (!tokenMetadata) {
        throw new Error(
          `Token metadata not found for ${tokenAddress} on ${chain}`,
        );
      }

      const existingPrice = await this.priceHistoryRepository.findLatestByToken(
        tokenAddress,
        chain,
      );

      const shouldUpdate =
        forceUpdate ||
        !existingPrice ||
        existingPrice.isPriceStale(this.getMaxAgeMinutes(granularity));

      if (!shouldUpdate) {
        result.details.push({
          tokenAddress,
          chain,
          symbol: tokenMetadata.symbol,
          status: 'skipped',
        });
        return;
      }

      const price = await this.coinGeckoService.getTokenPrice(
        tokenMetadata.symbol,
      );

      const priceEntity = PriceHistoryEntity.create({
        tokenAddress,
        chain,
        priceUsd: price,
        timestamp: new Date(),
        source: 'coingecko',
        granularity,
      });

      if (existingPrice) {
        await this.priceHistoryRepository.upsert(priceEntity);
        result.updated++;
        result.details.push({
          tokenAddress,
          chain,
          symbol: tokenMetadata.symbol,
          status: 'updated',
        });
      } else {
        await this.priceHistoryRepository.create(priceEntity);
        result.created++;
        result.details.push({
          tokenAddress,
          chain,
          symbol: tokenMetadata.symbol,
          status: 'created',
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to populate price for ${tokenAddress} on ${chain}:`,
        error instanceof Error ? error.message : error,
      );
      result.errors++;
      result.details.push({
        tokenAddress,
        chain,
        symbol: 'unknown',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async populateMultipleTokenPrices(
    symbols: string[],
    granularity: string,
    forceUpdate: boolean,
    result: PopulateResult,
  ): Promise<void> {
    const prices = await this.coinGeckoService.getMultipleTokenPrices(symbols);
    const priceEntities: PriceHistoryEntity[] = [];

    for (const symbol of symbols) {
      const price = prices.get(symbol);
      if (!price) {
        result.errors++;
        result.details.push({
          tokenAddress: 'unknown',
          chain: 'unknown',
          symbol,
          status: 'error',
          error: 'Price not found',
        });
        continue;
      }

      const tokens = await this.tokenMetadataRepository.findBySymbol(symbol);

      for (const token of tokens) {
        result.processed++;

        try {
          const existingPrice =
            await this.priceHistoryRepository.findLatestByToken(
              token.tokenAddress,
              token.chain,
            );

          const shouldUpdate =
            forceUpdate ||
            !existingPrice ||
            existingPrice.isPriceStale(this.getMaxAgeMinutes(granularity));

          if (!shouldUpdate) {
            result.details.push({
              tokenAddress: token.tokenAddress,
              chain: token.chain,
              symbol: token.symbol,
              status: 'skipped',
            });
            continue;
          }

          const priceEntity = PriceHistoryEntity.create({
            tokenAddress: token.tokenAddress,
            chain: token.chain,
            priceUsd: price,
            timestamp: new Date(),
            source: 'coingecko',
            granularity,
          });

          priceEntities.push(priceEntity);

          result.created++;
          result.details.push({
            tokenAddress: token.tokenAddress,
            chain: token.chain,
            symbol: token.symbol,
            status: 'created',
          });
        } catch (error) {
          this.logger.error(
            `Failed to process price for ${token.symbol} on ${token.chain}:`,
            error instanceof Error ? error.message : error,
          );
          result.errors++;
          result.details.push({
            tokenAddress: token.tokenAddress,
            chain: token.chain,
            symbol: token.symbol,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    if (priceEntities.length > 0) {
      await this.priceHistoryRepository.createBatch(priceEntities);
    }
  }

  private async populateAllTokenPrices(
    granularity: string,
    forceUpdate: boolean,
    result: PopulateResult,
  ): Promise<void> {
    const staleDate = new Date();
    staleDate.setMinutes(
      staleDate.getMinutes() - this.getMaxAgeMinutes(granularity),
    );

    const staleTokens = await this.tokenMetadataRepository.findStaleTokens(
      staleDate,
      100,
    );

    if (staleTokens.length === 0) {
      this.logger.log('No stale tokens found to update');
      return;
    }

    const symbols = [...new Set(staleTokens.map((t) => t.symbol))];
    await this.populateMultipleTokenPrices(
      symbols,
      granularity,
      forceUpdate,
      result,
    );
  }

  private getMaxAgeMinutes(granularity: string): number {
    switch (granularity) {
      case 'minute':
        return 1;
      case 'hour':
        return 60;
      case 'day':
        return 1440;
      default:
        return 60;
    }
  }

  async populateHistoricalPrices(
    tokenAddress: string,
    chain: string,
    startDate: Date,
    endDate: Date,
    granularity: string = 'day',
  ): Promise<{ populated: number; errors: number }> {
    const tokenMetadata = await this.tokenMetadataRepository.findByAddress(
      tokenAddress,
      chain,
    );

    if (!tokenMetadata) {
      throw new Error(
        `Token metadata not found for ${tokenAddress} on ${chain}`,
      );
    }

    let populated = 0;
    let errors = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      try {
        const existingPrice =
          await this.priceHistoryRepository.findByTokenAndDate(
            tokenAddress,
            chain,
            currentDate,
            granularity,
          );

        if (!existingPrice) {
          const price = await this.coinGeckoService.getHistoricalPrice(
            tokenMetadata.symbol,
            currentDate,
          );

          const priceEntity = PriceHistoryEntity.create({
            tokenAddress,
            chain,
            priceUsd: price,
            timestamp: currentDate,
            source: 'coingecko',
            granularity,
          });

          await this.priceHistoryRepository.create(priceEntity);
          populated++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to populate historical price for ${tokenAddress} on ${currentDate.toISOString()}:`,
          error instanceof Error ? error.message : error,
        );
        errors++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    this.logger.log(
      `Historical price population completed: ${populated} populated, ${errors} errors`,
    );

    return { populated, errors };
  }
}
