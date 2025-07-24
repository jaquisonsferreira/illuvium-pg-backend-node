import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@shared/services/http.service';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@shared/services/cache.service';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';

interface VaultData {
  id: string;
  totalAssets: string;
  totalSupply: string;
  asset: {
    id: string;
    symbol: string;
    decimals: number;
  };
}

interface VaultPositionData {
  id: string;
  vault: VaultData;
  account: string;
  shares: string;
  lastUpdated: string;
}

interface SubgraphResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
  }>;
}

@Injectable()
export class SubgraphService {
  private readonly logger = new Logger(SubgraphService.name);
  private readonly subgraphUrls: Record<string, string>;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.subgraphUrls = {
      base: this.configService.get<string>('SUBGRAPH_URL_BASE') || '',
      ethereum: this.configService.get<string>('SUBGRAPH_URL_ETHEREUM') || '',
      arbitrum: this.configService.get<string>('SUBGRAPH_URL_ARBITRUM') || '',
      optimism: this.configService.get<string>('SUBGRAPH_URL_OPTIMISM') || '',
    };
  }

  async getVaultData(
    vaultAddress: string,
    chain: string,
  ): Promise<VaultData | null> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_DATA}:${chain}:${vaultAddress.toLowerCase()}`;

    const cached = await this.cacheService.get<VaultData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const query = `
        query GetVault($id: ID!) {
          vault(id: $id) {
            id
            totalAssets
            totalSupply
            asset {
              id
              symbol
              decimals
            }
          }
        }
      `;

      const variables = {
        id: vaultAddress.toLowerCase(),
      };

      const response = await this.querySubgraph<{ vault: VaultData }>(
        chain,
        query,
        variables,
      );

      if (!response.vault) {
        return null;
      }

      await this.cacheService.set(
        cacheKey,
        response.vault,
        SHARD_CACHE_TTL.VAULT_DATA,
      );

      return response.vault;
    } catch (error) {
      this.logger.error(
        `Failed to fetch vault data for ${vaultAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getVaultPositions(
    vaultAddress: string,
    chain: string,
    blockNumber?: number,
  ): Promise<VaultPositionData[]> {
    try {
      const query = `
        query GetVaultPositions($vault: String!, $first: Int!, $skip: Int!, $block: Block_height) {
          vaultPositions(
            first: $first
            skip: $skip
            where: { vault: $vault, shares_gt: "0" }
            block: $block
            orderBy: shares
            orderDirection: desc
          ) {
            id
            vault {
              id
              totalAssets
              totalSupply
              asset {
                id
                symbol
                decimals
              }
            }
            account
            shares
            lastUpdated
          }
        }
      `;

      const allPositions: VaultPositionData[] = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const variables: any = {
          vault: vaultAddress.toLowerCase(),
          first: limit,
          skip,
        };

        if (blockNumber) {
          variables.block = { number: blockNumber };
        }

        const response = await this.querySubgraph<{
          vaultPositions: VaultPositionData[];
        }>(chain, query, variables);

        if (!response.vaultPositions || response.vaultPositions.length === 0) {
          hasMore = false;
        } else {
          allPositions.push(...response.vaultPositions);
          skip += limit;

          if (response.vaultPositions.length < limit) {
            hasMore = false;
          }
        }
      }

      return allPositions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch vault positions for ${vaultAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getUserVaultPositions(
    walletAddress: string,
    chain: string,
    blockNumber?: number,
  ): Promise<VaultPositionData[]> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_POSITIONS}:${chain}:${walletAddress.toLowerCase()}`;

    if (!blockNumber) {
      const cached = await this.cacheService.get<VaultPositionData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const query = `
        query GetUserPositions($account: String!, $first: Int!, $skip: Int!, $block: Block_height) {
          vaultPositions(
            first: $first
            skip: $skip
            where: { account: $account, shares_gt: "0" }
            block: $block
            orderBy: shares
            orderDirection: desc
          ) {
            id
            vault {
              id
              totalAssets
              totalSupply
              asset {
                id
                symbol
                decimals
              }
            }
            account
            shares
            lastUpdated
          }
        }
      `;

      const allPositions: VaultPositionData[] = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const variables: any = {
          account: walletAddress.toLowerCase(),
          first: limit,
          skip,
        };

        if (blockNumber) {
          variables.block = { number: blockNumber };
        }

        const response = await this.querySubgraph<{
          vaultPositions: VaultPositionData[];
        }>(chain, query, variables);

        if (!response.vaultPositions || response.vaultPositions.length === 0) {
          hasMore = false;
        } else {
          allPositions.push(...response.vaultPositions);
          skip += limit;

          if (response.vaultPositions.length < limit) {
            hasMore = false;
          }
        }
      }

      if (!blockNumber) {
        await this.cacheService.set(
          cacheKey,
          allPositions,
          SHARD_CACHE_TTL.VAULT_POSITIONS,
        );
      }

      return allPositions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch user vault positions for ${walletAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getEligibleVaults(chain: string): Promise<string[]> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_DATA}:${chain}:eligible-vaults`;

    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const eligibleAssets = this.getEligibleAssetSymbols();
      const query = `
        query GetEligibleVaults($symbols: [String!]) {
          vaults(
            first: 1000
            where: {
              asset_: { symbol_in: $symbols },
              totalAssets_gt: "0"
            }
            orderBy: totalAssets
            orderDirection: desc
          ) {
            id
            asset {
              symbol
            }
          }
        }
      `;

      const variables = {
        symbols: eligibleAssets,
      };

      const response = await this.querySubgraph<{
        vaults: Array<{ id: string; asset: { symbol: string } }>;
      }>(chain, query, variables);

      const vaultAddresses = response.vaults?.map((v) => v.id) || [];

      await this.cacheService.set(
        cacheKey,
        vaultAddresses,
        SHARD_CACHE_TTL.VAULT_DATA,
      );

      return vaultAddresses;
    } catch (error) {
      this.logger.error(
        `Failed to fetch eligible vaults for ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getBlockByTimestamp(chain: string, timestamp: number): Promise<number> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_DATA}:${chain}:block:${timestamp}`;

    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const query = `
        query GetBlock($timestamp: Int!) {
          blocks(
            first: 1
            orderBy: timestamp
            orderDirection: asc
            where: { timestamp_gte: $timestamp }
          ) {
            number
            timestamp
          }
        }
      `;

      const variables = {
        timestamp,
      };

      const blockSubgraphUrl = this.getBlockSubgraphUrl(chain);
      const response = await this.querySubgraph<{
        blocks: Array<{ number: string; timestamp: string }>;
      }>(chain, query, variables, blockSubgraphUrl);

      if (!response.blocks || response.blocks.length === 0) {
        throw new Error(
          `No block found for timestamp ${timestamp} on ${chain}`,
        );
      }

      const blockNumber = parseInt(response.blocks[0].number);

      await this.cacheService.set(
        cacheKey,
        blockNumber,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );

      return blockNumber;
    } catch (error) {
      this.logger.error(
        `Failed to fetch block for timestamp ${timestamp} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async querySubgraph<T>(
    chain: string,
    query: string,
    variables: any,
    customUrl?: string,
  ): Promise<T> {
    const url = customUrl || this.subgraphUrls[chain];
    if (!url) {
      throw new Error(`No subgraph URL configured for chain: ${chain}`);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<SubgraphResponse<T>>(
          url,
          {
            query,
            variables,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (response.data.errors && response.data.errors.length > 0) {
        throw new Error(
          `Subgraph errors: ${response.data.errors.map((e) => e.message).join(', ')}`,
        );
      }

      return response.data.data;
    } catch (error) {
      this.logger.error(
        `Subgraph query failed for ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private getBlockSubgraphUrl(chain: string): string {
    return this.subgraphUrls[chain];
  }

  private getEligibleAssetSymbols(): string[] {
    return ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC'];
  }
}
