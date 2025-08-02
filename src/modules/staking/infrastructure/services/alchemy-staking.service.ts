import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network } from 'alchemy-sdk';
import { ethers, getAddress } from 'ethers';
import {
  IStakingSubgraphRepository,
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
  TransactionStatus,
} from '../../domain/types/staking-types';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { VaultTransaction as VaultTransactionEntity } from '../../domain/entities/vault-transaction.entity';

interface AlchemyConfig {
  [ChainType.BASE]: {
    network: Network;
    apiKey: string;
  };
  [ChainType.OBELISK]: {
    network: Network;
    apiKey: string;
  };
}

interface VaultEventLog {
  transactionHash: string;
  blockNumber: number;
  address: string;
  topics: string[];
  data: string;
  timestamp?: number;
}

interface ParsedVaultEvent {
  type: 'deposit' | 'withdrawal';
  user: string;
  vault: string;
  assets: string;
  shares: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
}

@Injectable()
export class AlchemyStakingService implements IStakingSubgraphRepository {
  private readonly logger = new Logger(AlchemyStakingService.name);
  private readonly alchemyClients: Map<ChainType, Alchemy> = new Map();
  private readonly providers: Map<ChainType, ethers.JsonRpcProvider> =
    new Map();
  private readonly config: AlchemyConfig;

  private readonly VAULT_ABI = [
    'event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)',
    'event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
    'function balanceOf(address account) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function totalAssets() view returns (uint256)',
    'function convertToAssets(uint256 shares) view returns (uint256)',
    'function pricePerShare() view returns (uint256)',
  ];

  constructor(private readonly configService: ConfigService) {
    this.config = {
      [ChainType.BASE]: {
        network: this.getAlchemyNetwork(ChainType.BASE),
        apiKey: this.configService.get<string>('ALCHEMY_API_KEY_BASE', ''),
      },
      [ChainType.OBELISK]: {
        network: this.getAlchemyNetwork(ChainType.OBELISK),
        apiKey: this.configService.get<string>('ALCHEMY_API_KEY_OBELISK', ''),
      },
    };

    this.initializeAlchemyClients();
  }

  private getAlchemyNetwork(chain: ChainType): Network {
    switch (chain) {
      case ChainType.BASE:
        return this.configService.get<string>('NODE_ENV') === 'production'
          ? Network.BASE_MAINNET
          : Network.BASE_SEPOLIA;
      case ChainType.OBELISK:
        return Network.BASE_SEPOLIA;
      default:
        throw new Error(`Unsupported chain: ${String(chain)}`);
    }
  }

