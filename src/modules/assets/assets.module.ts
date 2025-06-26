import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { AssetsController } from './interface/controllers/assets.controller';
import { MarketplaceBatchController } from './interface/controllers/marketplace-batch.controller';
import {
  CreateAssetUseCase,
  SearchBlockchainAssetsUseCase,
  GetUserPortfolioUseCase,
  CreateSaleListingUseCase,
  CreateBidUseCase,
  GetAssetHistoryUseCase,
  CreateBatchListingsUseCase,
  CancelBatchListingsUseCase,
  UpdateBatchListingsUseCase,
} from './application/use-cases';
import {
  AssetRepository,
  BlockchainContractRepository,
  BlockchainAssetRepository,
  AssetTransactionRepository,
  AssetMarketplaceRepository,
} from './infrastructure/database';
import {
  ASSET_REPOSITORY,
  BLOCKCHAIN_CONTRACT_REPOSITORY,
  BLOCKCHAIN_ASSET_REPOSITORY,
  ASSET_TRANSACTION_REPOSITORY,
  ASSET_MARKETPLACE_REPOSITORY,
} from './constants';

@Module({
  imports: [DatabaseModule],
  controllers: [AssetsController, MarketplaceBatchController],
  providers: [
    // Use Cases
    CreateAssetUseCase,
    SearchBlockchainAssetsUseCase,
    GetUserPortfolioUseCase,
    CreateSaleListingUseCase,
    CreateBidUseCase,
    GetAssetHistoryUseCase,
    CreateBatchListingsUseCase,
    CancelBatchListingsUseCase,
    UpdateBatchListingsUseCase,

    // Repositories
    {
      provide: ASSET_REPOSITORY,
      useClass: AssetRepository,
    },
    {
      provide: BLOCKCHAIN_CONTRACT_REPOSITORY,
      useClass: BlockchainContractRepository,
    },
    {
      provide: BLOCKCHAIN_ASSET_REPOSITORY,
      useClass: BlockchainAssetRepository,
    },
    {
      provide: ASSET_TRANSACTION_REPOSITORY,
      useClass: AssetTransactionRepository,
    },
    {
      provide: ASSET_MARKETPLACE_REPOSITORY,
      useClass: AssetMarketplaceRepository,
    },
  ],
  exports: [
    // Repositories
    ASSET_REPOSITORY,
    BLOCKCHAIN_CONTRACT_REPOSITORY,
    BLOCKCHAIN_ASSET_REPOSITORY,
    ASSET_TRANSACTION_REPOSITORY,
    ASSET_MARKETPLACE_REPOSITORY,

    // Use Cases
    CreateAssetUseCase,
    SearchBlockchainAssetsUseCase,
    GetUserPortfolioUseCase,
    CreateSaleListingUseCase,
    CreateBidUseCase,
    GetAssetHistoryUseCase,
  ],
})
export class AssetsModule {}
