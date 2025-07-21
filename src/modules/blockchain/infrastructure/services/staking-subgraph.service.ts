import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  IStakingSubgraphRepository,
  VaultPosition,
  VaultTransaction,
  LPTokenData,
  SubgraphSyncStatus,
  VaultAnalytics,
  TVLDataPoint,
  PositionQueryParams,
  TransactionQueryParams,
  PaginatedResponse,
  DataResponse,
  ChainType,
  TransactionType,
  TransactionStatus,
} from '../../domain/types/staking-types';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { VaultTransaction as VaultTransactionEntity } from '../../domain/entities/vault-transaction.entity';
import { LPToken } from '../../domain/entities/lp-token.entity';

interface SubgraphConfig {
  [ChainType.BASE]: {
    url: string;
    deploymentId?: string;
  };
  [ChainType.OBELISK]: {
    url: string;
    deploymentId?: string;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

@Injectable()
export class StakingSubgraphService implements IStakingSubgraphRepository {
  private readonly logger = new Logger(StakingSubgraphService.name);
  private readonly httpClients: Map<ChainType, AxiosInstance> = new Map();
  private readonly config: SubgraphConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      [ChainType.BASE]: {
        url: this.configService.get<string>('SUBGRAPH_BASE_URL', 'https://api.thegraph.com/subgraphs/name/obelisk/base-staking'),
        deploymentId: this.configService.get<string>('SUBGRAPH_BASE_DEPLOYMENT_ID'),
      },
      [ChainType.OBELISK]: {
        url: this.configService.get<string>('SUBGRAPH_OBELISK_URL', 'https://api.thegraph.com/subgraphs/name/obelisk/obelisk-staking'),
        deploymentId: this.configService.get<string>('SUBGRAPH_OBELISK_DEPLOYMENT_ID'),
      },
    };

    this.initializeHttpClients();
  }

