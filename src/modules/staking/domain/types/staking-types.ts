export enum ChainType {
  BASE = 'base',
  OBELISK = 'obelisk',
}

export enum VaultType {
  SINGLE_TOKEN = 'single_token',
  LP_TOKEN = 'lp_token',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum SeasonStatus {
  INACTIVE = 0,
  ACTIVE = 1,
  ENDED = 2,
}

// Core Position Data from Subgraph
export interface VaultPosition {
  readonly vault: string;
  readonly user: string;
  readonly shares: string; // Raw BigInt as string
  readonly assets: string; // Raw BigInt as string
  readonly blockNumber: number;
  readonly timestamp: number;
  hasBalance?(): boolean; // Optional method for entities
}

// Transaction Data from Subgraph
export interface VaultTransaction {
  readonly id: string;
  readonly vaultAddress: string;
  readonly userAddress: string;
  readonly type: TransactionType;
  readonly assets: string; // Raw BigInt as string
  readonly shares: string; // Raw BigInt as string
  readonly timestamp: number;
  readonly blockNumber: number;
  readonly transactionHash: string;
  readonly status: TransactionStatus;
}

// Staking Transaction (simplified version for user transactions)
export interface StakingTransaction {
  readonly hash: string;
  readonly type: 'deposit' | 'withdrawal';
  readonly vault: string;
  readonly user: string;
  readonly amount: string; // Raw BigInt as string
  readonly shares?: string; // Raw BigInt as string
  readonly timestamp: number;
  readonly blockNumber: number;
  readonly from: string;
  readonly to: string;
  readonly gasPrice?: string;
  readonly gasUsed?: string;
}

// LP Token Data from Subgraph
export interface LPTokenData {
  readonly address: string;
  readonly token0: string;
  readonly token1: string;
  readonly reserve0: string; // Raw BigInt as string
  readonly reserve1: string; // Raw BigInt as string
  readonly totalSupply: string; // Raw BigInt as string
  readonly blockNumber: number;
  readonly timestamp: number;
}

// Token Metadata for Precision Handling
export interface TokenMetadata {
  readonly address: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly isLP: boolean;
  readonly token0?: string; // For LP tokens
  readonly token1?: string; // For LP tokens
  readonly coingeckoId?: string;
}

// Price Data from External APIs
export interface TokenPrice {
  readonly tokenAddress: string;
  readonly symbol: string;
  readonly priceUsd: number;
  readonly change24h?: number;
  readonly lastUpdated: Date;
  readonly source: string;
  readonly isStale: boolean;
}

// Computed LP Token Price
export interface LPTokenPrice {
  readonly lpTokenAddress: string;
  readonly token0: string;
  readonly token1: string;
  readonly token0Symbol: string;
  readonly token1Symbol: string;
  readonly priceUsd: number;
  readonly reserve0: string;
  readonly reserve1: string;
  readonly reserve0Formatted: string;
  readonly reserve1Formatted: string;
  readonly reserve0ValueUsd: number;
  readonly reserve1ValueUsd: number;
  readonly totalLiquidityUsd: number;
  readonly totalSupply: string;
  readonly totalSupplyFormatted: string;
  readonly token0Weight: number;
  readonly token1Weight: number;
  readonly lastUpdated: Date;
  readonly blockNumber: number;
  readonly source: string;
}

// Vault Configuration
export interface VaultConfig {
  readonly address: string;
  readonly name: string;
  readonly symbol: string;
  readonly asset: string;
  readonly type: VaultType;
  readonly chain: ChainType;
  readonly seasonNumber: number;
  readonly isActive: boolean;
  readonly totalAssets: string;
  readonly totalSupply: string;
  readonly depositEnabled: boolean;
  readonly withdrawalEnabled: boolean;
  readonly minimumDeposit: string;
  readonly maximumDeposit: string;
  readonly lockDuration: number;
  readonly aprBase: number;
  readonly tokenConfig: any;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Subgraph Health and Sync Status
export interface SubgraphSyncStatus {
  readonly chainHeadBlock: number;
  readonly latestBlock: number;
  readonly blocksBehind: number;
  readonly isHealthy: boolean;
  readonly lastSyncTime: Date;
  readonly isSyncing: boolean;
}

// Blockchain Event Data (for direct RPC fallback)
export interface BlockchainEvent {
  readonly eventName: string;
  readonly vaultAddress: string;
  readonly blockNumber: number;
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly timestamp: number;
  readonly args: Record<string, any>;
}

// Multi-chain Configuration
export interface ChainConfig {
  readonly chainId: number;
  readonly name: string;
  readonly rpcUrl: string;
  readonly subgraphUrl: string;
  readonly blockExplorerUrl: string;
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
  readonly multicallAddress?: string;
  readonly isTestnet: boolean;
  readonly confirmationsRequired: number;
  readonly avgBlockTimeMs: number;
}

// Price Feed Configuration
export interface PriceFeedConfig {
  readonly provider: string;
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly rateLimitPerMinute: number;
  readonly cacheTtlSeconds: number;
  readonly retryAttempts: number;
  readonly timeoutMs: number;
}

// Precision Handling for Different Token Types
export interface TokenPrecision {
  readonly address: string;
  readonly decimals: number;
  readonly symbol: string;
  readonly rawToDisplay: (raw: string) => string;
  readonly displayToRaw: (display: string) => string;
  readonly formatForDisplay: (raw: string, decimals?: number) => string;
}

// Enhanced Position with Computed Values
export interface EnhancedVaultPosition extends VaultPosition {
  readonly vaultInfo: {
    readonly name: string;
    readonly symbol: string;
    readonly type: VaultType;
    readonly chain: ChainType;
  };
  readonly assetInfo: {
    readonly symbol: string;
    readonly name: string;
    readonly decimals: number;
    readonly isLP: boolean;
  };
  readonly formattedBalances: {
    readonly shares: string;
    readonly assets: string;
  };
  usdValue?: number;
  lpTokenData?: LPTokenData;
}

// Historical TVL Data Point
export interface TVLDataPoint {
  readonly timestamp: number;
  readonly totalAssets: string;
  readonly totalAssetsUsd: number;
  readonly sharePrice: number;
  readonly blockNumber: number;
}

// Vault Analytics Data
export interface VaultAnalytics {
  readonly vaultAddress: string;
  readonly totalValueLocked: string;
  readonly totalValueLockedUsd: number;
  readonly totalShares: string;
  readonly sharePrice: number;
  readonly participantCount: number;
  readonly volume24h: string;
  readonly volume7d: string;
  readonly tvlHistory: TVLDataPoint[];
}

// Error Types for Better Error Handling
export interface StakingError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly timestamp: Date;
  readonly source: 'subgraph' | 'blockchain' | 'price-feed' | 'internal';
}

// Request Parameters for Data Fetching
export interface PositionQueryParams {
  readonly userAddress: string;
  readonly vaultAddress?: string;
  readonly chain?: ChainType;
  readonly includeHistory?: boolean;
  readonly fromBlock?: number;
  readonly toBlock?: number;
}

export interface TransactionQueryParams {
  readonly userAddress?: string;
  readonly vaultAddress?: string;
  readonly chain?: ChainType;
  readonly type?: TransactionType;
  readonly fromTimestamp?: number;
  readonly toTimestamp?: number;
  readonly page?: number;
  readonly limit?: number;
}

// Response Wrappers
export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrevious: boolean;
  };
}

