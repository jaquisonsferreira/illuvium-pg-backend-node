import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getAddress } from 'ethers';
import { SeasonsController } from './seasons.controller';
import { SeasonContextService } from '../../infrastructure/services/season-context.service';
import { SeasonValidationService } from '../../infrastructure/services/season-validation.service';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { CrossSeasonDataService } from '../../infrastructure/services/cross-season-data.service';
import {
  SeasonConfig,
  SeasonContext,
  MigrationStatus,
  SeasonStatusType,
  VaultMechanicsType,
  VaultSeasonConfig,
  VaultStatusType,
} from '../../domain/types/season.types';
import { ChainType } from '../../domain/types/staking-types';

describe('SeasonsController', () => {
  let controller: SeasonsController;
  let seasonContextService: jest.Mocked<SeasonContextService>;
  let vaultConfigService: jest.Mocked<VaultConfigService>;
  let crossSeasonDataService: jest.Mocked<CrossSeasonDataService>;

  const mockCurrentSeason: SeasonConfig = {
    seasonId: 1,
    seasonName: 'Season 1 - Genesis',
    chain: ChainType.BASE,
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-06-01T00:00:00Z',
    status: SeasonStatusType.ACTIVE,
    withdrawalEnabled: false,
    migrationStatus: MigrationStatus.STABLE,
    features: {
      depositsEnabled: true,
      withdrawalsEnabled: false,
      lockedUntilMainnet: true,
      rewardsMultiplier: 1.0,
    },
    vaultMechanics: {
      type: VaultMechanicsType.LOCKED,
      lockDuration: 0,
      earlyWithdrawalPenalty: 0.1,
      compoundingEnabled: true,
      redeemDelayDays: 7,
    },
    migrationConfig: null,
  };

  const mockNextSeason: SeasonConfig = {
    seasonId: 2,
    seasonName: 'Season 2 - Evolution',
    chain: ChainType.OBELISK,
    startDate: '2024-06-01T00:00:00Z',
    endDate: null,
    status: SeasonStatusType.PLANNED,
    withdrawalEnabled: true,
    migrationStatus: MigrationStatus.UPCOMING,
    features: {
      depositsEnabled: true,
      withdrawalsEnabled: true,
      lockedUntilMainnet: false,
      rewardsMultiplier: 1.2,
    },
    vaultMechanics: {
      type: VaultMechanicsType.ERC4626,
      lockDuration: 0,
      earlyWithdrawalPenalty: 0,
      compoundingEnabled: true,
      redeemDelayDays: 0,
    },
    migrationConfig: {
      fromChain: ChainType.BASE,
      toChain: ChainType.OBELISK,
      migrationStartTime: '2024-05-15T00:00:00Z',
      migrationEndTime: '2024-05-31T23:59:59Z',
      migrationDeadline: '2024-06-15T23:59:59Z',
      userActionRequired: true,
      migrationGuideUrl: 'https://docs.illuvium.io/migration-guide',
    },
  };

  const mockSeasonContext: SeasonContext = {
    currentSeason: mockCurrentSeason,
    nextSeason: mockNextSeason,
    migrationInfo: {
      status: MigrationStatus.UPCOMING,
      newVaultId: 'vault-s2-ilv',
      newChain: ChainType.OBELISK,
      migrationDeadline: '2024-06-15T23:59:59Z',
      userActionRequired: true,
      migrationGuideUrl: 'https://docs.illuvium.io/migration-guide',
    },
    estimatedMigrationDate: '2024-05-15T00:00:00Z',
  };

  const mockVaultConfigs: VaultSeasonConfig[] = [
    {
      vaultId: 'vault-s1-ilv',
      vaultAddress: '0x1234567890123456789012345678901234567890',
      name: 'ILV Staking Vault S1',
      chain: ChainType.BASE,
      seasonId: 1,
      status: VaultStatusType.ACTIVE,
      underlyingAsset: 'ILV',
      mechanics: {
        withdrawalEnabled: false,
        lockedUntilMainnet: true,
        redeemDelayDays: 7,
      },
    },
    {
      vaultId: 'vault-s2-ilv',
      vaultAddress: '0x2345678901234567890123456789012345678901',
      name: 'ILV Staking Vault S2',
      chain: ChainType.OBELISK,
      seasonId: 2,
      status: VaultStatusType.PLANNED,
      underlyingAsset: 'ILV',
      mechanics: {
        withdrawalEnabled: true,
        lockedUntilMainnet: false,
        redeemDelayDays: 0,
      },
    },
  ];

  beforeEach(async () => {
    const mockSeasonContextService = {
      getSeasonContext: jest.fn(),
      getSeasonById: jest.fn(),
      getAllSeasons: jest.fn(),
      isSeasonActive: jest.fn(),
      isMigrationPeriod: jest.fn(),
      getMigrationTimeRemaining: jest.fn(),
    };

    const mockSeasonValidationService = {
      validateSeasonOperation: jest.fn(),
      validateDeposit: jest.fn(),
      validateWithdrawal: jest.fn(),
      validateTransfer: jest.fn(),
      validateMigration: jest.fn(),
      isOperationAllowed: jest.fn(),
    };

    const mockVaultConfigService = {
      getAllVaultSeasonConfigs: jest.fn(),
      getVaultSeasonConfig: jest.fn(),
    };

    const mockCrossSeasonDataService = {
      getUserPositionsAcrossSeasons: jest.fn(),
      getHistoricalShardsEarned: jest.fn(),
      getCrossSeasonAnalytics: jest.fn(),
      getVaultCorrelationData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonsController],
      providers: [
        {
          provide: SeasonContextService,
          useValue: mockSeasonContextService,
        },
        {
          provide: SeasonValidationService,
          useValue: mockSeasonValidationService,
        },
        {
          provide: VaultConfigService,
          useValue: mockVaultConfigService,
        },
        {
          provide: CrossSeasonDataService,
          useValue: mockCrossSeasonDataService,
        },
      ],
    }).compile();

    controller = module.get<SeasonsController>(SeasonsController);
    seasonContextService = module.get(SeasonContextService);
    _seasonValidationService = module.get(SeasonValidationService);
    vaultConfigService = module.get(VaultConfigService);
    crossSeasonDataService = module.get(CrossSeasonDataService);

    jest.spyOn(controller['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentSeason', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return current season information successfully', async () => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );

      const result = await controller.getCurrentSeason();

      expect(result).toBeDefined();
      expect(result.currentSeason).toBeDefined();
      expect(result.currentSeason.seasonId).toBe(1);
      expect(result.currentSeason.seasonName).toBe('Season 1 - Genesis');
      expect(result.nextSeason).toBeDefined();
      expect(result.nextSeason!.seasonId).toBe(2);
      expect(result.migrationInfo).toBeDefined();
      expect(result.migrationInfo!.status).toBe('upcoming');
      expect(result.estimatedMigrationDate).toBe('2024-05-15T00:00:00Z');
      expect(result.timestamp).toBeDefined();
    });

    it('should return current season without next season when none exists', async () => {
      const contextWithoutNextSeason = {
        ...mockSeasonContext,
        nextSeason: undefined,
        migrationInfo: undefined,
        estimatedMigrationDate: undefined,
      };
      seasonContextService.getSeasonContext.mockResolvedValue(
        contextWithoutNextSeason,
      );

      const result = await controller.getCurrentSeason();

      expect(result.currentSeason).toBeDefined();
      expect(result.nextSeason).toBeUndefined();
      expect(result.migrationInfo).toBeUndefined();
      expect(result.estimatedMigrationDate).toBeUndefined();
    });

    it('should throw 404 when no current season found', async () => {
      seasonContextService.getSeasonContext.mockResolvedValue(null);

      await expect(controller.getCurrentSeason()).rejects.toThrow(
        new HttpException('No current season found', HttpStatus.NOT_FOUND),
      );
    });

    it('should handle service errors and throw 500', async () => {
      const error = new Error('Service error');
      seasonContextService.getSeasonContext.mockRejectedValue(error);

      await expect(controller.getCurrentSeason()).rejects.toThrow(
        new HttpException(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
      expect(controller['logger'].error).toHaveBeenCalledWith(
        'Failed to get current season',
        error,
      );
    });

    it('should re-throw HttpExceptions', async () => {
      const httpError = new HttpException(
        'Custom error',
        HttpStatus.BAD_REQUEST,
      );
      seasonContextService.getSeasonContext.mockRejectedValue(httpError);

      await expect(controller.getCurrentSeason()).rejects.toThrow(httpError);
    });
  });

  describe('getSeasonDetails', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return detailed season information successfully', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(mockCurrentSeason);
      seasonContextService.isSeasonActive.mockResolvedValue(true);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );

      const result = await controller.getSeasonDetails(1);

      expect(result).toBeDefined();
      expect(result.season).toBeDefined();
      expect(result.season.seasonId).toBe(1);
      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0].vaultId).toBe('vault-s1-ilv');
      expect(result.statistics).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.isActive).toBe(true);
      expect(result.canDeposit).toBe(true);
      expect(result.canWithdraw).toBe(false);
      expect(result.canMigrate).toBe(false);
      expect(result.timestamp).toBeDefined();
    });

    it('should return correct capabilities based on season features', async () => {
      const seasonWithWithdrawals = {
        ...mockCurrentSeason,
        features: {
          ...mockCurrentSeason.features,
          withdrawalsEnabled: true,
        },
        migrationConfig: mockNextSeason.migrationConfig,
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        seasonWithWithdrawals,
      );
      seasonContextService.isSeasonActive.mockResolvedValue(true);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );

      const result = await controller.getSeasonDetails(1);

      expect(result.canWithdraw).toBe(true);
      expect(result.canMigrate).toBe(true);
    });

    it('should throw 404 when season not found', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(null);

      await expect(controller.getSeasonDetails(999)).rejects.toThrow(
        new HttpException('Season 999 not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should handle service errors and throw 500', async () => {
      const error = new Error('Service error');
      seasonContextService.getSeasonById.mockRejectedValue(error);

      await expect(controller.getSeasonDetails(1)).rejects.toThrow(
        new HttpException(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
      expect(controller['logger'].error).toHaveBeenCalledWith(
        'Failed to get season 1 details',
        error,
      );
    });

    it('should return timeline with correct migration dates', async () => {
      const seasonWithMigration = {
        ...mockCurrentSeason,
        migrationConfig: mockNextSeason.migrationConfig,
      };
      seasonContextService.getSeasonById.mockResolvedValue(seasonWithMigration);
      seasonContextService.isSeasonActive.mockResolvedValue(true);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );

      const result = await controller.getSeasonDetails(1);

      expect(result.timeline.migrationStartDate).toBe('2024-05-15T00:00:00Z');
      expect(result.timeline.migrationEndDate).toBe('2024-05-31T23:59:59Z');
      expect(result.timeline.migrationDeadline).toBe('2024-06-15T23:59:59Z');
    });
  });

  describe('getMigrationStatus', () => {
    const validWallet = '0x1234567890123456789012345678901234567890';
    const lowercaseWallet = '0xabcdef1234567890123456789012345678901234';
    const mixedCaseWallet = '0xaBcDef1234567890123456789012345678901234';
    const uppercaseWallet = '0xABCDEF1234567890123456789012345678901234';
    const invalidWallet = 'invalid-address';
    const shortWallet = '0x123';
    const noPrefix = '1234567890123456789012345678901234567890';
    const invalidCharsWallet = '0xGHIJKL1234567890123456789012345678901234';

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return migration status for valid wallet', async () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      seasonContextService.getMigrationTimeRemaining.mockResolvedValue(3600000);
      seasonContextService.isMigrationPeriod.mockResolvedValue(false);

      const result = await controller.getMigrationStatus(validWallet);

      expect(result).toBeDefined();
      expect(result.wallet).toBe(getAddress(validWallet));
      expect(result.vaults).toHaveLength(2);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalVaults).toBe(2);
      expect(result.migrationDeadline).toBeDefined();
      expect(result.timeRemaining).toBe(3600000);
      expect(result.migrationPeriodActive).toBe(false);
      expect(result.timestamp).toBeDefined();
    });

    it('should checksum lowercase wallet address', async () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      seasonContextService.getMigrationTimeRemaining.mockResolvedValue(3600000);
      seasonContextService.isMigrationPeriod.mockResolvedValue(false);

      const result = await controller.getMigrationStatus(lowercaseWallet);

      expect(result.wallet).toBe(getAddress(lowercaseWallet));
      expect(result.wallet).not.toBe(lowercaseWallet);
    });

    it('should checksum mixed case wallet address', async () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      seasonContextService.getMigrationTimeRemaining.mockResolvedValue(3600000);
      seasonContextService.isMigrationPeriod.mockResolvedValue(false);

      const result = await controller.getMigrationStatus(mixedCaseWallet);

      expect(result.wallet).toBe(getAddress(mixedCaseWallet));
    });

    it('should checksum uppercase wallet address', async () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      seasonContextService.getMigrationTimeRemaining.mockResolvedValue(3600000);
      seasonContextService.isMigrationPeriod.mockResolvedValue(false);

      const result = await controller.getMigrationStatus(uppercaseWallet);

      expect(result.wallet).toBe(getAddress(uppercaseWallet));
    });

    it('should throw 400 for invalid wallet address', async () => {
      await expect(
        controller.getMigrationStatus(invalidWallet),
      ).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 for short wallet address', async () => {
      await expect(controller.getMigrationStatus(shortWallet)).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 for wallet address without 0x prefix', async () => {
      await expect(controller.getMigrationStatus(noPrefix)).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 for wallet address with invalid characters', async () => {
      await expect(
        controller.getMigrationStatus(invalidCharsWallet),
      ).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should calculate correct migration summary', async () => {
      const vaultsWithDeprecated = [
        ...mockVaultConfigs,
        {
          ...mockVaultConfigs[0],
          vaultId: 'vault-deprecated',
          status: VaultStatusType.DEPRECATED,
        },
      ];
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        vaultsWithDeprecated,
      );
      seasonContextService.getMigrationTimeRemaining.mockResolvedValue(3600000);
      seasonContextService.isMigrationPeriod.mockResolvedValue(true);

      const result = await controller.getMigrationStatus(validWallet);

      expect(result.summary.totalVaults).toBe(3);
      expect(result.migrationPeriodActive).toBe(true);
    });

    it('should handle service errors and throw 500', async () => {
      const error = new Error('Service error');
      vaultConfigService.getAllVaultSeasonConfigs.mockImplementation(() => {
        throw error;
      });

      await expect(controller.getMigrationStatus(validWallet)).rejects.toThrow(
        new HttpException(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
      expect(controller['logger'].error).toHaveBeenCalledWith(
        'Failed to get migration status',
        error,
      );
    });

    it('should handle null migration time remaining', async () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      seasonContextService.getMigrationTimeRemaining.mockResolvedValue(null);
      seasonContextService.isMigrationPeriod.mockResolvedValue(false);

      const result = await controller.getMigrationStatus(validWallet);

      expect(result.timeRemaining).toBe(0);
    });
  });

  describe('getCrossSeasonPositions', () => {
    const validWallet = '0x1234567890123456789012345678901234567890';
    const lowercaseWallet = '0xabcdef1234567890123456789012345678901234';
    const invalidWallet = 'invalid-address';
    const shortWallet = '0x123';
    const noPrefix = '1234567890123456789012345678901234567890';
    const invalidCharsWallet = '0xGHIJKL1234567890123456789012345678901234';

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return cross-season positions for valid wallet', async () => {
      const mockCrossSeasonPositions = {
        data: {
          wallet: getAddress(validWallet),
          positionsBySeason: [
            {
              seasonId: 1,
              chain: ChainType.BASE,
              vaultId: 'vault1',
              status: 'active',
              balance: '1000000000000000000',
              requiresMigration: false,
              migrationTarget: false,
            },
          ],
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      const mockShardsData = {
        data: {
          totalShards: '1000000000000000000',
          season1Shards: '600000000000000000',
          season2Shards: '400000000000000000',
          multiplierBonus: 80000000000000000,
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      seasonContextService.getAllSeasons.mockResolvedValue([
        mockCurrentSeason,
        mockNextSeason,
      ]);
      seasonContextService.isSeasonActive.mockResolvedValue(true);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      crossSeasonDataService.getUserPositionsAcrossSeasons.mockResolvedValue(
        mockCrossSeasonPositions as any,
      );
      crossSeasonDataService.getHistoricalShardsEarned.mockResolvedValue(
        mockShardsData as any,
      );

      const result = await controller.getCrossSeasonPositions(validWallet);

      expect(result).toBeDefined();
      expect(result.wallet).toBe(getAddress(validWallet));
      expect(result.positionsBySeason).toBeDefined();
      expect(result.seasonSummaries).toHaveLength(2);
      expect(result.totals).toBeDefined();
      expect(result.migrationPaths).toHaveLength(1);
      expect(result.hasPendingMigrations).toBe(false);
      expect(result.timestamp).toBeDefined();
    });

    it('should checksum lowercase wallet address', async () => {
      const mockCrossSeasonPositions = {
        data: {
          wallet: getAddress(lowercaseWallet),
          positionsBySeason: [],
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      const mockShardsData = {
        data: {
          totalShards: '0',
          season1Shards: '0',
          season2Shards: '0',
          multiplierBonus: 0,
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      seasonContextService.getAllSeasons.mockResolvedValue([
        mockCurrentSeason,
        mockNextSeason,
      ]);
      seasonContextService.isSeasonActive.mockResolvedValue(true);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      crossSeasonDataService.getUserPositionsAcrossSeasons.mockResolvedValue(
        mockCrossSeasonPositions as any,
      );
      crossSeasonDataService.getHistoricalShardsEarned.mockResolvedValue(
        mockShardsData as any,
      );

      const result = await controller.getCrossSeasonPositions(lowercaseWallet);

      expect(result.wallet).toBe(getAddress(lowercaseWallet));
      expect(result.wallet).not.toBe(lowercaseWallet);
      expect(
        crossSeasonDataService.getUserPositionsAcrossSeasons,
      ).toHaveBeenCalledWith(getAddress(lowercaseWallet));
      expect(
        crossSeasonDataService.getHistoricalShardsEarned,
      ).toHaveBeenCalledWith(getAddress(lowercaseWallet));
    });

    it('should throw 400 for invalid wallet address', async () => {
      await expect(
        controller.getCrossSeasonPositions(invalidWallet),
      ).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 for short wallet address', async () => {
      await expect(
        controller.getCrossSeasonPositions(shortWallet),
      ).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 for wallet address without 0x prefix', async () => {
      await expect(
        controller.getCrossSeasonPositions(noPrefix),
      ).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 for wallet address with invalid characters', async () => {
      await expect(
        controller.getCrossSeasonPositions(invalidCharsWallet),
      ).rejects.toThrow(
        new HttpException('Invalid wallet address', HttpStatus.BAD_REQUEST),
      );
    });

    it('should handle seasons without migration config', async () => {
      const seasonWithoutMigration = {
        ...mockCurrentSeason,
        migrationConfig: null,
      };

      const mockCrossSeasonPositions = {
        data: {
          wallet: getAddress(validWallet),
          positionsBySeason: [],
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      const mockShardsData = {
        data: {
          totalShards: '0',
          season1Shards: '0',
          season2Shards: '0',
          multiplierBonus: 0,
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      seasonContextService.getAllSeasons.mockResolvedValue([
        seasonWithoutMigration,
      ]);
      seasonContextService.isSeasonActive.mockResolvedValue(true);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      crossSeasonDataService.getUserPositionsAcrossSeasons.mockResolvedValue(
        mockCrossSeasonPositions as any,
      );
      crossSeasonDataService.getHistoricalShardsEarned.mockResolvedValue(
        mockShardsData as any,
      );

      const result = await controller.getCrossSeasonPositions(validWallet);

      expect(result.migrationPaths).toHaveLength(0);
    });

    it('should calculate correct totals across seasons', async () => {
      const mockCrossSeasonPositions = {
        data: {
          wallet: getAddress(validWallet),
          positionsBySeason: [],
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      const mockShardsData = {
        data: {
          totalShards: '0',
          season1Shards: '0',
          season2Shards: '0',
          multiplierBonus: 0,
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      seasonContextService.getAllSeasons.mockResolvedValue([
        mockCurrentSeason,
        mockNextSeason,
      ]);
      seasonContextService.isSeasonActive
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );
      crossSeasonDataService.getUserPositionsAcrossSeasons.mockResolvedValue(
        mockCrossSeasonPositions as any,
      );
      crossSeasonDataService.getHistoricalShardsEarned.mockResolvedValue(
        mockShardsData as any,
      );

      const result = await controller.getCrossSeasonPositions(validWallet);

      expect(result.totals.activeSeasons).toBe(1);
      expect(result.totals.totalPositions).toBe(0); // No actual balances in mock
    });

    it('should handle service errors and throw 500', async () => {
      const error = new Error('Service error');
      seasonContextService.getAllSeasons.mockRejectedValue(error);

      await expect(
        controller.getCrossSeasonPositions(validWallet),
      ).rejects.toThrow(
        new HttpException(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
      expect(controller['logger'].error).toHaveBeenCalledWith(
        'Failed to get cross-season positions',
        error,
      );
    });
  });

  describe('isValidEthereumAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      const validAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xABCDEF1234567890123456789012345678901234',
        '0xabcdef1234567890123456789012345678901234',
        '0x0000000000000000000000000000000000000000',
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      validAddresses.forEach((address) => {
        expect(controller['isValidEthereumAddress'](address)).toBe(true);
      });
    });

    it('should reject invalid Ethereum addresses', () => {
      const invalidAddresses = [
        '1234567890123456789012345678901234567890', // Missing 0x prefix
        '0x123456789012345678901234567890123456789', // Too short
        '0x12345678901234567890123456789012345678900', // Too long
        '0xGHIJKL1234567890123456789012345678901234', // Invalid characters
        '', // Empty string
        '0x', // Only prefix
        'not-an-address', // Random string
        null, // Null value
        undefined, // Undefined value
      ];

      invalidAddresses.forEach((address) => {
        expect(controller['isValidEthereumAddress'](address as any)).toBe(
          false,
        );
      });
    });
  });

  describe('mapSeasonToDto', () => {
    it('should map season config to DTO correctly', () => {
      const dto = controller['mapSeasonToDto'](mockCurrentSeason);

      expect(dto).toBeDefined();
      expect(dto.seasonId).toBe(mockCurrentSeason.seasonId);
      expect(dto.seasonName).toBe(mockCurrentSeason.seasonName);
      expect(dto.chain).toBe(mockCurrentSeason.chain);
      expect(dto.startDate).toBe(mockCurrentSeason.startDate);
      expect(dto.endDate).toBe(mockCurrentSeason.endDate);
      expect(dto.status).toBe(mockCurrentSeason.status);
      expect(dto.withdrawalEnabled).toBe(mockCurrentSeason.withdrawalEnabled);
      expect(dto.migrationStatus).toBe(mockCurrentSeason.migrationStatus);
      expect(dto.features).toEqual(mockCurrentSeason.features);
      expect(dto.vaultMechanics).toEqual({
        ...mockCurrentSeason.vaultMechanics,
        type: mockCurrentSeason.vaultMechanics.type,
      });
      expect(dto.migrationConfig).toBeUndefined();
    });

    it('should handle season with migration config', () => {
      const dto = controller['mapSeasonToDto'](mockNextSeason);

      expect(dto.migrationConfig).toBeDefined();
      expect(dto.migrationConfig!.fromChain).toBe(
        mockNextSeason.migrationConfig!.fromChain,
      );
      expect(dto.migrationConfig!.toChain).toBe(
        mockNextSeason.migrationConfig!.toChain,
      );
      expect(dto.migrationConfig!.migrationStartTime).toBe(
        mockNextSeason.migrationConfig!.migrationStartTime,
      );
      expect(dto.migrationConfig!.migrationEndTime).toBe(
        mockNextSeason.migrationConfig!.migrationEndTime,
      );
      expect(dto.migrationConfig!.migrationDeadline).toBe(
        mockNextSeason.migrationConfig!.migrationDeadline,
      );
    });
  });

  describe('getSeasonTimeline', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-10T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate timeline correctly for season with migration', async () => {
      const timeline = await controller['getSeasonTimeline'](mockNextSeason);

      expect(timeline).toBeDefined();
      expect(timeline.startDate).toBe(mockNextSeason.startDate);
      expect(timeline.endDate).toBeUndefined();
      expect(timeline.migrationStartDate).toBe(
        mockNextSeason.migrationConfig!.migrationStartTime,
      );
      expect(timeline.migrationEndDate).toBe(
        mockNextSeason.migrationConfig!.migrationEndTime,
      );
      expect(timeline.migrationDeadline).toBe(
        mockNextSeason.migrationConfig!.migrationDeadline,
      );
      expect(timeline.daysUntilMigration).toBe(5); // 5 days from 2024-05-10 to 2024-05-15
      expect(timeline.migrationTimeRemaining).toBeGreaterThan(0);
    });

    it('should handle season without migration config', async () => {
      const timeline = await controller['getSeasonTimeline'](mockCurrentSeason);

      expect(timeline.migrationStartDate).toBeUndefined();
      expect(timeline.migrationEndDate).toBeUndefined();
      expect(timeline.migrationDeadline).toBeUndefined();
      expect(timeline.daysUntilMigration).toBeUndefined();
      expect(timeline.migrationTimeRemaining).toBeUndefined();
    });

    it('should not set daysUntilMigration when migration has started', async () => {
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z'));

      const timeline = await controller['getSeasonTimeline'](mockNextSeason);

      expect(timeline.daysUntilMigration).toBeUndefined();
    });

    it('should not set migrationTimeRemaining when deadline has passed', async () => {
      jest.setSystemTime(new Date('2024-06-20T12:00:00Z'));

      const timeline = await controller['getSeasonTimeline'](mockNextSeason);

      expect(timeline.migrationTimeRemaining).toBeUndefined();
    });
  });

  describe('getVaultStatusDescription', () => {
    it('should return correct descriptions for all status types', () => {
      expect(controller['getVaultStatusDescription']('active')).toBe(
        'Active and accepting deposits',
      );
      expect(controller['getVaultStatusDescription']('planned')).toBe(
        'Planned for future use',
      );
      expect(controller['getVaultStatusDescription']('deprecated')).toBe(
        'Deprecated - migration recommended',
      );
      expect(controller['getVaultStatusDescription']('migrating')).toBe(
        'Currently in migration',
      );
      expect(controller['getVaultStatusDescription']('unknown')).toBe(
        'Unknown status',
      );
    });
  });

  describe('getVaultsForSeason', () => {
    it('should filter vaults by season ID', () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );

      const season1Vaults = controller['getVaultsForSeason'](1);
      const season2Vaults = controller['getVaultsForSeason'](2);

      expect(season1Vaults).toHaveLength(1);
      expect(season1Vaults[0].seasonId).toBe(1);
      expect(season2Vaults).toHaveLength(1);
      expect(season2Vaults[0].seasonId).toBe(2);
    });

    it('should return empty array for non-existent season', () => {
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs,
      );

      const nonExistentSeasonVaults = controller['getVaultsForSeason'](999);

      expect(nonExistentSeasonVaults).toHaveLength(0);
    });
  });
});
