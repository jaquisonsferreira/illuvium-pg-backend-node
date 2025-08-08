import { Test, TestingModule } from '@nestjs/testing';
import { VaultBalanceSyncJob } from './vault-balance-sync.job';
import { VaultSyncService } from '../services/vault-sync.service';
import { Job } from 'bull';

describe('VaultBalanceSyncJob', () => {
  let job: VaultBalanceSyncJob;
  let vaultSyncService: jest.Mocked<VaultSyncService>;

  beforeEach(async () => {
    const mockVaultSyncService = {
      syncChainVaults: jest.fn(),
      processVaultSync: jest.fn(),
      syncWalletPositions: jest.fn(),
      scheduleDailyVaultSync: jest.fn(),
      getHistoricalVaultValue: jest.fn(),
      getTotalVaultValue: jest.fn(),
      getVaultPosition: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultBalanceSyncJob,
        {
          provide: VaultSyncService,
          useValue: mockVaultSyncService,
        },
      ],
    }).compile();

    job = module.get<VaultBalanceSyncJob>(VaultBalanceSyncJob);
    vaultSyncService = module.get(VaultSyncService);
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

      const loggerSpy = jest.spyOn(job['logger'], 'log').mockImplementation();
      vaultSyncService.syncChainVaults.mockResolvedValue();

      await job.process(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Processing vault balance sync job: 123',
      );
      expect(vaultSyncService.syncChainVaults).toHaveBeenCalled();

      loggerSpy.mockRestore();
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

      const loggerSpy = jest.spyOn(job['logger'], 'log').mockImplementation();
      vaultSyncService.syncChainVaults.mockResolvedValue();

      await job.syncVaultPositions(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Syncing vault positions: ${JSON.stringify(mockJob.data)}`,
      );
      expect(vaultSyncService.syncChainVaults).toHaveBeenCalledWith(
        'ethereum',
        expect.any(Date),
      );

      loggerSpy.mockRestore();
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

      const loggerSpy = jest.spyOn(job['logger'], 'log').mockImplementation();
      vaultSyncService.syncChainVaults.mockResolvedValue();

      await job.updateVaultBalances(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Updating vault balances:',
        mockJob.data,
      );
      expect(vaultSyncService.syncChainVaults).toHaveBeenCalled();

      loggerSpy.mockRestore();
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

      const loggerSpy = jest.spyOn(job['logger'], 'log').mockImplementation();
      const loggerWarnSpy = jest
        .spyOn(job['logger'], 'warn')
        .mockImplementation();

      await job.calculateVaultRewards(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Calculating vault rewards:',
        mockJob.data,
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Vault rewards calculation not yet implemented',
      );

      loggerSpy.mockRestore();
      loggerWarnSpy.mockRestore();
    });
  });
});
