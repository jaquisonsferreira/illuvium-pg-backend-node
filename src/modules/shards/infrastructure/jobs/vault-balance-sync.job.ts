import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES } from '../../constants';

@Processor(SHARD_QUEUES.VAULT_SYNC)
@Injectable()
export class VaultBalanceSyncJob {
  @Process()
  async process(job: Job<any>): Promise<void> {
    console.log('Processing vault balance sync job:', job.id);
  }

  @Process('sync-vault-positions')
  async syncVaultPositions(job: Job<any>): Promise<void> {
    console.log('Syncing vault positions:', job.data);
  }

  @Process('update-vault-balances')
  async updateVaultBalances(job: Job<any>): Promise<void> {
    console.log('Updating vault balances:', job.data);
  }

  @Process('calculate-vault-rewards')
  async calculateVaultRewards(job: Job<any>): Promise<void> {
    console.log('Calculating vault rewards:', job.data);
  }
}
