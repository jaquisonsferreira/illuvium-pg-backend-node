import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@shared/modules/http.module';

// Controllers
import { ShardsController } from './interface/controllers/shards.controller';
import { ReferralsController } from './interface/controllers/referrals.controller';
import { LeaderboardController } from './interface/controllers/leaderboard.controller';
import { SeasonsController } from './interface/controllers/seasons.controller';
import { SystemStatusController } from './interface/controllers/system-status.controller';

// Use Cases
import { CalculateDailyShardsUseCase } from './application/use-cases/calculate-daily-shards.use-case';
import { GetEarningHistoryUseCase } from './application/use-cases/get-earning-history.use-case';
import { GetLeaderboardUseCase } from './application/use-cases/get-leaderboard.use-case';
import { ManageReferralUseCase } from './application/use-cases/manage-referral.use-case';
import { ManageSeasonUseCase } from './application/use-cases/manage-season.use-case';
import { SyncVaultPositionsUseCase } from './application/use-cases/sync-vault-positions.use-case';

// Domain Services
import { ShardCalculationDomainService } from './domain/services/shard-calculation.domain-service';
import { FraudDetectionDomainService } from './domain/services/fraud-detection.domain-service';

// Infrastructure Services
import { CoinGeckoService } from './infrastructure/services/coingecko.service';
import { SubgraphService } from './infrastructure/services/subgraph.service';
import { VaultSyncService } from './infrastructure/services/vault-sync.service';
import { DeveloperContributionProcessor } from './infrastructure/services/developer-contribution.processor';
import { BlockchainVerificationService } from './infrastructure/services/blockchain-verification.service';
import { GitHubVerificationService } from './infrastructure/services/github-verification.service';

// Repositories
import { VaultPositionRepository } from './infrastructure/repositories/vault-position.repository';
import { DeveloperContributionRepository } from './infrastructure/repositories/developer-contribution.repository';
import { SeasonRepository } from './infrastructure/repositories/season.repository';
import { ReferralRepository } from './infrastructure/repositories/referral.repository';
import { ShardBalanceRepository } from './infrastructure/repositories/shard-balance.repository';
import { ShardEarningHistoryRepository } from './infrastructure/repositories/shard-earning-history.repository';

// Jobs
import { DailyShardProcessorJob } from './infrastructure/jobs/daily-shard-processor.job';
import { VaultBalanceSyncJob } from './infrastructure/jobs/vault-balance-sync.job';
import { SocialContributionSyncJob } from './infrastructure/jobs/social-contribution-sync.job';
import { DeveloperContributionSyncJob } from './infrastructure/jobs/developer-contribution-sync.job';

// Scheduler
import { ShardProcessingScheduler } from './interface/schedulers/shard-processing.scheduler';

// External Modules
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';
import { DeveloperModule } from '../developer/developer.module';
import { AuditModule } from '../audit/audit.module';
import { SharedModule } from '../../shared/shared.module';

import { SHARD_QUEUES } from './constants';

@Module({
  imports: [
    HttpModule,
    SharedModule,
    BlockchainModule,
    AuthModule,
    DeveloperModule,
    AuditModule,
    // Bull Queues
    BullModule.registerQueue(
      { name: SHARD_QUEUES.DAILY_PROCESSOR },
      { name: SHARD_QUEUES.VAULT_SYNC },
      { name: SHARD_QUEUES.SOCIAL_SYNC },
      { name: SHARD_QUEUES.DEVELOPER_SYNC },
      { name: SHARD_QUEUES.REFERRAL_PROCESSOR },
    ),
  ],
  controllers: [
    ShardsController,
    ReferralsController,
    LeaderboardController,
    SeasonsController,
    SystemStatusController,
  ],
  providers: [
    // Use Cases
    CalculateDailyShardsUseCase,
    GetEarningHistoryUseCase,
    GetLeaderboardUseCase,
    ManageReferralUseCase,
    ManageSeasonUseCase,
    SyncVaultPositionsUseCase,

    // Domain Services
    ShardCalculationDomainService,
    FraudDetectionDomainService,

    // Infrastructure Services
    CoinGeckoService,
    SubgraphService,
    VaultSyncService,
    DeveloperContributionProcessor,
    BlockchainVerificationService,
    GitHubVerificationService,

    // Repositories
    VaultPositionRepository,
    DeveloperContributionRepository,
    SeasonRepository,
    ReferralRepository,
    ShardBalanceRepository,
    ShardEarningHistoryRepository,

    // Repository interface providers
    {
      provide: 'IVaultPositionRepository',
      useClass: VaultPositionRepository,
    },
    {
      provide: 'IDeveloperContributionRepository',
      useClass: DeveloperContributionRepository,
    },
    {
      provide: 'ISeasonRepository',
      useClass: SeasonRepository,
    },
    {
      provide: 'IReferralRepository',
      useClass: ReferralRepository,
    },
    {
      provide: 'IShardBalanceRepository',
      useClass: ShardBalanceRepository,
    },
    {
      provide: 'IShardEarningHistoryRepository',
      useClass: ShardEarningHistoryRepository,
    },

    // Jobs
    DailyShardProcessorJob,
    VaultBalanceSyncJob,
    SocialContributionSyncJob,
    DeveloperContributionSyncJob,

    // Scheduler
    ShardProcessingScheduler,
  ],
  exports: [
    CalculateDailyShardsUseCase,
    ManageReferralUseCase,
    ManageSeasonUseCase,
    // Export domain services
    ShardCalculationDomainService,
    FraudDetectionDomainService,
  ],
})
export class ShardsModule {}
