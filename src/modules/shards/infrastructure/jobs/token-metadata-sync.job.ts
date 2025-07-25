import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import {
  SHARD_QUEUES,
  SHARD_CACHE_KEYS,
  SHARD_CACHE_TTL,
} from '../../constants';
import { CacheService } from '@shared/services/cache.service';
import { HttpService } from '@shared/services/http.service';
import { firstValueFrom } from 'rxjs';

export interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  chain?: string;
  logoUri?: string;
  coingeckoId?: string;
  totalSupply?: string;
  marketCap?: number;
  volume24h?: number;
  priceChangePercentage24h?: number;
  circulatingSupply?: number;
  lastUpdated?: string;
}

export interface TokenMetadataSyncJobData {
  tokens?: string[];
  chains?: string[];
  forceUpdate?: boolean;
  syncType?: 'full' | 'partial' | 'minimal';
}

interface TokenContract {
  chain: string;
  address: string;
  decimals: number;
}

@Processor(SHARD_QUEUES.TOKEN_METADATA_SYNC)
@Injectable()
export class TokenMetadataSyncJob {
  private readonly logger = new Logger(TokenMetadataSyncJob.name);

  private readonly defaultTokens = [
    { symbol: 'ILV', name: 'Illuvium', coingeckoId: 'illuvium' },
    { symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum' },
    { symbol: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin' },
    { symbol: 'USDT', name: 'Tether', coingeckoId: 'tether' },
    { symbol: 'DAI', name: 'DAI', coingeckoId: 'dai' },
    { symbol: 'WETH', name: 'Wrapped Ether', coingeckoId: 'weth' },
  ];

  private readonly tokenContracts: Record<string, TokenContract[]> = {
    ILV: [
      {
        chain: 'ethereum',
        address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        decimals: 18,
      },
      {
        chain: 'base',
        address: '0xFA3C22C069B9556A4B2f7EcE1Ee3B467909f4864',
        decimals: 18,
      },
    ],
    USDC: [
      {
        chain: 'ethereum',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
      },
      {
        chain: 'base',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
    ],
    USDT: [
      {
        chain: 'ethereum',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
      },
      {
        chain: 'base',
        address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        decimals: 6,
      },
    ],
    DAI: [
      {
        chain: 'ethereum',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
      },
      {
        chain: 'base',
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        decimals: 18,
      },
    ],
  };

  constructor(
    private readonly cacheService: CacheService,
    private readonly httpService: HttpService,
  ) {}

  @Process()
  async process(job: Job<TokenMetadataSyncJobData>): Promise<void> {
    const {
      tokens = this.defaultTokens.map((t) => t.symbol),
      forceUpdate = false,
      syncType = 'partial',
    } = job.data;

    this.logger.log(
      `Processing token metadata sync job ${job.id} for ${tokens.length} tokens (type: ${syncType})`,
    );

    try {
      await job.progress(10);

      const metadataMap = new Map<string, TokenMetadata>();

      for (const [index, token] of tokens.entries()) {
        const progress = Math.round((index / tokens.length) * 80) + 10;
        await job.progress(progress);

        const metadata = await this.syncTokenMetadata(
          token,
          forceUpdate,
          syncType,
        );
        if (metadata) {
          metadataMap.set(token, metadata);
        }

        if (index < tokens.length - 1) {
          await this.delay(500);
        }
      }

      await this.updateMetadataCache(metadataMap);

      await job.progress(100);

      this.logger.log(
        `Successfully synced metadata for ${metadataMap.size}/${tokens.length} tokens`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process token metadata sync job ${job.id}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @Process('sync-single-token')
  async syncSingleToken(
    job: Job<{ token: string; forceUpdate?: boolean }>,
  ): Promise<void> {
    const { token, forceUpdate = false } = job.data;

    this.logger.debug(`Syncing metadata for single token: ${token}`);

    try {
      const metadata = await this.syncTokenMetadata(token, forceUpdate, 'full');

      if (metadata) {
        await this.updateMetadataCache(new Map([[token, metadata]]));
        this.logger.log(`Successfully synced metadata for ${token}`);
      } else {
        this.logger.warn(`No metadata found for token: ${token}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync metadata for ${token}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @Process('sync-contract-metadata')
  async syncContractMetadata(
    job: Job<{ chain: string; addresses: string[] }>,
  ): Promise<void> {
    const { chain, addresses } = job.data;

    this.logger.log(
      `Syncing contract metadata for ${addresses.length} addresses on ${chain}`,
    );

    try {
      for (const [index, address] of addresses.entries()) {
        const progress = Math.round((index / addresses.length) * 100);
        await job.progress(progress);

        await this.syncContractData(chain, address);

        if (index < addresses.length - 1) {
          await this.delay(1000);
        }
      }

      await job.progress(100);

      this.logger.log(
        `Successfully synced contract metadata for ${addresses.length} addresses`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync contract metadata:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @Process('validate-metadata')
  async validateMetadata(job: Job<{ tokens?: string[] }>): Promise<void> {
    const tokens = job.data.tokens || this.defaultTokens.map((t) => t.symbol);

    this.logger.log(`Validating metadata for ${tokens.length} tokens`);

    try {
      const invalidTokens: string[] = [];

      for (const token of tokens) {
        const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:metadata:${token.toLowerCase()}`;
        const metadata = await this.cacheService.get<TokenMetadata>(cacheKey);

        if (!metadata || !this.isValidMetadata(metadata)) {
          invalidTokens.push(token);
        }
      }

      if (invalidTokens.length > 0) {
        this.logger.warn(
          `Found ${invalidTokens.length} tokens with invalid metadata: ${invalidTokens.join(', ')}`,
        );

        for (const token of invalidTokens) {
          await this.syncTokenMetadata(token, true, 'full');
        }
      }

      this.logger.log('Metadata validation completed');
    } catch (error) {
      this.logger.error(
        'Failed to validate metadata:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async syncTokenMetadata(
    tokenSymbol: string,
    forceUpdate: boolean,
    syncType: 'full' | 'partial' | 'minimal',
  ): Promise<TokenMetadata | null> {
    const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:metadata:${tokenSymbol.toLowerCase()}`;

    if (!forceUpdate) {
      const cached = await this.cacheService.get<TokenMetadata>(cacheKey);
      if (cached && this.isValidMetadata(cached)) {
        return cached;
      }
    }

    try {
      const baseMetadata = this.getBaseMetadata(tokenSymbol);
      if (!baseMetadata) {
        return null;
      }

      let metadata: TokenMetadata = {
        ...baseMetadata,
        lastUpdated: new Date().toISOString(),
      };

      if (syncType === 'full' || syncType === 'partial') {
        const marketData = await this.fetchMarketData(baseMetadata.coingeckoId);
        if (marketData) {
          metadata = { ...metadata, ...marketData };
        }
      }

      if (syncType === 'full') {
        const contracts = this.tokenContracts[tokenSymbol];
        if (contracts && contracts.length > 0) {
          metadata.address = contracts[0].address;
          metadata.chain = contracts[0].chain;
          metadata.decimals = contracts[0].decimals;
        }
      }

      await this.cacheService.set(
        cacheKey,
        metadata,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );

      return metadata;
    } catch (error) {
      this.logger.error(
        `Failed to sync metadata for ${tokenSymbol}:`,
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }

  private async fetchMarketData(
    coingeckoId?: string,
  ): Promise<Partial<TokenMetadata> | null> {
    if (!coingeckoId) {
      return null;
    }

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}`;
      const params = {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
      };

      const response = await firstValueFrom(
        this.httpService.get<any>(url, { params }),
      );

      const data = response.data;
      const marketData = data.market_data;

      return {
        marketCap: marketData?.market_cap?.usd,
        volume24h: marketData?.total_volume?.usd,
        priceChangePercentage24h: marketData?.price_change_percentage_24h,
        circulatingSupply: marketData?.circulating_supply,
        totalSupply: marketData?.total_supply?.toString(),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch market data for ${coingeckoId}:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  private async syncContractData(
    chain: string,
    address: string,
  ): Promise<void> {
    const cacheKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:contract:${chain}:${address.toLowerCase()}`;

    try {
      const contractData = {
        chain,
        address,
        verified: true,
        lastChecked: new Date().toISOString(),
      };

      await this.cacheService.set(
        cacheKey,
        contractData,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to sync contract data for ${address} on ${chain}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  private async updateMetadataCache(
    metadataMap: Map<string, TokenMetadata>,
  ): Promise<void> {
    const allMetadataKey = `${SHARD_CACHE_KEYS.PRICE_DATA}:metadata:all`;
    const existingMetadata =
      (await this.cacheService.get<Record<string, TokenMetadata>>(
        allMetadataKey,
      )) || {};

    const updatedMetadata = { ...existingMetadata };

    for (const [token, metadata] of metadataMap.entries()) {
      updatedMetadata[token] = metadata;
    }

    await this.cacheService.set(
      allMetadataKey,
      updatedMetadata,
      SHARD_CACHE_TTL.HISTORICAL_DATA,
    );
  }

  private getBaseMetadata(
    tokenSymbol: string,
  ): Omit<TokenMetadata, 'lastUpdated'> | null {
    const token = this.defaultTokens.find(
      (t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase(),
    );

    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        decimals: 18,
        coingeckoId: token.coingeckoId,
      };
    }

    return {
      symbol: tokenSymbol.toUpperCase(),
      name: tokenSymbol,
      decimals: 18,
    };
  }

  private isValidMetadata(metadata: TokenMetadata): boolean {
    if (!metadata.symbol || !metadata.name || metadata.decimals === undefined) {
      return false;
    }

    if (metadata.lastUpdated) {
      const lastUpdate = new Date(metadata.lastUpdated);
      const hoursSinceUpdate =
        (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate > 24) {
        return false;
      }
    } else {
      return false;
    }

    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
