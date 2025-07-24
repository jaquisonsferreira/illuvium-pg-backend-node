import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { EventListenerService } from './infrastructure/services/event-listener.service';
import { ContractInteractionService } from './infrastructure/services/contract-interaction.service';
import { BlockchainEventBridgeService } from './infrastructure/services/blockchain-event-bridge.service';
import { ContractDiscoveryService } from './infrastructure/services/contract-discovery.service';
import { BlockchainEventIntegrationService } from './infrastructure/services/blockchain-event-integration.service';
import { ProcessBlockchainEventUseCase } from './application/use-cases/process-blockchain-event.use-case';
import { BlockProcessorJobProcessor } from './infrastructure/jobs/block-processor.job';
import { EventSyncJobProcessor } from './infrastructure/jobs/event-sync.job';
import { BlockchainController } from './interface/controllers/blockchain.controller';
import { BLOCKCHAIN_QUEUES } from './constants';

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
  imports: [
    ConfigModule,
    AssetsModule,
    AuditModule,
    BullModule.registerQueue(
      { name: BLOCKCHAIN_QUEUES.BLOCK_PROCESSOR },
      { name: BLOCKCHAIN_QUEUES.EVENT_SYNC },
    ),
  ],
  controllers: [BlockchainController],
  providers: [
    EventListenerService,
    ContractInteractionService,
    BlockchainEventBridgeService,
    ContractDiscoveryService,
    BlockchainEventIntegrationService,
    ProcessBlockchainEventUseCase,
    BlockProcessorJobProcessor,
    EventSyncJobProcessor,

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
    EventListenerService,
    ContractInteractionService,
    BlockchainEventBridgeService,
    ContractDiscoveryService,
    BlockchainEventIntegrationService,
    ProcessBlockchainEventUseCase,

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
export class BlockchainModule {}
