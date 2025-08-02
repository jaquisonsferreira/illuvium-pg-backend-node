import { Test, TestingModule } from '@nestjs/testing';
import { SeasonContextService } from './season-context.service';
import { VaultConfigService } from '../config/vault-config.service';
import {
  SeasonConfig,
  MigrationStatus,
  SeasonStatusType,
  VaultMechanicsType,
  VaultSeasonConfig,
  VaultStatusType,
} from '../../domain/types/season.types';
import { ChainType } from '../../domain/types/staking-types';

describe('SeasonContextService', () => {
  let service: SeasonContextService;
  let vaultConfigService: jest.Mocked<VaultConfigService>;

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

  const mockVaultSeasonConfigs: VaultSeasonConfig[] = [
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
    const mockVaultConfigService = {
      getCurrentSeasonFromFile: jest.fn(),
      getNextSeasonFromFile: jest.fn(),
      getSeasonConfigFromFile: jest.fn(),
      getAllSeasonConfigsFromFile: jest.fn(),
      getAllVaultSeasonConfigs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonContextService,
        {
          provide: VaultConfigService,
          useValue: mockVaultConfigService,
        },
      ],
    }).compile();

    service = module.get<SeasonContextService>(SeasonContextService);
    vaultConfigService = module.get(VaultConfigService);

    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSeasonContext', () => {
    it('should return complete season context with current and next season', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-10T12:00:00Z')); // Before migration start

      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(mockNextSeason);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = await service.getSeasonContext();

      expect(result).toBeDefined();
      expect(result?.currentSeason).toEqual(mockCurrentSeason);
      expect(result?.nextSeason).toEqual(mockNextSeason);
      expect(result?.migrationInfo).toBeDefined();
      expect(result?.migrationInfo?.status).toBe(MigrationStatus.UPCOMING);
      expect(result?.estimatedMigrationDate).toBe(
        mockNextSeason.migrationConfig!.migrationStartTime,
      );

      jest.useRealTimers();
    });

    it('should return context with only current season when no next season exists', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(undefined);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = await service.getSeasonContext();

      expect(result).toBeDefined();
      expect(result?.currentSeason).toEqual(mockCurrentSeason);
      expect(result?.nextSeason).toBeUndefined();
      expect(result?.migrationInfo).toBeUndefined();
      expect(result?.estimatedMigrationDate).toBeUndefined();
    });

    it('should return null when no current season exists', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(undefined);

      const result = await service.getSeasonContext();

      expect(result).toBeNull();
      expect(service['logger'].warn).toHaveBeenCalledWith(
        'No current season found',
      );
    });

    it('should throw error when vault config service fails', async () => {
      const error = new Error('Configuration service error');
      vaultConfigService.getCurrentSeasonFromFile.mockImplementation(() => {
        throw error;
      });

      await expect(service.getSeasonContext()).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Failed to get season context',
        error,
      );
    });
  });

  describe('getCurrentSeason', () => {
    it('should return current season', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );

      const result = await service.getCurrentSeason();

      expect(result).toEqual(mockCurrentSeason);
    });

    it('should return null when no current season', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(undefined);

      const result = await service.getCurrentSeason();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Service error');
      vaultConfigService.getCurrentSeasonFromFile.mockImplementation(() => {
        throw error;
      });

      await expect(service.getCurrentSeason()).rejects.toThrow(error);
    });
  });

  describe('getSeasonById', () => {
    it('should return season by ID', async () => {
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(
        mockCurrentSeason,
      );

      const result = await service.getSeasonById(1);

      expect(result).toEqual(mockCurrentSeason);
      expect(vaultConfigService.getSeasonConfigFromFile).toHaveBeenCalledWith(
        1,
      );
    });

    it('should return null when season not found', async () => {
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(undefined);

      const result = await service.getSeasonById(999);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Service error');
      vaultConfigService.getSeasonConfigFromFile.mockImplementation(() => {
        throw error;
      });

      await expect(service.getSeasonById(1)).rejects.toThrow(error);
    });
  });

  describe('getAllSeasons', () => {
    it('should return all seasons', async () => {
      const allSeasons = [mockCurrentSeason, mockNextSeason];
      vaultConfigService.getAllSeasonConfigsFromFile.mockReturnValue(
        allSeasons,
      );

      const result = await service.getAllSeasons();

      expect(result).toEqual(allSeasons);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Service error');
      vaultConfigService.getAllSeasonConfigsFromFile.mockImplementation(() => {
        throw error;
      });

      await expect(service.getAllSeasons()).rejects.toThrow(error);
    });
  });

  describe('isSeasonActive', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for active season within date range', async () => {
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(
        mockCurrentSeason,
      );

      const result = await service.isSeasonActive(1);

      expect(result).toBe(true);
    });

    it('should return false for season before start date', async () => {
      const futureSeason = {
        ...mockCurrentSeason,
        startDate: '2024-12-01T00:00:00Z',
      };
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(futureSeason);

      const result = await service.isSeasonActive(1);

      expect(result).toBe(false);
    });

    it('should return false for season after end date', async () => {
      const pastSeason = {
        ...mockCurrentSeason,
        endDate: '2024-02-01T00:00:00Z',
      };
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(pastSeason);

      const result = await service.isSeasonActive(1);

      expect(result).toBe(false);
    });

    it('should return false for inactive season', async () => {
      const inactiveSeason = {
        ...mockCurrentSeason,
        status: SeasonStatusType.ENDED,
      };
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(
        inactiveSeason,
      );

      const result = await service.isSeasonActive(1);

      expect(result).toBe(false);
    });

    it('should return false when season not found', async () => {
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(undefined);

      const result = await service.isSeasonActive(999);

      expect(result).toBe(false);
    });

    it('should return true for season with no end date when active', async () => {
      const openEndedSeason = {
        ...mockCurrentSeason,
        endDate: null,
      };
      vaultConfigService.getSeasonConfigFromFile.mockReturnValue(
        openEndedSeason,
      );

      const result = await service.isSeasonActive(1);

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      vaultConfigService.getSeasonConfigFromFile.mockImplementation(() => {
        throw new Error('Service error');
      });

      const result = await service.isSeasonActive(1);

      expect(result).toBe(false);
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('isMigrationPeriod', () => {
    it('should return true when in migration period', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z')); // During migration period

      const seasonWithMigration = {
        ...mockCurrentSeason,
        migrationStatus: MigrationStatus.MIGRATING,
      };
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        seasonWithMigration,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(mockNextSeason);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = await service.isMigrationPeriod();

      expect(result).toBe(true);
      jest.useRealTimers();
    });

    it('should return false when not in migration period', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(mockNextSeason);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = await service.isMigrationPeriod();

      expect(result).toBe(false);
    });

    it('should return false when no season context', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(undefined);

      const result = await service.isMigrationPeriod();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockImplementation(() => {
        throw new Error('Service error');
      });

      const result = await service.isMigrationPeriod();

      expect(result).toBe(false);
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('getMigrationTimeRemaining', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-10T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return time remaining until migration deadline', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(mockNextSeason);
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = await service.getMigrationTimeRemaining();

      const expectedTime =
        new Date('2024-06-15T23:59:59Z').getTime() -
        new Date('2024-06-10T12:00:00Z').getTime();
      expect(result).toBe(expectedTime);
    });

    it('should return 0 when migration deadline has passed', async () => {
      const pastDeadlineSeason = {
        ...mockNextSeason,
        migrationConfig: {
          ...mockNextSeason.migrationConfig!,
          migrationDeadline: '2024-06-05T23:59:59Z',
        },
      };
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(
        pastDeadlineSeason,
      );
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = await service.getMigrationTimeRemaining();

      expect(result).toBe(0);
    });

    it('should return null when no migration deadline', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockReturnValue(
        mockCurrentSeason,
      );
      vaultConfigService.getNextSeasonFromFile.mockReturnValue(undefined);

      const result = await service.getMigrationTimeRemaining();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      vaultConfigService.getCurrentSeasonFromFile.mockImplementation(() => {
        throw new Error('Service error');
      });

      const result = await service.getMigrationTimeRemaining();

      expect(result).toBeNull();
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('validateSeasonTransition', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should validate successful season transition', async () => {
      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(mockNextSeason);

      const result = await service.validateSeasonTransition(1, 2);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for non-consecutive seasons', async () => {
      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(mockNextSeason);

      const result = await service.validateSeasonTransition(1, 3);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Seasons must be consecutive');
    });

    it('should fail validation when source season not found', async () => {
      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(mockNextSeason);

      const result = await service.validateSeasonTransition(999, 2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source season 999 not found');
    });

    it('should fail validation when target season not found', async () => {
      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(undefined);

      const result = await service.validateSeasonTransition(1, 999);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Target season 999 not found');
    });

    it('should fail validation when target season has no migration config', async () => {
      const seasonWithoutMigration = {
        ...mockNextSeason,
        migrationConfig: null,
      };
      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(seasonWithoutMigration);

      const result = await service.validateSeasonTransition(1, 2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Target season has no migration configuration',
      );
    });

    it('should fail validation when chains are the same', async () => {
      const sameChainSeason = {
        ...mockNextSeason,
        chain: ChainType.BASE,
      };
      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(sameChainSeason);

      const result = await service.validateSeasonTransition(1, 2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration requires different chains');
    });

    it('should fail validation when migration period has not started', async () => {
      jest.setSystemTime(new Date('2024-05-10T12:00:00Z'));

      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(mockNextSeason);

      const result = await service.validateSeasonTransition(1, 2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration period has not started');
    });

    it('should fail validation when migration period has ended', async () => {
      jest.setSystemTime(new Date('2024-06-20T12:00:00Z'));

      vaultConfigService.getSeasonConfigFromFile
        .mockReturnValueOnce(mockCurrentSeason)
        .mockReturnValueOnce(mockNextSeason);

      const result = await service.validateSeasonTransition(1, 2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration period has ended');
    });

    it('should handle internal errors gracefully', async () => {
      vaultConfigService.getSeasonConfigFromFile.mockImplementation(() => {
        throw new Error('Service error');
      });

      const result = await service.validateSeasonTransition(1, 2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Internal error validating season transition',
      );
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('buildMigrationInfo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return undefined when no next season', () => {
      const result = service['buildMigrationInfo'](mockCurrentSeason);

      expect(result).toBeUndefined();
    });

    it('should return undefined when next season has no migration config', () => {
      const seasonWithoutMigration = {
        ...mockNextSeason,
        migrationConfig: null,
      };

      const result = service['buildMigrationInfo'](
        mockCurrentSeason,
        seasonWithoutMigration,
      );

      expect(result).toBeUndefined();
    });

    it('should return UPCOMING status before migration start', () => {
      jest.setSystemTime(new Date('2024-05-10T12:00:00Z'));
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = service['buildMigrationInfo'](
        mockCurrentSeason,
        mockNextSeason,
      );

      expect(result?.status).toBe(MigrationStatus.UPCOMING);
    });

    it('should return MIGRATING status during migration period', () => {
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z'));
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = service['buildMigrationInfo'](
        mockCurrentSeason,
        mockNextSeason,
      );

      expect(result?.status).toBe(MigrationStatus.MIGRATING);
    });

    it('should return COMPLETED status after migration end but before deadline', () => {
      jest.setSystemTime(new Date('2024-06-05T12:00:00Z'));
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = service['buildMigrationInfo'](
        mockCurrentSeason,
        mockNextSeason,
      );

      expect(result?.status).toBe(MigrationStatus.COMPLETED);
    });

    it('should return STABLE status after migration deadline', () => {
      jest.setSystemTime(new Date('2024-06-20T12:00:00Z'));
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = service['buildMigrationInfo'](
        mockCurrentSeason,
        mockNextSeason,
      );

      expect(result?.status).toBe(MigrationStatus.STABLE);
    });

    it('should include correct migration info properties', () => {
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z'));
      vaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultSeasonConfigs,
      );

      const result = service['buildMigrationInfo'](
        mockCurrentSeason,
        mockNextSeason,
      );

      expect(result).toEqual({
        status: MigrationStatus.MIGRATING,
        newVaultId: 'vault-s2-ilv',
        newChain: ChainType.OBELISK,
        migrationDeadline: '2024-06-15T23:59:59Z',
        userActionRequired: true,
        migrationGuideUrl: 'https://docs.illuvium.io/migration-guide',
      });
    });
  });

  describe('calculateEstimatedMigrationDate', () => {
    it('should return migration start time', () => {
      const result = service['calculateEstimatedMigrationDate'](
        mockCurrentSeason,
        mockNextSeason,
      );

      expect(result).toBe('2024-05-15T00:00:00Z');
    });

    it('should return undefined when no next season', () => {
      const result =
        service['calculateEstimatedMigrationDate'](mockCurrentSeason);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no migration config', () => {
      const seasonWithoutMigration = {
        ...mockNextSeason,
        migrationConfig: null,
      };

      const result = service['calculateEstimatedMigrationDate'](
        mockCurrentSeason,
        seasonWithoutMigration,
      );

      expect(result).toBeUndefined();
    });
  });
});
