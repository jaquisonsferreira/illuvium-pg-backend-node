import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@shared/shared.module';

// Infrastructure Services
import { StakingSubgraphService } from './infrastructure/services/staking-subgraph.service';
import { StakingBlockchainService } from './infrastructure/services/staking-blockchain.service';
import { PriceFeedService } from './infrastructure/services/price-feed.service';
import { VaultConfigService } from './infrastructure/config/vault-config.service';
import { TokenDecimalsService } from './infrastructure/services/token-decimals.service';

// Use Cases
import { GetVaultPositionUseCase } from './application/use-cases/get-vault-position.use-case';
import { GetUserPositionsUseCase } from './application/use-cases/get-user-positions.use-case';
import { CalculateLPTokenPriceUseCase } from './application/use-cases/calculate-lp-token-price.use-case';

@Module({
  imports: [ConfigModule, SharedModule],
  providers: [
    // Configuration Services
    VaultConfigService,
    TokenDecimalsService,

    // Repository Implementations
    {
      provide: 'IStakingSubgraphRepository',
      useClass: StakingSubgraphService,
    },
    {
      provide: 'IStakingBlockchainRepository',
      useClass: StakingBlockchainService,
    },
    {
      provide: 'IPriceFeedRepository',
      useClass: PriceFeedService,
    },

    // Direct service providers for non-interface usage
    StakingSubgraphService,
    StakingBlockchainService,
    PriceFeedService,

    // Use Cases
    GetVaultPositionUseCase,
    GetUserPositionsUseCase,
    CalculateLPTokenPriceUseCase,
  ],
  exports: [
    // Export configuration service
    VaultConfigService,
    TokenDecimalsService,

    // Export repository interfaces
    'IStakingSubgraphRepository',
    'IStakingBlockchainRepository',
    'IPriceFeedRepository',

    // Export concrete services
    StakingSubgraphService,
    StakingBlockchainService,
    PriceFeedService,

    // Export use cases
    GetVaultPositionUseCase,
    GetUserPositionsUseCase,
    CalculateLPTokenPriceUseCase,
  ],
})
export class StakingModule {}
