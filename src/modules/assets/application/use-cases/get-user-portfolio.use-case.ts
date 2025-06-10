import { Injectable, Inject } from '@nestjs/common';
import { BlockchainAsset } from '../../domain/entities/blockchain-asset.entity';
import { AssetTransaction } from '../../domain/entities/asset-transaction.entity';
import { AssetMarketplace } from '../../domain/entities/asset-marketplace.entity';
import { BlockchainAssetRepositoryInterface } from '../../domain/repositories/blockchain-asset.repository.interface';
import { AssetTransactionRepositoryInterface } from '../../domain/repositories/asset-transaction.repository.interface';
import { AssetMarketplaceRepositoryInterface } from '../../domain/repositories/asset-marketplace.repository.interface';
import {
  BLOCKCHAIN_ASSET_REPOSITORY,
  ASSET_TRANSACTION_REPOSITORY,
  ASSET_MARKETPLACE_REPOSITORY,
} from '../../constants';

export interface UserPortfolioDto {
  ownerAddress: string;
  includeTransactions?: boolean;
  includeActiveListings?: boolean;
  onlyWithBalance?: boolean;
}

export interface UserPortfolioResult {
  assets: BlockchainAsset[];
  totalAssets: number;
  assetsWithBalance: number;
  recentTransactions?: AssetTransaction[];
  activeListings?: {
    sales: AssetMarketplace[];
    bids: AssetMarketplace[];
  };
  statistics: {
    totalValue: string;
    uniqueContracts: number;
    nftsOwned: number;
    tokensOwned: number;
  };
}

@Injectable()
export class GetUserPortfolioUseCase {
  constructor(
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly assetRepository: BlockchainAssetRepositoryInterface,
    @Inject(ASSET_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: AssetTransactionRepositoryInterface,
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
  ) {}

  async execute(dto: UserPortfolioDto): Promise<UserPortfolioResult> {
    const {
      ownerAddress,
      includeTransactions,
      includeActiveListings,
      onlyWithBalance,
    } = dto;

    const userAssets = await this.assetRepository.findByOwner(ownerAddress);

    const assets = onlyWithBalance
      ? userAssets.filter((asset) => asset.hasBalance())
      : userAssets;

    const totalAssets = userAssets.length;
    const assetsWithBalance = userAssets.filter((asset) =>
      asset.hasBalance(),
    ).length;
    const totalValue =
      await this.assetRepository.getTotalValueByOwner(ownerAddress);

    const contractIds = new Set(assets.map((asset) => asset.contractId));
    const uniqueContracts = contractIds.size;
    const nftsOwned = assets.filter((asset) => asset.isNFT()).length;
    const tokensOwned = assets.filter((asset) => asset.isFungible()).length;

    const result: UserPortfolioResult = {
      assets,
      totalAssets,
      assetsWithBalance,
      statistics: {
        totalValue,
        uniqueContracts,
        nftsOwned,
        tokensOwned,
      },
    };

    if (includeTransactions) {
      const recentTransactions = await this.transactionRepository.search({
        involvedAddresses: [ownerAddress],
        limit: 10,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });
      result.recentTransactions = recentTransactions.transactions;
    }

    if (includeActiveListings) {
      const [activeSales, activeBids] = await Promise.all([
        this.marketplaceRepository.findUserActiveSales(ownerAddress),
        this.marketplaceRepository.findUserActiveBids(ownerAddress),
      ]);

      result.activeListings = {
        sales: activeSales,
        bids: activeBids,
      };
    }

    return result;
  }
}
