import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DailyShardProcessorJob } from './daily-shard-processor.job';
import { CalculateDailyShardsUseCase } from '../../application/use-cases/calculate-daily-shards.use-case';
import { Job } from 'bull';

describe('DailyShardProcessorJob', () => {
  let job: DailyShardProcessorJob;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DailyShardProcessorJob,
        {
          provide: CalculateDailyShardsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: 'IVaultPositionRepository',
          useValue: {
            findByWalletAndDate: jest.fn(),
            findActivePositions: jest.fn(),
            findUniqueWallets: jest
              .fn()
              .mockResolvedValue([
                '0x1234567890abcdef1234567890abcdef12345678',
              ]),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'ISeasonRepository',
          useValue: {
            findById: jest.fn(),
            findCurrentSeason: jest.fn(),
            findAll: jest.fn(),
            findActive: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<DailyShardProcessorJob>(DailyShardProcessorJob);

    // Mock logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
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

      const loggerSpy = jest.spyOn(job['logger'], 'log');

      await job.process(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Processing daily shards job: 123',
      );
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

      // Get the mocked repositories
      const seasonRepository = module.get('ISeasonRepository');
      const calculateDailyShardsUseCase = module.get(
        CalculateDailyShardsUseCase,
      );

      // Setup mock returns
      seasonRepository.findActive.mockResolvedValue({
        id: 1,
        name: 'Season 1',
      });
      calculateDailyShardsUseCase.execute.mockResolvedValue({ success: true });

      const loggerSpy = jest.spyOn(job['logger'], 'log');

      await job.calculateDailyShards(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting daily shards calculation:',
        mockJob.data,
      );
      expect(seasonRepository.findActive).toHaveBeenCalled();
      expect(calculateDailyShardsUseCase.execute).toHaveBeenCalled();
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

      const loggerSpy = jest.spyOn(job['logger'], 'log');

      await job.aggregateEarnings(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Aggregating earnings:',
        mockJob.data,
      );
    });
  });
});
