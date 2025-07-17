import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES } from '../../constants';

@Processor(SHARD_QUEUES.SOCIAL_SYNC)
@Injectable()
export class SocialContributionSyncJob {
  @Process()
  async process(job: Job<any>): Promise<void> {
    console.log('Processing social contribution sync job:', job.id);
  }

  @Process('sync-kaito-points')
  async syncKaitoPoints(job: Job<any>): Promise<void> {
    console.log('Syncing Kaito points:', job.data);
  }

  @Process('calculate-social-rewards')
  async calculateSocialRewards(job: Job<any>): Promise<void> {
    console.log('Calculating social rewards:', job.data);
  }

  @Process('update-social-contributions')
  async updateSocialContributions(job: Job<any>): Promise<void> {
    console.log('Updating social contributions:', job.data);
  }
}