  private getAlchemyUrl(chain: ChainType, apiKey: string): string {
    const network = this.getAlchemyNetwork(chain);
    switch (network) {
      case Network.BASE_MAINNET:
        return `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
      case Network.BASE_SEPOLIA:
        return `https://base-sepolia.g.alchemy.com/v2/${apiKey}`;
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  private initializeAlchemyClients(): void {
    Object.entries(this.config).forEach(([chain, config]) => {
      if (!config.apiKey) {
        this.logger.warn(`No Alchemy API key provided for ${chain}`);
        return;
      }

      const client = new Alchemy({
        apiKey: config.apiKey,
        network: config.network,
      });

      this.alchemyClients.set(chain as ChainType, client);

      // Create a JsonRpcProvider with Alchemy URL
      const alchemyUrl = this.getAlchemyUrl(chain as ChainType, config.apiKey);
      const provider = new ethers.JsonRpcProvider(alchemyUrl, 84532); // Base Sepolia chainId

      // Override resolveName to prevent ENS lookups
      provider.resolveName = async (name: string) => {
        // Just return the input if it's already an address
        if (ethers.isAddress(name)) {
          return name;
        }
        // Return null for any ENS names
        return null;
      };

      this.providers.set(chain as ChainType, provider);

      this.logger.log(`Initialized Alchemy client for ${chain}`);
    });
  }

  async getSyncStatus(chain: ChainType): Promise<SubgraphSyncStatus> {
    const client = this.getClient(chain);

    try {
      const latestBlock = await client.core.getBlockNumber();
      const blockDetails = await client.core.getBlock(latestBlock);

      return {
        chainHeadBlock: latestBlock,
        latestBlock: latestBlock,
        blocksBehind: 0,
        isHealthy: true,
        lastSyncTime: new Date(blockDetails.timestamp * 1000),
        isSyncing: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync status for ${chain}:`, error);
      throw new Error(`Chain sync status unavailable for ${chain}`);
    }
  }

  async getUserPositions(
    params: PositionQueryParams,
  ): Promise<DataResponse<VaultPosition[]>> {
    const {
      userAddress,
      vaultAddress,
      chain = ChainType.BASE,
      fromBlock,
      toBlock,
    } = params;

    const client = this.getClient(chain);

    try {
      let vaultAddresses: string[];

      if (vaultAddress) {
        vaultAddresses = [vaultAddress];
      } else {
        vaultAddresses = await this.getKnownVaultAddresses(chain);
      }

      const positions: VaultPosition[] = [];

      for (const vault of vaultAddresses) {
        const position = await this.getUserVaultPosition(
          client,
          chain,
          userAddress,
          vault,
        );

        if (position && position.hasBalance && position.hasBalance()) {
          positions.push(position);
        }
      }

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: positions,
        metadata: {
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user positions for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to fetch user positions from Alchemy`);
    }
  }

  async getVaultPositions(
    vaultAddress: string,
    chain: ChainType,
    limit: number = 100,
    offset: number = 0,
  ): Promise<DataResponse<PaginatedResponse<VaultPosition>>> {
    const client = this.getClient(chain);

    try {
      const transferEvents = await this.getVaultTransferEvents(
        client,
        vaultAddress,
        'earliest',
        'latest',
      );

      const uniqueHolders = new Set<string>();
      transferEvents.forEach((event) => {
        const decoded = this.decodeTransferEvent(event);
        if (decoded.to !== ethers.ZeroAddress) {
          uniqueHolders.add(decoded.to);
        }
      });

      const positions: VaultPosition[] = [];
      const holdersArray = Array.from(uniqueHolders).slice(
        offset,
        offset + limit,
      );

      for (const holder of holdersArray) {
        const position = await this.getUserVaultPosition(
          client,
          chain,
          holder,
          vaultAddress,
        );

        if (position && position.hasBalance && position.hasBalance()) {
          positions.push(position);
        }
      }

      const total = uniqueHolders.size;
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
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vault positions for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to fetch vault positions from Alchemy`);
    }
  }

  async getTransactions(
    params: TransactionQueryParams,
  ): Promise<DataResponse<PaginatedResponse<VaultTransaction>>> {
    const {
      userAddress,
      vaultAddress,
      chain = ChainType.BASE,
      type,
      fromTimestamp,
      toTimestamp,
      page = 1,
      limit = 20,
    } = params;

    const client = this.getClient(chain);

    try {
      const events = await this.getVaultEvents(
        client,
        vaultAddress,
        userAddress,
        fromTimestamp,
        toTimestamp,
      );

      let filteredEvents = events;
      if (type) {
        filteredEvents = events.filter((event) => event.type === type);
      }

      const offset = (page - 1) * limit;
      const paginatedEvents = filteredEvents.slice(offset, offset + limit);

      const transactions = await Promise.all(
        paginatedEvents.map(async (event) => {
          const txReceipt = await client.core.getTransactionReceipt(
            event.transactionHash,
          );

          return VaultTransactionEntity.fromSubgraphData({
            id: `${event.transactionHash}-${event.user}`,
            vault: event.vault,
            user: event.user,
            type: event.type,
            assets: event.assets,
            shares: event.shares,
            timestamp: event.timestamp,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            status:
              txReceipt?.status === 1
                ? TransactionStatus.CONFIRMED
                : TransactionStatus.FAILED,
          });
        }),
      );

      const total = filteredEvents.length;
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
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get transactions:`, error);
      throw new Error(`Failed to fetch transactions from Alchemy`);
    }
  }

  async getTransaction(
    transactionId: string,
    chain: ChainType,
  ): Promise<DataResponse<VaultTransaction | null>> {
    const client = this.getClient(chain);

    try {
      const [txHash] = transactionId.split('-');
      const txReceipt = await client.core.getTransactionReceipt(txHash);

      if (!txReceipt) {
        return {
          data: null,
          metadata: {
            source: 'alchemy',
            lastUpdated: new Date(),
            isStale: false,
          },
        };
      }

      const vaultEvents = await this.parseTransactionVaultEvents(
        client,
        txReceipt,
      );

      const targetEvent = vaultEvents.find(
        (event) => `${event.transactionHash}-${event.user}` === transactionId,
      );

      if (!targetEvent) {
        return {
          data: null,
          metadata: {
            source: 'alchemy',
            lastUpdated: new Date(),
            isStale: false,
          },
        };
      }

      const transaction = VaultTransactionEntity.fromSubgraphData({
        id: transactionId,
        vault: targetEvent.vault,
        user: targetEvent.user,
        type: targetEvent.type,
        assets: targetEvent.assets,
        shares: targetEvent.shares,
        timestamp: targetEvent.timestamp,
        blockNumber: targetEvent.blockNumber,
        transactionHash: targetEvent.transactionHash,
        status:
          txReceipt?.status === 1
            ? TransactionStatus.CONFIRMED
            : TransactionStatus.FAILED,
      });

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: transaction,
        metadata: {
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction ${transactionId}:`, error);
      throw new Error(`Failed to fetch transaction from Alchemy`);
    }
  }

  private async getUserVaultPosition(
    client: Alchemy,
    chain: ChainType,
    userAddress: string,
    vaultAddress: string,
  ): Promise<VaultPosition | null> {
    try {
      const currentBlock = await client.core.getBlockNumber();
      const blockDetails = await client.core.getBlock(currentBlock);

      this.logger.log(
        `Creating contract for vault: ${vaultAddress} on chain: ${chain}`,
      );

      if (!vaultAddress || vaultAddress === '0' || vaultAddress === '0x0') {
        this.logger.error(`Invalid vault address: ${vaultAddress}`);
        return null;
      }

      const contract = new ethers.Contract(
        vaultAddress,
        this.VAULT_ABI,
        this.getProvider(chain),
      );

      const checksummedUserAddress = getAddress(userAddress);
      const [shares, assets] = await Promise.all([
        contract.balanceOf(checksummedUserAddress),
        contract.convertToAssets(
          await contract.balanceOf(checksummedUserAddress),
        ),
      ]);

      if (shares.toString() === '0') {
        return null;
      }

      return VaultPositionEntity.fromSubgraphData({
        vault: vaultAddress,
        user: checksummedUserAddress,
        shares: shares.toString(),
        assets: assets.toString(),
        blockNumber: currentBlock,
        timestamp: blockDetails.timestamp,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get position for ${userAddress} in ${vaultAddress}:`,
        error,
      );
      return null;
    }
  }

  private async getVaultEvents(
    client: Alchemy,
    vaultAddress?: string,
    userAddress?: string,
    fromTimestamp?: number,
    toTimestamp?: number,
  ): Promise<ParsedVaultEvent[]> {
    // Get the actual block numbers
    const latestBlock = await client.core.getBlockNumber();

    // Default to last 7 days if no timestamp provided to avoid scanning too many blocks
    const defaultFromTimestamp =
      fromTimestamp || Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    let fromBlock = await this.getBlockByTimestamp(
      client,
      defaultFromTimestamp,
    );
    const toBlock = toTimestamp
      ? await this.getBlockByTimestamp(client, toTimestamp)
      : latestBlock;

    const topics: (string | null)[] = [];
    if (userAddress) {
      const checksummedUserAddress = getAddress(userAddress);
      topics.push(null, ethers.zeroPadValue(checksummedUserAddress, 32));
    }

    // Alchemy has a limit of 500 blocks per request
    const BLOCK_CHUNK_SIZE = 500;
    const MAX_BLOCKS_TO_SCAN = 10000; // Limit to avoid extremely long queries
    const allLogs: VaultEventLog[] = [];

    // Limit the range to avoid scanning too many blocks
    const blocksToScan = toBlock - fromBlock + 1;
    if (blocksToScan > MAX_BLOCKS_TO_SCAN) {
      this.logger.warn(
        `Block range too large (${blocksToScan} blocks). Limiting to last ${MAX_BLOCKS_TO_SCAN} blocks`,
      );
      fromBlock = Math.max(0, toBlock - MAX_BLOCKS_TO_SCAN + 1);
    }

    // Process in chunks of 500 blocks
    this.logger.log(
      `Scanning blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`,
    );

    for (
      let startBlock = fromBlock;
      startBlock <= toBlock;
      startBlock += BLOCK_CHUNK_SIZE
    ) {
      const endBlock = Math.min(startBlock + BLOCK_CHUNK_SIZE - 1, toBlock);

      this.logger.debug(`Processing blocks ${startBlock} to ${endBlock}`);

      try {
        const [depositLogs, withdrawalLogs] = await Promise.all([
          client.core.getLogs({
            address: vaultAddress,
            topics: [
              ethers.id('Deposit(address,address,uint256,uint256)'),
              ...topics,
            ],
            fromBlock: startBlock,
            toBlock: endBlock,
          }),
          client.core.getLogs({
            address: vaultAddress,
            topics: [
              ethers.id('Withdraw(address,address,address,uint256,uint256)'),
              ...topics,
            ],
            fromBlock: startBlock,
            toBlock: endBlock,
          }),
        ]);

        allLogs.push(...depositLogs, ...withdrawalLogs);
      } catch (error) {
        this.logger.warn(
          `Failed to get logs for blocks ${startBlock}-${endBlock}:`,
          error,
        );
        // Continue with next chunk even if one fails
      }
    }

    const eventsWithTimestamp = await Promise.all(
      allLogs.map(async (log) => {
        const block = await client.core.getBlock(log.blockNumber);
        return { ...log, timestamp: block.timestamp };
      }),
    );

    return eventsWithTimestamp
      .map((log) => this.parseVaultEvent(log))
      .filter((event): event is ParsedVaultEvent => event !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private parseVaultEvent(log: VaultEventLog): ParsedVaultEvent | null {
    try {
      const iface = new ethers.Interface(this.VAULT_ABI);
      const parsed = iface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      if (!parsed) return null;

      if (parsed && parsed.name === 'Deposit') {
        return {
          type: 'deposit',
          user: parsed.args.owner,
          vault: log.address,
          assets: parsed.args.assets.toString(),
          shares: parsed.args.shares.toString(),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: log.timestamp || 0,
        };
      }

      if (parsed && parsed.name === 'Withdraw') {
        return {
          type: 'withdrawal',
          user: parsed.args.owner,
          vault: log.address,
          assets: parsed.args.assets.toString(),
          shares: parsed.args.shares.toString(),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: log.timestamp || 0,
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to parse vault event:`, error);
      return null;
    }
  }

  private getClient(chain: ChainType): Alchemy {
    const client = this.alchemyClients.get(chain);
    if (!client) {
      throw new Error(`No Alchemy client configured for chain: ${chain}`);
    }
    return client;
  }

  private getProvider(chain: ChainType): ethers.JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Provider not initialized for chain ${chain}`);
    }
    return provider;
  }

  private async getKnownVaultAddresses(chain: ChainType): Promise<string[]> {
    const addresses = this.configService.get<string>(
      `KNOWN_VAULT_ADDRESSES_${chain}`,
      '',
    );

    if (!addresses) {
      this.logger.warn(
        `No known vault addresses configured for chain ${chain}`,
      );
      return [];
    }

    return addresses
      .split(',')
      .map((addr) => addr.trim())
      .filter((addr) => addr);
  }

  private async getBlockByTimestamp(
    client: Alchemy,
    timestamp: number,
  ): Promise<number> {
    const latestBlock = await client.core.getBlockNumber();

    // Get the latest block to estimate block time
    const latestBlockData = await client.core.getBlock(latestBlock);
    const currentTimestamp = latestBlockData.timestamp;

    // If target timestamp is in the future, return latest block
    if (timestamp >= currentTimestamp) {
      return latestBlock;
    }

    // Estimate starting block based on average block time (2 seconds on Base)
    const secondsDiff = currentTimestamp - timestamp;
    const estimatedBlocksDiff = Math.floor(secondsDiff / 2);
    const estimatedStartBlock = Math.max(0, latestBlock - estimatedBlocksDiff);

    // Start binary search from a closer range
    let low = Math.max(0, estimatedStartBlock - 1000); // Add some buffer
    let high = Math.min(latestBlock, estimatedStartBlock + 1000);

    // First, check if we need to expand the range
    const lowBlock = await client.core.getBlock(low);
    const highBlock = await client.core.getBlock(high);

    if (lowBlock.timestamp > timestamp) {
      low = 0;
    }
    if (highBlock.timestamp < timestamp) {
      high = latestBlock;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = await client.core.getBlock(mid);

      if (Math.abs(block.timestamp - timestamp) <= 60) {
        // Close enough (within 1 minute)
        return mid;
      } else if (block.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return high;
  }

  private async getVaultTransferEvents(
    client: Alchemy,
    vaultAddress: string,
    fromBlock: string | number,
    toBlock: string | number,
  ): Promise<VaultEventLog[]> {
    return client.core.getLogs({
      address: vaultAddress,
      topics: [ethers.id('Transfer(address,address,uint256)')],
      fromBlock,
      toBlock,
    });
  }

  private decodeTransferEvent(log: VaultEventLog): {
    from: string;
    to: string;
    value: string;
  } {
    const iface = new ethers.Interface([
      'event Transfer(address from, address to, uint256 value)',
    ]);
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });

    if (!parsed) {
      throw new Error('Failed to parse Transfer event');
    }

    return {
      from: parsed.args.from,
      to: parsed.args.to,
      value: parsed.args.value.toString(),
    };
  }

  private async parseTransactionVaultEvents(
    client: Alchemy,
    txReceipt: any,
  ): Promise<ParsedVaultEvent[]> {
    const block = await client.core.getBlock(txReceipt.blockNumber);

    return txReceipt.logs
      .map((log: any) =>
        this.parseVaultEvent({ ...log, timestamp: block.timestamp }),
      )
      .filter(
        (event: ParsedVaultEvent | null): event is ParsedVaultEvent =>
          event !== null,
      );
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

  async getUserTransactions(params: {
    userAddress: string;
    chain: ChainType;
    limit?: number;
    offset?: number;
  }): Promise<DataResponse<StakingTransaction[]>> {
    const { userAddress, chain, limit = 100, offset = 0 } = params;
    const client = this.getClient(chain);

    try {
      const vaultAddresses = await this.getKnownVaultAddresses(chain);
      const allTransactions: StakingTransaction[] = [];

      for (const vaultAddress of vaultAddresses) {
        const events = await this.getVaultEvents(
          client,
          vaultAddress,
          userAddress,
        );

        const transactions = events.map((event) => ({
          hash: event.transactionHash,
          type: event.type,
          vault: event.vault,
          user: event.user,
          amount: event.assets,
          shares: event.shares,
          timestamp: event.timestamp,
          blockNumber: event.blockNumber,
          from: event.type === 'deposit' ? event.user : event.vault,
          to: event.type === 'deposit' ? event.vault : event.user,
        }));

        allTransactions.push(...transactions);
      }

      allTransactions.sort((a, b) => b.timestamp - a.timestamp);
      const paginatedTransactions = allTransactions.slice(
        offset,
        offset + limit,
      );

      const syncStatus = await this.getSyncStatus(chain);

      return {
        data: paginatedTransactions,
        metadata: {
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user transactions for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to fetch user transactions from Alchemy`);
    }
  }

  async getLPTokenData(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<DataResponse<LPTokenData | null>> {
    const client = this.getClient(chain);

    try {
      // For LP tokens, we'd need to interact with the LP contract
      // For now, return mock data as implementing full LP logic is complex
      const mockLPData: LPTokenData = {
        address: tokenAddress,
        token0: '0x0000000000000000000000000000000000000000',
        token1: '0x0000000000000000000000000000000000000000',
        reserve0: '0',
        reserve1: '0',
        totalSupply: '0',
        blockNumber: await client.core.getBlockNumber(),
        timestamp: Math.floor(Date.now() / 1000),
      };

      return {
        data: mockLPData,
        metadata: {
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: false,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get LP token data:', error);
      return {
        data: null,
        metadata: {
          source: 'alchemy',
          lastUpdated: new Date(),
          isStale: true,
        },
      };
    }
  }

  async getMultipleLPTokensData(): Promise<DataResponse<LPTokenData[]>> {
    throw new Error(
      'Multiple LP tokens data method not implemented for Alchemy service',
    );
  }

  async getVaultAnalytics(): Promise<DataResponse<VaultAnalytics>> {
    throw new Error(
      'Vault analytics method not implemented for Alchemy service',
    );
  }

  async getVaultTVLHistory(): Promise<TVLDataPoint[]> {
    // For now, return empty array as historical data requires event indexing
    // In production, this would query historical events or use a dedicated indexing service
    return [];
  }

  async getEcosystemStats(): Promise<
    DataResponse<{
      totalValueLocked: string;
      totalValueLockedUsd: number;
      totalVaults: number;
      totalParticipants: number;
      volume24h: string;
      volume7d: string;
    }>
  > {
    throw new Error(
      'Ecosystem stats method not implemented for Alchemy service',
    );
  }

  async getCurrentBlock(chain: ChainType): Promise<number> {
    const client = this.getClient(chain);
    return client.core.getBlockNumber();
  }

  async getLatestTransactions(
    chain: ChainType,
    limit: number = 10,
  ): Promise<DataResponse<VaultTransaction[]>> {
    const response = await this.getTransactions({ chain, page: 1, limit });
    return {
      data: response.data.data,
      metadata: response.metadata,
    };
  }

  async searchUserPositions(): Promise<DataResponse<VaultPosition[]>> {
    throw new Error(
      'Search user positions method not implemented for Alchemy service',
    );
  }

  async getPositionChanges(): Promise<DataResponse<VaultPosition[]>> {
    throw new Error(
      'Position changes method not implemented for Alchemy service',
    );
  }

  async getLPTokenReservesHistory(): Promise<
    DataResponse<
      {
        timestamp: number;
        reserve0: string;
        reserve1: string;
        totalSupply: string;
        blockNumber: number;
      }[]
    >
  > {
    throw new Error(
      'LP token reserves history method not implemented for Alchemy service',
    );
  }

  async getLPTokenTransfers(): Promise<
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
  > {
    throw new Error(
      'LP token transfers method not implemented for Alchemy service',
    );
  }

  async healthCheck(chain: ChainType): Promise<{
    isHealthy: boolean;
    latency: number;
    lastBlock: number;
    indexingErrors?: string[];
  }> {
    const startTime = Date.now();
    const client = this.getClient(chain);

    try {
      const latestBlock = await client.core.getBlockNumber();
      const latency = Date.now() - startTime;

      return {
        isHealthy: true,
        latency,
        lastBlock: latestBlock,
        indexingErrors: [],
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

  async getVaultsTVL(
    chain: ChainType,
    vaultAddresses: string[],
  ): Promise<Record<string, { totalAssets: string; sharePrice: number }>> {
    const result: Record<string, { totalAssets: string; sharePrice: number }> =
      {};

    try {
      for (const vaultAddress of vaultAddresses) {
        const contract = new ethers.Contract(
          vaultAddress,
          this.VAULT_ABI,
          this.getProvider(chain),
        );

        try {
          const [totalAssets, pricePerShare] = await Promise.all([
            contract.totalAssets(),
            contract.pricePerShare().catch(() => ethers.parseEther('1')),
          ]);

          result[vaultAddress.toLowerCase()] = {
            totalAssets: totalAssets.toString(),
            sharePrice: parseFloat(ethers.formatEther(pricePerShare)),
          };
        } catch (error) {
          this.logger.warn(
            `Failed to get TVL for vault ${vaultAddress}:`,
            error,
          );
          result[vaultAddress.toLowerCase()] = {
            totalAssets: '0',
            sharePrice: 1,
          };
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get vaults TVL:', error);
      throw new Error(`Failed to fetch vaults TVL from Alchemy`);
    }
  }

  async getVolume24h(): Promise<number> {
    // For now, return 0 as we need historical event data to calculate volume
    // This would require more complex implementation with event filtering
    return 0;
  }

  async getVolume7d(): Promise<number> {
    throw new Error('Volume 7d method not implemented for Alchemy service');
  }

  async getVaultData(chain: ChainType, vaultAddress: string): Promise<any> {
    try {
      this.logger.log(
        `Creating contract for vault: ${vaultAddress} on chain: ${chain}`,
      );

      if (!vaultAddress || vaultAddress === '0' || vaultAddress === '0x0') {
        this.logger.error(`Invalid vault address: ${vaultAddress}`);
        return null;
      }

      const contract = new ethers.Contract(
        vaultAddress,
        this.VAULT_ABI,
        this.getProvider(chain),
      );

      // Get basic vault data
      const [totalAssets, totalSupply, pricePerShare] = await Promise.all([
        contract.totalAssets().catch(() => ethers.parseEther('0')),
        contract.totalSupply().catch(() => ethers.parseEther('0')),
        contract.pricePerShare
          ? contract.pricePerShare().catch(() => ethers.parseEther('1'))
          : Promise.resolve(ethers.parseEther('1')),
      ]);

      return {
        address: vaultAddress.toLowerCase(),
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        pricePerShare: pricePerShare.toString(),
        chain,
      };
    } catch (error) {
      this.logger.error(`Failed to get vault data for ${vaultAddress}:`, error);
      // Return default values on error to avoid breaking the endpoint
      return {
        address: vaultAddress.toLowerCase(),
        totalAssets: '0',
        totalSupply: '0',
        pricePerShare: ethers.parseEther('1').toString(),
        chain,
      };
    }
  }

  async getVaultVolumeHistory(): Promise<any[]> {
    // For now, return empty array as volume history requires event indexing
    // In production, this would query historical deposit/withdraw events
    return [];
  }

  async getVaultHistoricalStats(): Promise<{
    totalDeposits: number;
    totalWithdrawals: number;
    highestTVL: number;
  }> {
    // For now, return default values
    // In production, this would aggregate historical event data
    return {
      totalDeposits: 0,
      totalWithdrawals: 0,
      highestTVL: 0,
    };
  }

  async getUserPosition(
    chain: ChainType,
    vaultAddress: string,
    walletAddress: string,
  ): Promise<VaultPosition | null> {
    const client = this.getClient(chain);

    try {
      const position = await this.getUserVaultPosition(
        client,
        chain,
        walletAddress,
        vaultAddress,
      );

      return position && position.hasBalance && position.hasBalance()
        ? position
        : null;
    } catch (error) {
      this.logger.error(`Failed to get user position:`, error);
      return null;
    }
  }
}
