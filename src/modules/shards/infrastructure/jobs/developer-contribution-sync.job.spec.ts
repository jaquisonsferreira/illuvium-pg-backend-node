import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperContributionSyncJob } from './developer-contribution-sync.job';
import { Job } from 'bull';

describe('DeveloperContributionSyncJob', () => {
  let job: DeveloperContributionSyncJob;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeveloperContributionSyncJob],
    }).compile();

    job = module.get<DeveloperContributionSyncJob>(
      DeveloperContributionSyncJob,
    );
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('process', () => {
    it('should process developer contribution sync job', async () => {
      const mockJob = {
        id: '123',
        data: { test: 'data' },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.process(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing developer contribution sync job:',
        '123',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('syncGithubContributions', () => {
    it('should sync GitHub contributions', async () => {
      const mockJob = {
        id: '456',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          githubUsername: 'developer123',
          repositories: ['repo1', 'repo2'],
          since: '2024-01-01',
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.syncGithubContributions(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Syncing GitHub contributions:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('syncContractDeployments', () => {
    it('should sync contract deployments', async () => {
      const mockJob = {
        id: '789',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          chains: ['ethereum', 'polygon', 'arbitrum'],
          fromBlock: 18000000,
          toBlock: 18100000,
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.syncContractDeployments(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Syncing contract deployments:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('calculateDeveloperRewards', () => {
    it('should calculate developer rewards', async () => {
      const mockJob = {
        id: '101',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          seasonId: 1,
          contributions: {
            commits: 50,
            pullRequests: 10,
            issues: 5,
            contractDeployments: 3,
          },
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.calculateDeveloperRewards(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calculating developer rewards:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('verifyDeveloperActivity', () => {
    it('should verify developer activity', async () => {
      const mockJob = {
        id: '202',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          activityPeriod: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
          minimumActivity: {
            commits: 10,
            pullRequests: 2,
          },
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.verifyDeveloperActivity(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Verifying developer activity:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });
});
