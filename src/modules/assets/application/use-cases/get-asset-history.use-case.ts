import { Injectable, Inject } from '@nestjs/common';
import { AssetTransaction } from '../../domain/entities/asset-transaction.entity';
import { AssetMarketplace } from '../../domain/entities/asset-marketplace.entity';
import {
  AssetTransactionRepositoryInterface,
  TransactionSearchFilters,
} from '../../domain/repositories/asset-transaction.repository.interface';
import {
  AssetMarketplaceRepositoryInterface,
  MarketplaceSearchFilters,
} from '../../domain/repositories/asset-marketplace.repository.interface';
import {
  ASSET_TRANSACTION_REPOSITORY,
  ASSET_MARKETPLACE_REPOSITORY,
} from '../../constants';

export interface GetAssetHistoryDto {
  assetId: string;
  includeTransactions?: boolean;
  includeMarketplaceActivity?: boolean;
  limit?: number;
  offset?: number;
}

export interface AssetHistoryResult {
  assetId: string;
  transactions?: AssetTransaction[];
  marketplaceActivity?: AssetMarketplace[];
  statistics: {
    totalTransactions: number;
    totalMarketplaceActivity: number;
    lastActivityDate?: Date;
    volumeTraded: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class GetAssetHistoryUseCase {
  constructor(
    @Inject(ASSET_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: AssetTransactionRepositoryInterface,
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
  ) {}

  async execute(dto: GetAssetHistoryDto): Promise<AssetHistoryResult> {
    const {
      assetId,
      includeTransactions = true,
      includeMarketplaceActivity = true,
      limit = 20,
      offset = 0,
    } = dto;

    const actualLimit = Math.min(limit, 100);
    const page = Math.floor(offset / actualLimit) + 1;

    let transactions: AssetTransaction[] = [];
    let marketplaceActivity: AssetMarketplace[] = [];
    let totalTransactions = 0;
    let totalMarketplaceActivity = 0;

    if (includeTransactions) {
      const transactionFilters: TransactionSearchFilters = {
        assetIds: [assetId],
        limit: actualLimit,
        offset,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      };

      const transactionResult =
        await this.transactionRepository.search(transactionFilters);
      transactions = transactionResult.transactions;
      totalTransactions = transactionResult.total;
    }

    if (includeMarketplaceActivity) {
      const marketplaceFilters: MarketplaceSearchFilters = {
        assetIds: [assetId],
        limit: actualLimit,
        offset,
        sortBy: 'created_at',
        sortOrder: 'desc',
      };

      const marketplaceResult =
        await this.marketplaceRepository.search(marketplaceFilters);
      marketplaceActivity = marketplaceResult.listings;
      totalMarketplaceActivity = marketplaceResult.total;
    }

    const volumeTraded =
      await this.marketplaceRepository.getTotalVolumeByAsset(assetId);

    let lastActivityDate: Date | undefined;
    const lastTransaction = transactions[0];
    const lastMarketplace = marketplaceActivity[0];

    if (lastTransaction && lastMarketplace) {
      lastActivityDate =
        lastTransaction.timestamp > lastMarketplace.createdAt
          ? lastTransaction.timestamp
          : lastMarketplace.createdAt;
    } else if (lastTransaction) {
      lastActivityDate = lastTransaction.timestamp;
    } else if (lastMarketplace) {
      lastActivityDate = lastMarketplace.createdAt;
    }

    const total = Math.max(totalTransactions, totalMarketplaceActivity);
    const totalPages = Math.ceil(total / actualLimit);

    return {
      assetId,
      transactions: includeTransactions ? transactions : undefined,
      marketplaceActivity: includeMarketplaceActivity
        ? marketplaceActivity
        : undefined,
      statistics: {
        totalTransactions,
        totalMarketplaceActivity,
        lastActivityDate,
        volumeTraded,
      },
      pagination: {
        page,
        limit: actualLimit,
        total,
        totalPages,
      },
    };
  }
}
