import {
  AssetTransaction,
  TransactionEventType,
} from '../entities/asset-transaction.entity';

export interface TransactionSearchFilters {
  assetIds?: string[];
  transactionHashes?: string[];
  blockNumbers?: string[];
  eventTypes?: TransactionEventType[];
  fromAddresses?: string[];
  toAddresses?: string[];
  involvedAddresses?: string[]; // Either from or to
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'block_number' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface AssetTransactionRepositoryInterface {
  create(transaction: AssetTransaction): Promise<AssetTransaction>;
  findById(id: string): Promise<AssetTransaction | null>;
  findByTransactionHash(hash: string): Promise<AssetTransaction[]>;
  findByAsset(assetId: string): Promise<AssetTransaction[]>;
  findByAddress(address: string): Promise<AssetTransaction[]>;
  findAll(): Promise<AssetTransaction[]>;
  update(
    id: string,
    transaction: Partial<AssetTransaction>,
  ): Promise<AssetTransaction | null>;
  delete(id: string): Promise<boolean>;

  // Advanced search methods
  search(filters: TransactionSearchFilters): Promise<{
    transactions: AssetTransaction[];
    total: number;
  }>;

  findByEventType(eventType: TransactionEventType): Promise<AssetTransaction[]>;
  findByBlockRange(
    fromBlock: string,
    toBlock: string,
  ): Promise<AssetTransaction[]>;
  findByDateRange(from: Date, to: Date): Promise<AssetTransaction[]>;

  // Bulk operations
  createMany(transactions: AssetTransaction[]): Promise<AssetTransaction[]>;

  // Statistics
  countByAsset(assetId: string): Promise<number>;
  countByAddress(address: string): Promise<number>;
  countByEventType(eventType: TransactionEventType): Promise<number>;
  getLatestByAsset(assetId: string): Promise<AssetTransaction | null>;
  getLatestByAddress(address: string): Promise<AssetTransaction | null>;
}
