import {
  VaultPosition,
  LPTokenData,
  TokenMetadata,
  ChainType,
  BlockchainEvent,
  SeasonStatus,
} from '../types/staking-types';

export interface IStakingBlockchainRepository {
  /**
   * Gets current block number from RPC
   */
  getCurrentBlock(chain: ChainType): Promise<number>;

  /**
   * Gets block timestamp for a specific block
   */
  getBlockTimestamp(blockNumber: number, chain: ChainType): Promise<number>;

  /**
   * Gets vault position directly from contract
   */
  getVaultPosition(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<VaultPosition | null>;

  /**
   * Gets multiple vault positions for a user
   */
  getUserVaultPositions(
    userAddress: string,
    vaultAddresses: string[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<VaultPosition[]>;

  /**
   * Gets vault total assets and shares
   */
  getVaultTotals(
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<{
    totalAssets: string;
    totalSupply: string;
    sharePrice: string;
  }>;

  /**
   * Gets token metadata including decimals
   */
  getTokenMetadata(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenMetadata>;

  /**
   * Gets multiple tokens metadata
   */
  getMultipleTokensMetadata(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenMetadata[]>;

  /**
   * Gets LP token data directly from contract
   */
  getLPTokenData(
    tokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<LPTokenData>;

  /**
   * Gets multiple LP tokens data
   */
  getMultipleLPTokensData(
    tokenAddresses: string[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<LPTokenData[]>;

  /**
   * Gets vault season status
   */
  getVaultSeasonStatus(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<SeasonStatus>;

  /**
   * Checks if mainnet is launched for a vault
   */
  isMainnetLaunched(vaultAddress: string, chain: ChainType): Promise<boolean>;

  /**
   * Gets vault configuration from contract
   */
  getVaultConfig(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<{
    asset: string;
    name: string;
    symbol: string;
    decimals: number;
    minDepositAmount: string;
    minShareAmount: string;
  }>;

  /**
   * Gets pending withdrawals for a user
   */
  getUserPendingWithdrawals(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<
    {
      withdrawalId: number;
      shares: string;
      assets: string;
      requestTime: number;
      unlockTime: number;
      finalized: boolean;
    }[]
  >;

  /**
   * Gets events from blockchain for a specific block range
   */
  getVaultEvents(
    vaultAddress: string,
    fromBlock: number,
    toBlock: number,
    chain: ChainType,
    eventNames?: string[],
  ): Promise<BlockchainEvent[]>;

  /**
   * Gets specific transaction receipt and parse vault events
   */
  getTransactionVaultEvents(
    transactionHash: string,
    chain: ChainType,
  ): Promise<BlockchainEvent[]>;

  /**
   * Converts shares to assets for a vault
   */
  convertSharesToAssets(
    shares: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<string>;

  /**
   * Converts assets to shares for a vault
   */
  convertAssetsToShares(
    assets: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<string>;

  /**
   * Calculates max redeem amount for a user
   */
  getMaxRedeem(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<string>;

  /**
   * Calculates max withdraw amount for a user
   */
  getMaxWithdraw(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<string>;

  /**
   * Gets user's underlying token balance (not in vault)
   */
  getUserTokenBalance(
    userAddress: string,
    tokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<string>;

  /**
   * Gets multiple users' token balances
   */
  getMultipleUsersTokenBalances(
    userAddresses: string[],
    tokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<Map<string, string>>;

  /**
   * Validates if an address is a valid vault contract
   */
  isValidVault(vaultAddress: string, chain: ChainType): Promise<boolean>;

  /**
   * Validates if an address is a valid LP token contract
   */
  isValidLPToken(tokenAddress: string, chain: ChainType): Promise<boolean>;

  /**
   * Gets the underlying asset address for a vault
   */
  getVaultAsset(vaultAddress: string, chain: ChainType): Promise<string>;

  /**
   * Gets LP token component tokens (token0, token1)
   */
  getLPTokenComponents(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<{
    token0: string;
    token1: string;
  }>;

  /**
   * Estimates gas for vault operations
   */
  estimateVaultOperationGas(
    operation: 'deposit' | 'withdraw' | 'redeem',
    vaultAddress: string,
    amount: string,
    userAddress: string,
    chain: ChainType,
  ): Promise<string>;

  /**
   * Checks if withdrawals are allowed for a vault
   */
  areWithdrawalsAllowed(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<boolean>;

  /**
   * Gets vault lock information for a user
   */
  getUserLockInfo(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<{
    depositTime: number;
    totalLockDuration: number;
    lastUpdateTime: number;
  } | null>;

  /**
   * Batch call multiple contract functions in a single RPC call
   */
  batchCall(
    calls: {
      target: string;
      callData: string;
      allowFailure?: boolean;
    }[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<
    {
      success: boolean;
      returnData: string;
    }[]
  >;

  /**
   * Health check for RPC endpoint
   */
  healthCheck(chain: ChainType): Promise<{
    isHealthy: boolean;
    latency: number;
    blockNumber: number;
    chainId: number;
  }>;
}
