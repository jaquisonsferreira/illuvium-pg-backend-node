import { Injectable, Logger, Inject } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES } from '../../constants';
import { CalculateDailyShardsUseCase } from '../../application/use-cases/calculate-daily-shards.use-case';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';

@Processor(SHARD_QUEUES.DAILY_PROCESSOR)
@Injectable()
export class DailyShardProcessorJob {
  private readonly logger = new Logger(DailyShardProcessorJob.name);

  constructor(
    private readonly calculateDailyShardsUseCase: CalculateDailyShardsUseCase,
    @Inject('IVaultPositionRepository')
    private readonly vaultPositionRepository: IVaultPositionRepository,
    @Inject('ISeasonRepository')
    private readonly seasonRepository: ISeasonRepository,
  ) {}

  @Process()
  async process(job: Job<any>): Promise<void> {
    this.logger.log(`Processing daily shards job: ${job.id}`);
  }

  @Process('calculate-daily-shards')
  async calculateDailyShards(job: Job<any>): Promise<void> {
    this.logger.log('Starting daily shards calculation:', job.data);

    try {
      const activeSeason = await this.seasonRepository.findActive();
      if (!activeSeason) {
        this.logger.warn('No active season found, skipping calculation');
        return;
      }

      const uniqueWallets =
        await this.vaultPositionRepository.findUniqueWallets(activeSeason.id);

      this.logger.log(
        `Found ${uniqueWallets.length} unique wallets to process`,
      );

      const batchSize = 10;
      for (let i = 0; i < uniqueWallets.length; i += batchSize) {
        const batch = uniqueWallets.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (walletAddress) => {
            try {
              await this.calculateDailyShardsUseCase.execute({
                walletAddress,
                seasonId: activeSeason.id,
                date: new Date(),
              });
              this.logger.debug(
                `Calculated shards for wallet: ${walletAddress}`,
              );
            } catch (error) {
              this.logger.error(
                `Failed to calculate shards for wallet ${walletAddress}:`,
                error,
              );
            }
          }),
        );

        this.logger.log(
          `Processed batch ${i / batchSize + 1} of ${Math.ceil(uniqueWallets.length / batchSize)}`,
        );
      }

      this.logger.log('Daily shards calculation completed successfully');
    } catch (error) {
      this.logger.error('Failed to calculate daily shards:', error);
      throw error;
    }
  }

  @Process('aggregate-earnings')
  async aggregateEarnings(job: Job<any>): Promise<void> {
    this.logger.log('Aggregating earnings:', job.data);
  }
}
