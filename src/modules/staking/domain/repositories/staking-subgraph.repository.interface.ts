import {
  VaultPosition,
  VaultTransaction,
  StakingTransaction,
  LPTokenData,
  SubgraphSyncStatus,
  VaultAnalytics,
  TVLDataPoint,
  PositionQueryParams,
  TransactionQueryParams,
  PaginatedResponse,
  DataResponse,
  ChainType,
} from '../types/staking-types';

export interface IStakingSubgraphRepository {
  /**
   * Gets the current sync status of the subgraph
   */
  getSyncStatus(chain: ChainType): Promise<SubgraphSyncStatus>;

  /**
   * Gets vault positions for a specific user
   */
  getUserPositions(
    params: PositionQueryParams,
  ): Promise<DataResponse<VaultPosition[]>>;

  /**
   * Gets vault position for a specific user and vault
   */
  getUserPosition(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultPosition | null>>;

  /**
   * Gets all positions for a specific vault (for analytics)
   */
  getVaultPositions(
    vaultAddress: string,
    chain: ChainType,
    limit?: number,
    offset?: number,
  ): Promise<DataResponse<PaginatedResponse<VaultPosition>>>;

  /**
   * Gets transaction history
   */
  getTransactions(
    params: TransactionQueryParams,
  ): Promise<DataResponse<PaginatedResponse<VaultTransaction>>>;

  /**
   * Gets a specific transaction by ID
   */
  getTransaction(
    transactionId: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultTransaction | null>>;

  /**
   * Gets transactions for a specific vault
   */
  getVaultTransactions(
    vaultAddress: string,
    chain: ChainType,
    limit?: number,
    offset?: number,
  ): Promise<DataResponse<PaginatedResponse<VaultTransaction>>>;

  /**
   * Gets all transactions for a specific user
   */
  getUserTransactions(params: {
    userAddress: string;
    chain: ChainType;
    limit?: number;
    offset?: number;
  }): Promise<DataResponse<StakingTransaction[]>>;

  /**
   * Gets LP token data including reserves
   */
  getLPTokenData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<LPTokenData | null>>;

  /**
   * Gets multiple LP tokens data
   */
  getMultipleLPTokensData(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<DataResponse<LPTokenData[]>>;

  /**
   * Gets vault analytics data including TVL and participant count
   */
  getVaultAnalytics(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultAnalytics>>;

  /**
   * Gets historical TVL data for a vault
   */
  getVaultTVLHistory(
    vaultAddress: string,
    chain: ChainType,
    fromTimestamp?: number,
    toTimestamp?: number,
    granularity?: 'hour' | 'day' | 'week',
  ): Promise<DataResponse<TVLDataPoint[]>>;

  /**
   * Gets aggregated data across all vaults for ecosystem stats
   */
  getEcosystemStats(chain: ChainType): Promise<
    DataResponse<{
      totalValueLocked: string;
      totalValueLockedUsd: number;
      totalVaults: number;
      totalParticipants: number;
      volume24h: string;
      volume7d: string;
    }>
  >;

  /**
   * Gets current block number from subgraph
   */
  getCurrentBlock(chain: ChainType): Promise<number>;

  /**
   * Gets the latest transactions across all vaults
   */
  getLatestTransactions(
    chain: ChainType,
    limit?: number,
  ): Promise<DataResponse<VaultTransaction[]>>;

  /**
   * Searches for vault positions by user address pattern (for admin/analytics)
   */
  searchUserPositions(
    addressPattern: string,
    chain: ChainType,
    limit?: number,
  ): Promise<DataResponse<VaultPosition[]>>;

  /**
   * Gets vault position changes within a block range
   */
  getPositionChanges(
    vaultAddress: string,
    fromBlock: number,
    toBlock: number,
    chain: ChainType,
  ): Promise<DataResponse<VaultPosition[]>>;

  /**
   * Gets LP token reserves history for price calculations
   */
  getLPTokenReservesHistory(
    tokenAddress: string,
    chain: ChainType,
    fromTimestamp?: number,
    toTimestamp?: number,
  ): Promise<
    DataResponse<
      {
        timestamp: number;
        reserve0: string;
        reserve1: string;
        totalSupply: string;
        blockNumber: number;
      }[]
    >
  >;

  /**
   * Gets token transfer events for LP tokens (for tracking liquidity changes)
   */
  getLPTokenTransfers(
    tokenAddress: string,
    chain: ChainType,
    fromBlock?: number,
    toBlock?: number,
  ): Promise<
    DataResponse<
      {
        from: string;
        to: string;
        value: string;
        blockNumber: number;
        timestamp: number;
        transactionHash: string;
      }[]
    >
  >;

  /**
   * Health check for subgraph availability
   */
  healthCheck(chain: ChainType): Promise<{
    isHealthy: boolean;
    latency: number;
    lastBlock: number;
    indexingErrors?: string[];
  }>;
}
