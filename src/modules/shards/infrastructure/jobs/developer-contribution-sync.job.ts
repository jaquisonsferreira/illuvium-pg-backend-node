import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES } from '../../constants';

@Processor(SHARD_QUEUES.DEVELOPER_SYNC)
@Injectable()
export class DeveloperContributionSyncJob {
  @Process()
  async process(job: Job<any>): Promise<void> {
    console.log('Processing developer contribution sync job:', job.id);
  }

  @Process('sync-github-contributions')
  async syncGithubContributions(job: Job<any>): Promise<void> {
    console.log('Syncing GitHub contributions:', job.data);
  }

  @Process('sync-contract-deployments')
  async syncContractDeployments(job: Job<any>): Promise<void> {
    console.log('Syncing contract deployments:', job.data);
  }

  @Process('calculate-developer-rewards')
  async calculateDeveloperRewards(job: Job<any>): Promise<void> {
    console.log('Calculating developer rewards:', job.data);
  }

  @Process('verify-developer-activity')
  async verifyDeveloperActivity(job: Job<any>): Promise<void> {
    console.log('Verifying developer activity:', job.data);
  }
}