  private initializeHttpClients(): void {
    Object.entries(this.config).forEach(([chain, config]) => {
      const client = axios.create({
        baseURL: config.url,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Obelisk-Staking-API/1.0',
        },
      });

      // Add request interceptor for logging
      client.interceptors.request.use(
        (config) => {
          this.logger.debug(`Subgraph request to ${chain}: ${config.data?.slice(0, 200)}...`);
          return config;
        },
        (error) => {
          this.logger.error(`Subgraph request error for ${chain}:`, error);
          return Promise.reject(error);
        }
      );

      // Add response interceptor for error handling
      client.interceptors.response.use(
        (response) => {
          if (response.data?.errors?.length > 0) {
            this.logger.warn(`Subgraph response errors for ${chain}:`, response.data.errors);
          }
          return response;
        },
        (error: AxiosError) => {
          this.logger.error(`Subgraph response error for ${chain}:`, error.message);
          return Promise.reject(error);
        }
      );

      this.httpClients.set(chain as ChainType, client);
    });
  }

  async getSyncStatus(chain: ChainType): Promise<SubgraphSyncStatus> {
    const query = `
      query GetSyncStatus {
        _meta {
          block {
            number
            hash
            timestamp
          }
          deployment
          hasIndexingErrors
        }
      }
    `;

    try {
      const response = await this.query<{
        _meta: {
          block: { number: number; hash: string; timestamp: number };
          deployment: string;
          hasIndexingErrors: boolean;
        };
      }>(chain, query);

      const chainHeadBlock = await this.getChainHeadBlock(chain);
      const latestBlock = response._meta.block.number;
      const blocksBehind = chainHeadBlock - latestBlock;

      return {
        chainHeadBlock,
        latestBlock,
        blocksBehind,
        isHealthy: !response._meta.hasIndexingErrors && blocksBehind < 100,
        lastSyncTime: new Date(response._meta.block.timestamp * 1000),
        isSyncing: blocksBehind > 10,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync status for ${chain}:`, error);
      throw new Error(`Subgraph sync status unavailable for ${chain}`);
    }
  }

  async getUserPositions(params: PositionQueryParams): Promise<DataResponse<VaultPosition[]>> {
    const { userAddress, vaultAddress, chain = ChainType.BASE, fromBlock, toBlock } = params;

    const whereConditions = [`user: "${userAddress.toLowerCase()}"`];
    if (vaultAddress) {
      whereConditions.push(`vault: "${vaultAddress.toLowerCase()}"`);
    }
    if (fromBlock) {
      whereConditions.push(`blockNumber_gte: ${fromBlock}`);
    }
    if (toBlock) {
      whereConditions.push(`blockNumber_lte: ${toBlock}`);
    }

    const query = `
      query GetUserPositions {
        vaultPositions(
          where: { ${whereConditions.join(', ')} }
          orderBy: blockNumber
          orderDirection: desc
          first: 1000
        ) {
          id
          vault
          user
          shares
          assets
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const response = await this.query<{
        vaultPositions: Array<{
          id: string;
          vault: string;
          user: string;
          shares: string;
          assets: string;
          blockNumber: number;
          timestamp: number;
        }>;
      }>(chain, query);

      const positions = response.vaultPositions
        .map((pos) => VaultPositionEntity.fromSubgraphData({
          vault: pos.vault,
          user: pos.user,
          shares: pos.shares,
          assets: pos.assets,
          blockNumber: pos.blockNumber,
          timestamp: pos.timestamp,
        }))
        .filter((pos) => pos.hasBalance()); // Only return positions with actual balance

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: positions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user positions for ${userAddress}:`, error);
      throw new Error(`Failed to fetch user positions from subgraph`);
    }
  }

  async getUserPosition(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultPosition | null>> {
    const query = `
      query GetUserPosition {
        vaultPositions(
          where: { 
            user: "${userAddress.toLowerCase()}"
            vault: "${vaultAddress.toLowerCase()}"
          }
          orderBy: blockNumber
          orderDirection: desc
          first: 1
        ) {
          id
          vault
          user
          shares
          assets
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const response = await this.query<{
        vaultPositions: Array<{
          id: string;
          vault: string;
          user: string;
          shares: string;
          assets: string;
          blockNumber: number;
          timestamp: number;
        }>;
      }>(chain, query);

      const positionData = response.vaultPositions[0];
      let position: VaultPosition | null = null;

      if (positionData) {
        const pos = VaultPositionEntity.fromSubgraphData({
          vault: positionData.vault,
          user: positionData.user,
          shares: positionData.shares,
          assets: positionData.assets,
          blockNumber: positionData.blockNumber,
          timestamp: positionData.timestamp,
        });

        if (pos.hasBalance()) {
          position = pos;
        }
      }

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: position,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user position for ${userAddress} in vault ${vaultAddress}:`, error);
      throw new Error(`Failed to fetch user position from subgraph`);
    }
  }

  async getVaultPositions(
    vaultAddress: string,
    chain: ChainType,
    limit: number = 100,
    offset: number = 0,
  ): Promise<DataResponse<PaginatedResponse<VaultPosition>>> {
    const query = `
      query GetVaultPositions {
        vaultPositions(
          where: { vault: "${vaultAddress.toLowerCase()}" }
          orderBy: assets
          orderDirection: desc
          first: ${limit}
          skip: ${offset}
        ) {
          id
          vault
          user
          shares
          assets
          blockNumber
          timestamp
        }
      }
    `;

    const countQuery = `
      query GetVaultPositionsCount {
        vault(id: "${vaultAddress.toLowerCase()}") {
          participantCount
        }
      }
    `;

    try {
      const [response, countResponse] = await Promise.all([
        this.query<{
          vaultPositions: Array<{
            id: string;
            vault: string;
            user: string;
            shares: string;
            assets: string;
            blockNumber: number;
            timestamp: number;
          }>;
        }>(chain, query),
        this.query<{
          vault: { participantCount: number } | null;
        }>(chain, countQuery),
      ]);

      const positions = response.vaultPositions
        .map((pos) => VaultPositionEntity.fromSubgraphData({
          vault: pos.vault,
          user: pos.user,
          shares: pos.shares,
          assets: pos.assets,
          blockNumber: pos.blockNumber,
          timestamp: pos.timestamp,
        }))
        .filter((pos) => pos.hasBalance());

      const total = countResponse.vault?.participantCount || 0;
      const totalPages = Math.ceil(total / limit);

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: {
          data: positions,
          pagination: {
            page: Math.floor(offset / limit) + 1,
            limit,
            total,
            totalPages,
            hasNext: offset + limit < total,
            hasPrevious: offset > 0,
          },
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get vault positions for ${vaultAddress}:`, error);
      throw new Error(`Failed to fetch vault positions from subgraph`);
    }
  }

  async getTransactions(params: TransactionQueryParams): Promise<DataResponse<PaginatedResponse<VaultTransaction>>> {
    const { 
      userAddress, 
      vaultAddress, 
      chain = ChainType.BASE, 
      type, 
      fromTimestamp, 
      toTimestamp, 
      page = 1, 
      limit = 20 
    } = params;

    const whereConditions: string[] = [];
    if (userAddress) {
      whereConditions.push(`user: "${userAddress.toLowerCase()}"`);
    }
    if (vaultAddress) {
      whereConditions.push(`vault: "${vaultAddress.toLowerCase()}"`);
    }
    if (type) {
      whereConditions.push(`type: "${type}"`);
    }
    if (fromTimestamp) {
      whereConditions.push(`timestamp_gte: ${fromTimestamp}`);
    }
    if (toTimestamp) {
      whereConditions.push(`timestamp_lte: ${toTimestamp}`);
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.length > 0 ? `where: { ${whereConditions.join(', ')} }` : '';

    const query = `
      query GetTransactions {
        vaultTransactions(
          ${whereClause}
          orderBy: timestamp
          orderDirection: desc
          first: ${limit}
          skip: ${offset}
        ) {
          id
          vault
          user
          type
          assets
          shares
          timestamp
          blockNumber
          transactionHash
        }
      }
    `;

    const countQuery = `
      query GetTransactionsCount {
        vaultTransactions(${whereClause}) {
          id
        }
      }
    `;

    try {
      const [response, countResponse] = await Promise.all([
        this.query<{
          vaultTransactions: Array<{
            id: string;
            vault: string;
            user: string;
            type: string;
            assets: string;
            shares: string;
            timestamp: number;
            blockNumber: number;
            transactionHash: string;
          }>;
        }>(chain, query),
        this.query<{
          vaultTransactions: Array<{ id: string }>;
        }>(chain, countQuery),
      ]);

      const transactions = response.vaultTransactions.map((tx) =>
        VaultTransactionEntity.fromSubgraphData({
          id: tx.id,
          vault: tx.vault,
          user: tx.user,
          type: tx.type,
          assets: tx.assets,
          shares: tx.shares,
          timestamp: tx.timestamp,
          blockNumber: tx.blockNumber,
          transactionHash: tx.transactionHash,
          status: TransactionStatus.CONFIRMED,
        })
      );

      const total = countResponse.vaultTransactions.length;
      const totalPages = Math.ceil(total / limit);

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: {
          data: transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
          },
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get transactions:`, error);
      throw new Error(`Failed to fetch transactions from subgraph`);
    }
  }

  async getTransaction(
    transactionId: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultTransaction | null>> {
    const query = `
      query GetTransaction {
        vaultTransaction(id: "${transactionId}") {
          id
          vault
          user
          type
          assets
          shares
          timestamp
          blockNumber
          transactionHash
        }
      }
    `;

    try {
      const response = await this.query<{
        vaultTransaction: {
          id: string;
          vault: string;
          user: string;
          type: string;
          assets: string;
          shares: string;
          timestamp: number;
          blockNumber: number;
          transactionHash: string;
        } | null;
      }>(chain, query);

      let transaction: VaultTransaction | null = null;

      if (response.vaultTransaction) {
        transaction = VaultTransactionEntity.fromSubgraphData({
          id: response.vaultTransaction.id,
          vault: response.vaultTransaction.vault,
          user: response.vaultTransaction.user,
          type: response.vaultTransaction.type,
          assets: response.vaultTransaction.assets,
          shares: response.vaultTransaction.shares,
          timestamp: response.vaultTransaction.timestamp,
          blockNumber: response.vaultTransaction.blockNumber,
          transactionHash: response.vaultTransaction.transactionHash,
          status: TransactionStatus.CONFIRMED,
        });
      }

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: transaction,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction ${transactionId}:`, error);
      throw new Error(`Failed to fetch transaction from subgraph`);
    }
  }

  async getVaultTransactions(
    vaultAddress: string,
    chain: ChainType,
    limit: number = 20,
    offset: number = 0,
  ): Promise<DataResponse<PaginatedResponse<VaultTransaction>>> {
    const page = Math.floor(offset / limit) + 1;
    return this.getTransactions({
      vaultAddress,
      chain,
      page,
      limit,
    });
  }

  async getLPTokenData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<LPTokenData | null>> {
    const query = `
      query GetLPTokenData {
        lpToken(id: "${tokenAddress.toLowerCase()}") {
          id
          token0
          token1
          reserve0
          reserve1
          totalSupply
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const response = await this.query<{
        lpToken: {
          id: string;
          token0: string;
          token1: string;
          reserve0: string;
          reserve1: string;
          totalSupply: string;
          blockNumber: number;
          timestamp: number;
        } | null;
      }>(chain, query);

      let lpTokenData: LPTokenData | null = null;

      if (response.lpToken) {
        lpTokenData = LPToken.fromSubgraphData({
          address: response.lpToken.id,
          token0: response.lpToken.token0,
          token1: response.lpToken.token1,
          reserve0: response.lpToken.reserve0,
          reserve1: response.lpToken.reserve1,
          totalSupply: response.lpToken.totalSupply,
          blockNumber: response.lpToken.blockNumber,
          timestamp: response.lpToken.timestamp,
        });
      }

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: lpTokenData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get LP token data for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch LP token data from subgraph`);
    }
  }

  async getMultipleLPTokensData(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<DataResponse<LPTokenData[]>> {
    const addressList = tokenAddresses.map(addr => `"${addr.toLowerCase()}"`).join(', ');
    
    const query = `
      query GetMultipleLPTokensData {
        lpTokens(where: { id_in: [${addressList}] }) {
          id
          token0
          token1
          reserve0
          reserve1
          totalSupply
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const response = await this.query<{
        lpTokens: Array<{
          id: string;
          token0: string;
          token1: string;
          reserve0: string;
          reserve1: string;
          totalSupply: string;
          blockNumber: number;
          timestamp: number;
        }>;
      }>(chain, query);

      const lpTokensData = response.lpTokens.map((token) =>
        LPToken.fromSubgraphData({
          address: token.id,
          token0: token.token0,
          token1: token.token1,
          reserve0: token.reserve0,
          reserve1: token.reserve1,
          totalSupply: token.totalSupply,
          blockNumber: token.blockNumber,
          timestamp: token.timestamp,
        })
      );

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: lpTokensData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: syncStatus.blocksBehind > 50,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get multiple LP tokens data:`, error);
      throw new Error(`Failed to fetch multiple LP tokens data from subgraph`);
    }
  }

  // Placeholder implementations for other methods
  async getVaultAnalytics(vaultAddress: string, chain: ChainType): Promise<DataResponse<VaultAnalytics>> {
    // Implementation would depend on the specific subgraph schema
    throw new Error('Method not implemented yet');
  }

  async getVaultTVLHistory(
    vaultAddress: string,
    chain: ChainType,
    fromTimestamp?: number,
    toTimestamp?: number,
    granularity?: 'hour' | 'day' | 'week',
  ): Promise<DataResponse<TVLDataPoint[]>> {
    throw new Error('Method not implemented yet');
  }

  async getEcosystemStats(chain: ChainType): Promise<DataResponse<{
    totalValueLocked: string;
    totalValueLockedUsd: number;
    totalVaults: number;
    totalParticipants: number;
    volume24h: string;
    volume7d: string;
  }>> {
    throw new Error('Method not implemented yet');
  }

  async getCurrentBlock(chain: ChainType): Promise<number> {
    const syncStatus = await this.getSyncStatus(chain);
    return syncStatus.latestBlock;
  }

  async getLatestTransactions(chain: ChainType, limit: number = 10): Promise<DataResponse<VaultTransaction[]>> {
    const response = await this.getTransactions({ chain, page: 1, limit });
    return {
      data: response.data.data,
      metadata: response.metadata,
    };
  }

  async searchUserPositions(
    addressPattern: string,
    chain: ChainType,
    limit: number = 50,
  ): Promise<DataResponse<VaultPosition[]>> {
    throw new Error('Method not implemented yet');
  }

  async getPositionChanges(
    vaultAddress: string,
    fromBlock: number,
    toBlock: number,
    chain: ChainType,
  ): Promise<DataResponse<VaultPosition[]>> {
    throw new Error('Method not implemented yet');
  }

  async getLPTokenReservesHistory(
    tokenAddress: string,
    chain: ChainType,
    fromTimestamp?: number,
    toTimestamp?: number,
  ): Promise<DataResponse<{
    timestamp: number;
    reserve0: string;
    reserve1: string;
    totalSupply: string;
    blockNumber: number;
  }[]>> {
    throw new Error('Method not implemented yet');
  }

  async getLPTokenTransfers(
    tokenAddress: string,
    chain: ChainType,
    fromBlock?: number,
    toBlock?: number,
  ): Promise<DataResponse<{
    from: string;
    to: string;
    value: string;
    blockNumber: number;
    timestamp: number;
    transactionHash: string;
  }[]>> {
    throw new Error('Method not implemented yet');
  }

  async healthCheck(chain: ChainType): Promise<{
    isHealthy: boolean;
    latency: number;
    lastBlock: number;
    indexingErrors?: string[];
  }> {
    const startTime = Date.now();
    
    try {
      const syncStatus = await this.getSyncStatus(chain);
      const latency = Date.now() - startTime;

      return {
        isHealthy: syncStatus.isHealthy,
        latency,
        lastBlock: syncStatus.latestBlock,
        indexingErrors: [], // Would be populated from actual subgraph errors
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        isHealthy: false,
        latency,
        lastBlock: 0,
        indexingErrors: [error.message],
      };
    }
  }

  private async query<T>(chain: ChainType, query: string, variables?: Record<string, any>): Promise<T> {
    const client = this.httpClients.get(chain);
    if (!client) {
      throw new Error(`No HTTP client configured for chain: ${chain}`);
    }

    const response = await client.post<GraphQLResponse<T>>('', {
      query,
      variables,
    });

    if (response.data.errors && response.data.errors.length > 0) {
      const errorMessage = response.data.errors.map(e => e.message).join(', ');
      throw new Error(`Subgraph query error: ${errorMessage}`);
    }

    if (!response.data.data) {
      throw new Error('No data returned from subgraph');
    }

    return response.data.data;
  }

  private async getChainHeadBlock(chain: ChainType): Promise<number> {
    // This would typically call an RPC endpoint to get the latest block
    // For now, returning a mock value
    return 20000000;
  }
} 