export interface DataResponse<T> {
  readonly data: T;
  readonly metadata: {
    readonly source: 'subgraph' | 'blockchain' | 'cache' | 'alchemy';
    readonly lastUpdated: Date;
    readonly isStale: boolean;
    readonly syncStatus?: SubgraphSyncStatus;
  };
}

// Cache Key Patterns
export interface CacheKey {
  readonly pattern: string;
  readonly ttlSeconds: number;
  readonly namespace: string;
}

// Re-export repository interfaces for convenience
export * from '../repositories/staking-subgraph.repository.interface';
export * from '../repositories/staking-blockchain.repository.interface';
export * from '../repositories/price-feed.repository.interface';

export const CACHE_KEYS = {
  TOKEN_PRICE: {
    pattern: 'price:{tokenAddress}:{chain}',
    ttlSeconds: 300, // 5 minutes
    namespace: 'staking:prices',
  },
  LP_PRICE: {
    pattern: 'lp-price:{lpTokenAddress}:{chain}',
    ttlSeconds: 300, // 5 minutes
    namespace: 'staking:lp-prices',
  },
  TOKEN_METADATA: {
    pattern: 'metadata:{tokenAddress}',
    ttlSeconds: 86400, // 24 hours
    namespace: 'staking:metadata',
  },
  VAULT_CONFIG: {
    pattern: 'vault:config:all',
    ttlSeconds: 1800, // 30 minutes
    namespace: 'staking:config',
  },
  SUBGRAPH_SYNC: {
    pattern: 'sync:status:{chain}',
    ttlSeconds: 60, // 1 minute
    namespace: 'staking:sync',
  },
} as const;
