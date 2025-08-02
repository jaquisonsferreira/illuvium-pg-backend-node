import { Test, TestingModule } from '@nestjs/testing';
import { SyncVaultPositionsUseCase } from './sync-vault-positions.use-case';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { VaultSyncService } from '../../infrastructure/services/vault-sync.service';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';

describe('SyncVaultPositionsUseCase', () => {
  let useCase: SyncVaultPositionsUseCase;
  let vaultPositionRepository: jest.Mocked<IVaultPositionRepository>;
  let seasonRepository: jest.Mocked<ISeasonRepository>;
  let vaultSyncService: jest.Mocked<VaultSyncService>;

  const validWallet1 = '0x1234567890abcdef1234567890abcdef12345678';
  const validWallet2 = '0x9876543210fedcba9876543210fedcba98765432';
  const vaultAddress1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const vaultAddress2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  const mockSeasonConfig: SeasonConfig = {
    vaultRates: { ETH: 100, USDC: 150 },
    socialConversionRate: 100,
    vaultLocked: false,
    withdrawalEnabled: true,
    redeemPeriodDays: 30,
  };

  const mockActiveSeason = new SeasonEntity(
    1,
    'Season 1',
    'base',
    new Date('2024-01-01'),
    new Date('2024-12-31'),
    'active',
    mockSeasonConfig,
    1000,
    50000,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  const mockInactiveSeason = new SeasonEntity(
    2,
    'Season 2',
    'base',
    new Date('2025-01-01'),
    new Date('2025-12-31'),
    'upcoming',
    mockSeasonConfig,
    0,
    0,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  const mockVaultPosition1 = new VaultPositionEntity(
    '1',
    validWallet1,
    vaultAddress1,
    'ETH',
    'base',
    '100',
    '100',
    1000,
    4, // Default lock weeks
    new Date('2024-01-15'),
    12345,
    new Date('2024-01-15'),
  );

  const mockVaultPosition2 = new VaultPositionEntity(
    '2',
    validWallet2,
    vaultAddress2,
    'USDC',
    'base',
    '200',
    '200',
    200,
    4, // Default lock weeks
    new Date('2024-01-15'),
    12346,
    new Date('2024-01-15'),
  );

  const mockPositionData = {
    vaultAddress: vaultAddress1,
    assetSymbol: 'ETH',
    balance: '150',
    shares: '150',
    usdValue: 1500,
    blockNumber: 12347,
  };

  beforeEach(async () => {
    const mockVaultPositionRepository = {
      findByWalletVaultAndSeason: jest.fn(),
      findActiveBySeason: jest.fn(),
      findStalePositions: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByWallet: jest.fn(),
      findByVault: jest.fn(),
      findBySeason: jest.fn(),
    };

    const mockSeasonRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      findByChain: jest.fn(),
      findActiveByChain: jest.fn(),
      findByStatus: jest.fn(),
    };

    const mockVaultSyncService = {
      syncWalletPositions: jest.fn(),
      getVaultPosition: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncVaultPositionsUseCase,
        {
          provide: 'IVaultPositionRepository',
          useValue: mockVaultPositionRepository,
        },
        {
          provide: 'ISeasonRepository',
          useValue: mockSeasonRepository,
        },
        {
          provide: VaultSyncService,
          useValue: mockVaultSyncService,
        },
      ],
    }).compile();

    useCase = module.get<SyncVaultPositionsUseCase>(SyncVaultPositionsUseCase);
    vaultPositionRepository = module.get('IVaultPositionRepository');
    seasonRepository = module.get('ISeasonRepository');
    vaultSyncService = module.get(VaultSyncService);
  });

  describe('execute', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockActiveSeason);
      vaultSyncService.syncWalletPositions.mockResolvedValue([
        mockPositionData,
      ] as any);
      vaultPositionRepository.findByWalletVaultAndSeason.mockResolvedValue(
        null,
      );
      vaultPositionRepository.create.mockResolvedValue(mockVaultPosition1);
    });

    it('should sync vault positions for specific wallet', async () => {
      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
        chain: 'base',
      };

      const result = await useCase.execute(dto);

      expect(seasonRepository.findById).toHaveBeenCalledWith(1);
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet1,
        1,
        'base',
        expect.any(Date),
      );
      expect(vaultPositionRepository.create).toHaveBeenCalled();
      expect(result).toEqual({
        synced: 1,
        updated: 0,
        errors: 0,
        details: [
          {
            walletAddress: validWallet1,
            chain: 'base',
            vaultAddress: vaultAddress1,
            status: 'synced',
          },
        ],
      });
    });

    it('should sync positions for all chains when chain not specified', async () => {
      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
      };

      await useCase.execute(dto);

      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledTimes(4);
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet1,
        1,
        'base',
        expect.any(Date),
      );
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet1,
        1,
        'ethereum',
        expect.any(Date),
      );
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet1,
        1,
        'arbitrum',
        expect.any(Date),
      );
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet1,
        1,
        'optimism',
        expect.any(Date),
      );
    });

    it('should update existing positions when balance changes', async () => {
      vaultPositionRepository.findByWalletVaultAndSeason.mockResolvedValue(
        mockVaultPosition1,
      );
      vaultPositionRepository.update.mockResolvedValue(mockVaultPosition1);

      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
        chain: 'base',
      };

      const result = await useCase.execute(dto);

      expect(vaultPositionRepository.update).toHaveBeenCalled();
      expect(vaultPositionRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        synced: 0,
        updated: 1,
        errors: 0,
        details: [
          {
            walletAddress: validWallet1,
            chain: 'base',
            vaultAddress: vaultAddress1,
            status: 'updated',
          },
        ],
      });
    });

    it('should not update when balance unchanged', async () => {
      const unchangedPositionData = {
        ...mockPositionData,
        balance: '100',
        usdValue: 1000,
      };
      vaultSyncService.syncWalletPositions.mockResolvedValue([
        unchangedPositionData,
      ] as any);
      vaultPositionRepository.findByWalletVaultAndSeason.mockResolvedValue(
        mockVaultPosition1,
      );

      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
        chain: 'base',
      };

      const result = await useCase.execute(dto);

      expect(vaultPositionRepository.update).not.toHaveBeenCalled();
      expect(vaultPositionRepository.create).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('should sync all active positions when wallet not specified', async () => {
      vaultPositionRepository.findActiveBySeason.mockResolvedValue([
        mockVaultPosition1,
        mockVaultPosition2,
      ]);

      const dto = {
        seasonId: 1,
      };

      const result = await useCase.execute(dto);

      expect(vaultPositionRepository.findActiveBySeason).toHaveBeenCalledWith(
        1,
      );
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet1,
        1,
        'base',
        expect.any(Date),
      );
      expect(vaultSyncService.syncWalletPositions).toHaveBeenCalledWith(
        validWallet2,
        1,
        'base',
        expect.any(Date),
      );
    });

    it('should handle errors during sync', async () => {
      vaultSyncService.syncWalletPositions.mockRejectedValue(
        new Error('Network error'),
      );

      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
        chain: 'base',
      };

      const result = await useCase.execute(dto);

      expect(result.errors).toBe(1);
      expect(result.details[0]).toEqual({
        walletAddress: validWallet1,
        chain: 'base',
        vaultAddress: 'N/A',
        status: 'error',
        error: 'Network error',
      });
    });

    it('should throw error when season not active', async () => {
      seasonRepository.findById.mockResolvedValue(mockInactiveSeason);

      const dto = {
        walletAddress: validWallet1,
        seasonId: 2,
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'Season 2 is not active',
      );
    });

    it('should throw error when season not found', async () => {
      seasonRepository.findById.mockResolvedValue(null);

      const dto = {
        walletAddress: validWallet1,
        seasonId: 999,
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'Season 999 is not active',
      );
    });

    it('should handle errors in position processing', async () => {
      vaultPositionRepository.create.mockRejectedValue(
        new Error('Database error'),
      );

      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
        chain: 'base',
      };

      const result = await useCase.execute(dto);

      expect(result.errors).toBe(1);
      expect(result.details[0]).toEqual({
        walletAddress: validWallet1,
        chain: 'base',
        vaultAddress: vaultAddress1,
        status: 'error',
        error: 'Database error',
      });
    });
  });

  describe('removeStalePositions', () => {
    const stalePosition = new VaultPositionEntity(
      '3',
      validWallet1,
      vaultAddress1,
      'ETH',
      'base',
      '100',
      '100',
      1000,
      4, // Default lock weeks
      new Date('2024-01-01'),
      12345,
      new Date('2024-01-01'),
    );

    beforeEach(() => {
      vaultPositionRepository.findStalePositions.mockResolvedValue([
        stalePosition,
      ]);
    });

    it('should remove positions with zero balance', async () => {
      vaultSyncService.getVaultPosition.mockResolvedValue({
        balance: '0',
        usdValue: 0,
      } as any);
      vaultPositionRepository.delete.mockResolvedValue();

      const result = await useCase.removeStalePositions(1, 24);

      expect(vaultPositionRepository.findStalePositions).toHaveBeenCalledWith(
        expect.any(Date),
      );
      expect(vaultSyncService.getVaultPosition).toHaveBeenCalledWith(
        validWallet1,
        vaultAddress1,
        'base',
      );
      expect(vaultPositionRepository.delete).toHaveBeenCalledWith('3');
      expect(result).toBe(1);
    });

    it('should update positions with non-zero balance', async () => {
      vaultSyncService.getVaultPosition.mockResolvedValue({
        balance: '150',
        usdValue: 1500,
      } as any);
      vaultPositionRepository.update.mockResolvedValue(stalePosition);

      const result = await useCase.removeStalePositions(1, 24);

      expect(vaultPositionRepository.update).toHaveBeenCalled();
      expect(vaultPositionRepository.delete).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should remove positions when vault position not found', async () => {
      vaultSyncService.getVaultPosition.mockResolvedValue(null);
      vaultPositionRepository.delete.mockResolvedValue();

      const result = await useCase.removeStalePositions(1, 24);

      expect(vaultPositionRepository.delete).toHaveBeenCalledWith('3');
      expect(result).toBe(1);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const stalePositions = [stalePosition, mockVaultPosition2];
      vaultPositionRepository.findStalePositions.mockResolvedValue(
        stalePositions,
      );

      vaultSyncService.getVaultPosition
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ balance: '0', usdValue: 0 } as any);

      vaultPositionRepository.delete.mockResolvedValue();

      const result = await useCase.removeStalePositions(1, 24);

      expect(vaultPositionRepository.delete).toHaveBeenCalledTimes(1);
      expect(result).toBe(1);
    });

    it('should use custom stale threshold', async () => {
      vaultPositionRepository.findStalePositions.mockResolvedValue([]);

      await useCase.removeStalePositions(1, 48);

      const expectedDate = expect.any(Date);
      expect(vaultPositionRepository.findStalePositions).toHaveBeenCalledWith(
        expectedDate,
      );
    });

    it('should return 0 when no stale positions found', async () => {
      vaultPositionRepository.findStalePositions.mockResolvedValue([]);

      const result = await useCase.removeStalePositions(1, 24);

      expect(result).toBe(0);
      expect(vaultSyncService.getVaultPosition).not.toHaveBeenCalled();
    });
  });

  describe('processPosition', () => {
    beforeEach(() => {
      seasonRepository.findById.mockResolvedValue(mockActiveSeason);
      vaultPositionRepository.create.mockResolvedValue(mockVaultPosition1);
    });

    it('should handle lowercase conversion for addresses', async () => {
      const upperCasePositionData = {
        ...mockPositionData,
        vaultAddress: vaultAddress1.toUpperCase(),
      };

      vaultSyncService.syncWalletPositions.mockResolvedValue([
        upperCasePositionData,
      ] as any);
      vaultPositionRepository.findByWalletVaultAndSeason.mockResolvedValue(
        null,
      );

      const dto = {
        walletAddress: validWallet1.toUpperCase(),
        seasonId: 1,
        chain: 'base',
      };

      await useCase.execute(dto);

      expect(vaultPositionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: validWallet1.toLowerCase(),
          vaultAddress: vaultAddress1.toLowerCase(),
        }),
      );
    });

    it('should handle missing blockNumber in position data', async () => {
      const positionDataWithoutBlockNumber = {
        ...mockPositionData,
        blockNumber: undefined,
      };

      vaultSyncService.syncWalletPositions.mockResolvedValue([
        positionDataWithoutBlockNumber,
      ] as any);
      vaultPositionRepository.findByWalletVaultAndSeason.mockResolvedValue(
        null,
      );

      const dto = {
        walletAddress: validWallet1,
        seasonId: 1,
        chain: 'base',
      };

      await useCase.execute(dto);

      expect(vaultPositionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blockNumber: 0,
        }),
      );
    });
  });
});
