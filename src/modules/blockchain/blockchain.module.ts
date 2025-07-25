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
  ],
  exports: [
    EventListenerService,
    ContractInteractionService,
    BlockchainEventBridgeService,
    ContractDiscoveryService,
    BlockchainEventIntegrationService,
    ProcessBlockchainEventUseCase,
  ],
})
export class BlockchainModule {}
