import { Test, TestingModule } from '@nestjs/testing';
import { DailyShardProcessorJob } from './daily-shard-processor.job';
import { Job } from 'bull';

describe('DailyShardProcessorJob', () => {
  let job: DailyShardProcessorJob;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DailyShardProcessorJob],
    }).compile();

    job = module.get<DailyShardProcessorJob>(DailyShardProcessorJob);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('process', () => {
    it('should process daily shards job', async () => {
      const mockJob = {
        id: '123',
        data: { test: 'data' },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.process(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing daily shards job:',
        '123',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('calculateDailyShards', () => {
    it('should calculate daily shards', async () => {
      const mockJob = {
        id: '456',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          date: '2024-01-15',
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.calculateDailyShards(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calculating daily shards:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('aggregateEarnings', () => {
    it('should aggregate earnings', async () => {
      const mockJob = {
        id: '789',
        data: {
          seasonId: 1,
          date: '2024-01-15',
          wallets: [
            '0x1234567890abcdef1234567890abcdef12345678',
            '0x9876543210fedcba9876543210fedcba98765432',
          ],
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.aggregateEarnings(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Aggregating earnings:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });
});
