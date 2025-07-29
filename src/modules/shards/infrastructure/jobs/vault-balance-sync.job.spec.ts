import { Test, TestingModule } from '@nestjs/testing';
import { VaultBalanceSyncJob } from './vault-balance-sync.job';
import { Job } from 'bull';

describe('VaultBalanceSyncJob', () => {
  let job: VaultBalanceSyncJob;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VaultBalanceSyncJob],
    }).compile();

    job = module.get<VaultBalanceSyncJob>(VaultBalanceSyncJob);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('process', () => {
    it('should process vault balance sync job', async () => {
      const mockJob = {
        id: '123',
        data: { test: 'data' },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.process(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing vault balance sync job:',
        '123',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('syncVaultPositions', () => {
    it('should sync vault positions', async () => {
      const mockJob = {
        id: '456',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          vaultAddresses: [
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          ],
          chain: 'ethereum',
          seasonId: 1,
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.syncVaultPositions(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Syncing vault positions:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateVaultBalances', () => {
    it('should update vault balances', async () => {
      const mockJob = {
        id: '789',
        data: {
          positions: [
            {
              walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
              vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              balance: '1000000000000000000',
              usdValue: 1500.75,
              lastUpdated: '2024-01-15T10:00:00Z',
            },
            {
              walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
              vaultAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              balance: '50000000',
              usdValue: 50000,
              lastUpdated: '2024-01-15T10:00:00Z',
            },
          ],
          blockNumber: 18500000,
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.updateVaultBalances(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Updating vault balances:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('calculateVaultRewards', () => {
    it('should calculate vault rewards', async () => {
      const mockJob = {
        id: '101',
        data: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          seasonId: 1,
          vaultPositions: [
            {
              vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              assetSymbol: 'ETH',
              balance: '1000000000000000000',
              usdValue: 1500.75,
              rate: 100,
            },
            {
              vaultAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              assetSymbol: 'USDC',
              balance: '50000000',
              usdValue: 50000,
              rate: 150,
            },
          ],
          totalUsdValue: 51500.75,
        },
      } as Job<any>;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await job.calculateVaultRewards(mockJob);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calculating vault rewards:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });
  });
});
