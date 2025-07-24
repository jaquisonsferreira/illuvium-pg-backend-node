import { Test, TestingModule } from '@nestjs/testing';
import { SocialContributionSyncJob } from './social-contribution-sync.job';
import { Job } from 'bull';

describe('SocialContributionSyncJob', () => {
  let job: SocialContributionSyncJob;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialContributionSyncJob],
    }).compile();

    job = module.get<SocialContributionSyncJob>(SocialContributionSyncJob);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('process', () => {
    it('should process social contribution sync job', async () => {
      const mockJob = {
        id: '123',
        data: { test: 'data' },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.process(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing social contribution sync job:',
        '123',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('syncKaitoPoints', () => {
    it('should sync Kaito points', async () => {
      const mockJob = {
        id: '456',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          twitterHandle: '@user123',
          period: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
          metrics: {
            tweets: 50,
            engagements: 1000,
            impressions: 50000,
          },
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.syncKaitoPoints(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Syncing Kaito points:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('calculateSocialRewards', () => {
    it('should calculate social rewards', async () => {
      const mockJob = {
        id: '789',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          seasonId: 1,
          kaitoPoints: 1500,
          socialMetrics: {
            followers: 5000,
            engagement: 85.5,
            reach: 100000,
          },
          conversionRate: 100,
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.calculateSocialRewards(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calculating social rewards:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateSocialContributions', () => {
    it('should update social contributions', async () => {
      const mockJob = {
        id: '101',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          contributions: [
            {
              type: 'tweet',
              content: 'Excited about #Illuvium launch!',
              timestamp: '2024-01-15T10:00:00Z',
              engagement: 150,
            },
            {
              type: 'retweet',
              originalAuthor: '@IlluviumIO',
              timestamp: '2024-01-15T12:00:00Z',
              engagement: 50,
            },
          ],
          totalPoints: 200,
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.updateSocialContributions(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Updating social contributions:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });
});
