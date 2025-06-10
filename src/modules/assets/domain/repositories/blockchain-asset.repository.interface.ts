import { BlockchainAsset } from '../entities/blockchain-asset.entity';

export interface AssetSearchFilters {
  ownerAddresses?: string[];
  contractIds?: string[];
  contractAddresses?: string[];
  tokenIds?: string[];
  hasBalance?: boolean;
  metadata?: Record<string, any>;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'balance';
  sortOrder?: 'asc' | 'desc';
}

export interface BlockchainAssetRepositoryInterface {
  create(asset: BlockchainAsset): Promise<BlockchainAsset>;
  findById(id: string): Promise<BlockchainAsset | null>;
  findByContractAndToken(
    contractId: string,
    tokenId?: string,
  ): Promise<BlockchainAsset | null>;
  findByOwner(ownerAddress: string): Promise<BlockchainAsset[]>;
  findByContract(contractId: string): Promise<BlockchainAsset[]>;
  findAll(): Promise<BlockchainAsset[]>;
  update(
    id: string,
    asset: Partial<BlockchainAsset>,
  ): Promise<BlockchainAsset | null>;
  delete(id: string): Promise<boolean>;

  // Advanced search methods
  search(filters: AssetSearchFilters): Promise<{
    assets: BlockchainAsset[];
    total: number;
  }>;

  findByOwnerAndContract(
    ownerAddress: string,
    contractId: string,
  ): Promise<BlockchainAsset[]>;
  findByMetadata(metadata: Record<string, any>): Promise<BlockchainAsset[]>;
  findWithBalance(): Promise<BlockchainAsset[]>;

  // Bulk operations (max 100 items per batch)
  createMany(assets: BlockchainAsset[]): Promise<BlockchainAsset[]>;
  updateBalances(
    updates: Array<{ id: string; balance: string; blockNumber: string }>,
  ): Promise<boolean>;
  updateOwners(
    updates: Array<{ id: string; ownerAddress: string; blockNumber: string }>,
  ): Promise<boolean>;

  // Statistics
  countByOwner(ownerAddress: string): Promise<number>;
  countByContract(contractId: string): Promise<number>;
  getTotalValueByOwner(ownerAddress: string): Promise<string>;
}
