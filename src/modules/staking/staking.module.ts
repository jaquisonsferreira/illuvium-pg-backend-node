import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SharedModule } from '@shared/shared.module';

import { StakingPositionsController } from './interface/controllers/staking-positions.controller';
import { StakingTransactionsController } from './interface/controllers/staking-transactions.controller';
import { VaultsController } from './interface/controllers/vaults.controller';
import { StakingSubgraphService } from './infrastructure/services/staking-subgraph.service';
import { AlchemyStakingService } from './infrastructure/services/alchemy-staking.service';
import { StakingDataProviderFactory } from './infrastructure/services/staking-data-provider.factory';
import { StakingBlockchainService } from './infrastructure/services/staking-blockchain.service';
import { PriceFeedService } from './infrastructure/services/price-feed.service';
import { CoinGeckoPriceFeedService } from './infrastructure/services/coingecko-price-feed.service';
import { VaultConfigService } from './infrastructure/config/vault-config.service';
import { TokenDecimalsService } from './infrastructure/services/token-decimals.service';

import { GetVaultPositionUseCase } from './application/use-cases/get-vault-position.use-case';
import { GetUserPositionsUseCase } from './application/use-cases/get-user-positions.use-case';
import { GetUserStakingPositionsUseCase } from './application/use-cases/get-user-staking-positions.use-case';
import { GetUserStakingTransactionsUseCase } from './application/use-cases/get-user-staking-transactions.use-case';
import { CalculateLPTokenPriceUseCase } from './application/use-cases/calculate-lp-token-price.use-case';
import { GetVaultsUseCase } from './application/use-cases/get-vaults.use-case';
import { GetVaultDetailsUseCase } from './application/use-cases/get-vault-details.use-case';
import { GetStakingStatsUseCase } from './application/use-cases/get-staking-stats.use-case';

@Module({
  imports: [ConfigModule, HttpModule, SharedModule],
  controllers: [
    StakingPositionsController,
    StakingTransactionsController,
    VaultsController,
  ],
  providers: [
    VaultConfigService,
    TokenDecimalsService,
    StakingSubgraphService,
    AlchemyStakingService,
    StakingDataProviderFactory,
    {
      provide: 'IStakingSubgraphRepository',
      useFactory: (factory: StakingDataProviderFactory) =>
        factory.createProvider(),
      inject: [StakingDataProviderFactory],
    },
    {
      provide: 'IStakingBlockchainRepository',
      useClass: StakingBlockchainService,
    },
    {
      provide: 'IPriceFeedRepository',
      useClass: CoinGeckoPriceFeedService,
    },
    StakingBlockchainService,
    PriceFeedService,
    CoinGeckoPriceFeedService,

    GetVaultPositionUseCase,
    GetUserPositionsUseCase,
    GetUserStakingPositionsUseCase,
    GetUserStakingTransactionsUseCase,
    CalculateLPTokenPriceUseCase,
    GetVaultsUseCase,
    GetVaultDetailsUseCase,
    GetStakingStatsUseCase,
  ],
  exports: [
    VaultConfigService,
    TokenDecimalsService,
    'IStakingSubgraphRepository',
    'IStakingBlockchainRepository',
    'IPriceFeedRepository',

    StakingSubgraphService,
    AlchemyStakingService,
    StakingDataProviderFactory,
    StakingBlockchainService,
    PriceFeedService,

    GetVaultPositionUseCase,
    GetUserPositionsUseCase,
    GetUserStakingPositionsUseCase,
    GetUserStakingTransactionsUseCase,
    CalculateLPTokenPriceUseCase,
    GetVaultsUseCase,
    GetVaultDetailsUseCase,
    GetStakingStatsUseCase,
  ],
})
export class StakingModule {}
