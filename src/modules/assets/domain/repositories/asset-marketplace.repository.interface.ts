import {
  AssetMarketplace,
  ListingType,
  ListingStatus,
} from '../entities/asset-marketplace.entity';

export interface MarketplaceSearchFilters {
  assetIds?: string[];
  listingTypes?: ListingType[];
  statuses?: ListingStatus[];
  sellerAddresses?: string[];
  buyerAddresses?: string[];
  currencyContracts?: string[];
  priceMin?: string;
  priceMax?: string;
  expiresAfter?: Date;
  expiresBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'price' | 'created_at' | 'updated_at' | 'expires_at';
  sortOrder?: 'asc' | 'desc';
}

export interface AssetMarketplaceRepositoryInterface {
  create(listing: AssetMarketplace): Promise<AssetMarketplace>;
  findById(id: string): Promise<AssetMarketplace | null>;
  findByAsset(assetId: string): Promise<AssetMarketplace[]>;
  findBySeller(sellerAddress: string): Promise<AssetMarketplace[]>;
  findByBuyer(buyerAddress: string): Promise<AssetMarketplace[]>;
  findAll(): Promise<AssetMarketplace[]>;
  update(
    id: string,
    listing: Partial<AssetMarketplace>,
  ): Promise<AssetMarketplace | null>;
  delete(id: string): Promise<boolean>;

  // Advanced search methods
  search(filters: MarketplaceSearchFilters): Promise<{
    listings: AssetMarketplace[];
    total: number;
  }>;

  findActiveListings(): Promise<AssetMarketplace[]>;
  findActiveSales(): Promise<AssetMarketplace[]>;
  findActiveBids(): Promise<AssetMarketplace[]>;
  findExpiredListings(): Promise<AssetMarketplace[]>;

  // Asset-specific marketplace queries
  findActiveSalesForAsset(assetId: string): Promise<AssetMarketplace[]>;
  findActiveBidsForAsset(assetId: string): Promise<AssetMarketplace[]>;
  findBestBidForAsset(assetId: string): Promise<AssetMarketplace | null>;
  findLowestSaleForAsset(assetId: string): Promise<AssetMarketplace | null>;

  // User-specific queries
  findUserActiveSales(sellerAddress: string): Promise<AssetMarketplace[]>;
  findUserActiveBids(buyerAddress: string): Promise<AssetMarketplace[]>;
  findUserCompletedTransactions(address: string): Promise<AssetMarketplace[]>;

  // Bulk operations
  createMany(listings: AssetMarketplace[]): Promise<AssetMarketplace[]>;
  markAsExpired(ids: string[]): Promise<boolean>;
  cancelListings(ids: string[]): Promise<boolean>;

  // Statistics
  countActiveSales(): Promise<number>;
  countActiveBids(): Promise<number>;
  getTotalVolumeByAsset(assetId: string): Promise<string>;
  getTotalVolumeByUser(address: string): Promise<string>;
  getAveragePriceByAsset(assetId: string): Promise<string | null>;
}
