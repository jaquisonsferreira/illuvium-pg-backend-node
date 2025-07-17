import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SHARD_QUEUES } from '../../constants';

@Processor(SHARD_QUEUES.DAILY_PROCESSOR)
@Injectable()
export class DailyShardProcessorJob {
  @Process()
  async process(job: Job<any>): Promise<void> {
    console.log('Processing daily shards job:', job.id);
  }

  @Process('calculate-daily-shards')
  async calculateDailyShards(job: Job<any>): Promise<void> {
    console.log('Calculating daily shards:', job.data);
  }

  @Process('aggregate-earnings')
  async aggregateEarnings(job: Job<any>): Promise<void> {
    console.log('Aggregating earnings:', job.data);
  }
}
