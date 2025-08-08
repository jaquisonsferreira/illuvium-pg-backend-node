import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES, SUPPORTED_CHAINS } from '../../constants';
import { VaultSyncService } from '../services/vault-sync.service';

interface VaultSyncJobData {
  chain?: string;
  vaultAddress?: string;
  snapshotDate?: string;
  blockNumber?: number;
  timestamp?: string;
  manual?: boolean;
}

@Processor(SHARD_QUEUES.VAULT_SYNC)
@Injectable()
export class VaultBalanceSyncJob {
  private readonly logger = new Logger(VaultBalanceSyncJob.name);

  constructor(private readonly vaultSyncService: VaultSyncService) {}

  @Process()
  async process(job: Job<VaultSyncJobData>): Promise<void> {
    this.logger.log(`Processing vault balance sync job: ${job.id}`);

    try {
      const snapshotDate = job.data?.snapshotDate
        ? new Date(job.data.snapshotDate)
        : new Date();

      snapshotDate.setUTCHours(0, 0, 0, 0);

      for (const chain of SUPPORTED_CHAINS) {
        await this.vaultSyncService.syncChainVaults(chain, snapshotDate);
      }

      this.logger.log('Vault balance sync completed successfully');
    } catch (error) {
      this.logger.error('Failed to process vault balance sync', error);
      throw error;
    }
  }

  @Process('sync-vault-positions')
  async syncVaultPositions(job: Job<VaultSyncJobData>): Promise<void> {
    this.logger.log(`Syncing vault positions: ${JSON.stringify(job.data)}`);

    try {
      const snapshotDate = job.data?.timestamp
        ? new Date(job.data.timestamp)
        : new Date();

      snapshotDate.setUTCHours(0, 0, 0, 0);

      const chains = job.data?.chain ? [job.data.chain] : SUPPORTED_CHAINS;

      for (const chain of chains) {
        await this.vaultSyncService.syncChainVaults(chain, snapshotDate);
      }

      this.logger.log(
        `Vault positions sync completed for chains: ${chains.join(', ')}`,
      );
    } catch (error) {
      this.logger.error('Failed to sync vault positions', error);
      throw error;
    }
  }

  @Process('sync-vault')
  async syncSingleVault(job: Job<VaultSyncJobData>): Promise<void> {
    this.logger.log(`Processing single vault sync: ${job.data?.vaultAddress}`);

    try {
      if (
        !job.data?.chain ||
        !job.data?.vaultAddress ||
        !job.data?.snapshotDate
      ) {
        throw new Error('Missing required data for vault sync');
      }

      await this.vaultSyncService.processVaultSync({
        chain: job.data.chain,
        vaultAddress: job.data.vaultAddress,
        snapshotDate: new Date(job.data.snapshotDate),
        blockNumber: job.data.blockNumber,
      });

      this.logger.log(`Single vault sync completed: ${job.data.vaultAddress}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync vault ${job.data?.vaultAddress}`,
        error,
      );
      throw error;
    }
  }

  @Process('update-vault-balances')
  async updateVaultBalances(job: Job<VaultSyncJobData>): Promise<void> {
    this.logger.log('Updating vault balances:', job.data);

    try {
      const snapshotDate = new Date();
      snapshotDate.setUTCHours(0, 0, 0, 0);

      for (const chain of SUPPORTED_CHAINS) {
        await this.vaultSyncService.syncChainVaults(chain, snapshotDate);
      }

      this.logger.log('Vault balances updated successfully');
    } catch (error) {
      this.logger.error('Failed to update vault balances', error);
      throw error;
    }
  }

  @Process('calculate-vault-rewards')
  async calculateVaultRewards(job: Job<VaultSyncJobData>): Promise<void> {
    this.logger.log('Calculating vault rewards:', job.data);

    try {
      this.logger.warn('Vault rewards calculation not yet implemented');
    } catch (error) {
      this.logger.error('Failed to calculate vault rewards', error);
      throw error;
    }
  }
}
