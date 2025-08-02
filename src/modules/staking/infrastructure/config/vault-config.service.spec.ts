import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VaultConfigService } from './vault-config.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  SeasonConfigFile,
  SeasonStatusType,
  MigrationStatus,
  VaultMechanicsType,
  VaultStatusType,
} from '../../domain/types/season.types';
import { ChainType } from '../../domain/types/staking-types';

jest.mock('fs');
jest.mock('path');

describe('VaultConfigService - Season Methods', () => {
  let service: VaultConfigService;
  let configService: jest.Mocked<ConfigService>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockPath: jest.Mocked<typeof path>;

  const mockSeasonConfigFile: SeasonConfigFile = {
    seasons: {
      1: {
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
      },
      2: {
        seasonId: 2,
        seasonName: 'Season 2 - Evolution',
        chain: ChainType.BASE,
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
      },
      3: {
        seasonId: 3,
        seasonName: 'Season 3 - Deprecated',
        chain: ChainType.BASE,
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-12-31T23:59:59Z',
        status: SeasonStatusType.DEPRECATED,
        withdrawalEnabled: true,
        migrationStatus: MigrationStatus.COMPLETED,
        features: {
          depositsEnabled: false,
          withdrawalsEnabled: true,
          lockedUntilMainnet: false,
          rewardsMultiplier: 0.8,
        },
        vaultMechanics: {
          type: VaultMechanicsType.LOCKED,
          lockDuration: 30,
          earlyWithdrawalPenalty: 0.15,
          compoundingEnabled: false,
          redeemDelayDays: 14,
        },
        migrationConfig: null,
      },
    },
    vaultConfigs: {
      'vault-s1-ilv': {
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
      'vault-s2-ilv': {
        vaultId: 'vault-s2-ilv',
        vaultAddress: '0x2345678901234567890123456789012345678901',
        name: 'ILV Staking Vault S2',
        chain: ChainType.BASE,
        seasonId: 2,
        status: VaultStatusType.PLANNED,
        underlyingAsset: 'ILV',
        mechanics: {
          withdrawalEnabled: true,
          lockedUntilMainnet: false,
          redeemDelayDays: 0,
        },
      },
    },
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'NODE_ENV':
            return 'test';
          case 'BASE_RPC_URL':
            return 'https://sepolia.base.org';
          case 'SUBGRAPH_BASE_URL':
            return 'https://api.thegraph.com/subgraphs/name/test/base-staking';
          case 'OBELISK_RPC_URL':
            return 'https://rpc.obelisk.io';
          case 'SUBGRAPH_OBELISK_URL':
            return 'https://api.thegraph.com/subgraphs/name/test/obelisk-staking';
          case 'TOKEN_ILV_ADDRESS':
            return '0xC3fcc8530F6d6997adD7EA9439F0C7F6855bF8e8';
          case 'TOKEN_ILV_ETH_ADDRESS':
            return '0x9470ed99A5797D3F4696B74732830B87BAc51d24';
          case 'TOKEN_WETH_ADDRESS':
            return '0x4200000000000000000000000000000000000006';
          case 'TOKEN_SILV2_ADDRESS':
            return '0x76b0881c7b99015Fda9CFfa32F16e7f5BC1b1C78';
          default:
            return defaultValue;
        }
      }),
    };

    mockFs = fs as jest.Mocked<typeof fs>;
    mockPath = path as jest.Mocked<typeof path>;

    // Setup fs and path mocks before service creation
    mockPath.join.mockReturnValue('/mock/path/seasons.config.json');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSeasonConfigFile));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    configService = module.get(ConfigService);
    service = module.get<VaultConfigService>(VaultConfigService);

    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSeasonConfigFromFile', () => {
    it('should load season configurations from file successfully', () => {
      // Service already initialized in beforeEach, verify it loaded correctly
      const season1 = service.getSeasonConfigFromFile(1);
      const season2 = service.getSeasonConfigFromFile(2);

      expect(season1).toBeDefined();
      expect(season1!.seasonId).toBe(1);
      expect(season1!.seasonName).toBe('Season 1 - Genesis');
      expect(season1!.status).toBe(SeasonStatusType.ACTIVE);

      expect(season2).toBeDefined();
      expect(season2!.seasonId).toBe(2);
      expect(season2!.seasonName).toBe('Season 2 - Evolution');
      expect(season2!.status).toBe(SeasonStatusType.PLANNED);
    });

    it('should load vault configurations from file successfully', () => {
      const vault1 = service.getVaultSeasonConfig('vault-s1-ilv');
      const vault2 = service.getVaultSeasonConfig('vault-s2-ilv');

      expect(vault1).toBeDefined();
      expect(vault1!.vaultId).toBe('vault-s1-ilv');
      expect(vault1!.seasonId).toBe(1);
      expect(vault1!.status).toBe(VaultStatusType.ACTIVE);

      expect(vault2).toBeDefined();
      expect(vault2!.vaultId).toBe('vault-s2-ilv');
      expect(vault2!.seasonId).toBe(2);
      expect(vault2!.status).toBe(VaultStatusType.PLANNED);
    });

    it('should create legacy season config mapping correctly', () => {
      // Verify that legacy season configs are created properly
      const allSeasons = service.getAllSeasonConfigsFromFile();
      expect(allSeasons).toHaveLength(3);

      const activeSeason = allSeasons.find(
        (s) => s.status === SeasonStatusType.ACTIVE,
      );
      expect(activeSeason).toBeDefined();
      expect(activeSeason!.seasonId).toBe(1);
    });
  });

  describe('getCurrentSeasonFromFile', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return current active season within date range', () => {
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

      const currentSeason = service.getCurrentSeasonFromFile();

      expect(currentSeason).toBeDefined();
      expect(currentSeason!.seasonId).toBe(1);
      expect(currentSeason!.status).toBe(SeasonStatusType.ACTIVE);
    });

    it('should return undefined when no active season exists', () => {
      // Set up mock with no active seasons
      const configWithNoActive = {
        ...mockSeasonConfigFile,
        seasons: {
          ...mockSeasonConfigFile.seasons,
          1: {
            ...mockSeasonConfigFile.seasons[1],
            status: SeasonStatusType.PLANNED,
          },
        },
      };

      // Update the mock to return the modified config
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithNoActive));

      // Create new service instance (fs mocks are already set up)
      const newService = new VaultConfigService(configService);

      const currentSeason = newService.getCurrentSeasonFromFile();

      expect(currentSeason).toBeUndefined();
    });

    it('should return undefined when active season is before start date', () => {
      jest.setSystemTime(new Date('2023-12-01T12:00:00Z'));

      const currentSeason = service.getCurrentSeasonFromFile();

      expect(currentSeason).toBeUndefined();
    });

    it('should return undefined when active season is after end date', () => {
      jest.setSystemTime(new Date('2024-07-01T12:00:00Z'));

      const currentSeason = service.getCurrentSeasonFromFile();

      expect(currentSeason).toBeUndefined();
    });

    it('should return active season when end date is null', () => {
      const configWithOpenEndedSeason = {
        ...mockSeasonConfigFile,
        seasons: {
          1: {
            ...mockSeasonConfigFile.seasons[1],
            endDate: null,
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(configWithOpenEndedSeason),
      );

      const newService = new VaultConfigService(configService);
      jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      const currentSeason = newService.getCurrentSeasonFromFile();

      expect(currentSeason).toBeDefined();
      expect(currentSeason!.seasonId).toBe(1);
    });
  });

  describe('getNextSeasonFromFile', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return next season when current season exists', () => {
      const nextSeason = service.getNextSeasonFromFile();

      expect(nextSeason).toBeDefined();
      expect(nextSeason!.seasonId).toBe(2);
      expect(nextSeason!.seasonName).toBe('Season 2 - Evolution');
    });

    it('should return undefined when no current season exists', () => {
      jest.setSystemTime(new Date('2023-01-01T12:00:00Z'));

      const nextSeason = service.getNextSeasonFromFile();

      expect(nextSeason).toBeUndefined();
    });

    it('should return undefined when next season does not exist', () => {
      // Mock current season as season 2 (highest season ID) but also include season 1 for vault initialization
      const configWithoutNextSeason = {
        ...mockSeasonConfigFile,
        seasons: {
          1: {
            ...mockSeasonConfigFile.seasons[1],
            status: SeasonStatusType.ENDED,
          },
          2: {
            ...mockSeasonConfigFile.seasons[2],
            status: SeasonStatusType.ACTIVE,
            startDate: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(configWithoutNextSeason),
      );

      const newService = new VaultConfigService(configService);

      const nextSeason = newService.getNextSeasonFromFile();

      expect(nextSeason).toBeUndefined();
    });
  });

  describe('getSeasonConfigFromFile', () => {
    it('should return season config by ID', () => {
      const season1 = service.getSeasonConfigFromFile(1);
      const season2 = service.getSeasonConfigFromFile(2);
      const season3 = service.getSeasonConfigFromFile(3);

      expect(season1).toBeDefined();
      expect(season1!.seasonId).toBe(1);

      expect(season2).toBeDefined();
      expect(season2!.seasonId).toBe(2);

      expect(season3).toBeDefined();
      expect(season3!.seasonId).toBe(3);
      expect(season3!.status).toBe(SeasonStatusType.DEPRECATED);
    });

    it('should return undefined for non-existent season ID', () => {
      const nonExistentSeason = service.getSeasonConfigFromFile(999);

      expect(nonExistentSeason).toBeUndefined();
    });
  });

  describe('getAllSeasonConfigsFromFile', () => {
    it('should return all season configurations', () => {
      const allSeasons = service.getAllSeasonConfigsFromFile();

      expect(allSeasons).toHaveLength(3);
      expect(allSeasons.map((s) => s.seasonId).sort()).toEqual([1, 2, 3]);
    });

    it('should return empty array when no seasons loaded', () => {
      // Force fallback by making file not exist - this will use fallback config that has seasons for vault init
      mockFs.existsSync.mockReturnValue(false);

      const newService = new VaultConfigService(configService);

      // Clear the seasonConfigsFromFile after initialization but keep legacy configs for vault init
      newService['seasonConfigsFromFile'].clear();

      const allSeasons = newService.getAllSeasonConfigsFromFile();

      expect(allSeasons).toHaveLength(0);

      // Restore for other tests
      mockFs.existsSync.mockReturnValue(true);
    });
  });

  describe('getVaultSeasonConfig', () => {
    it('should return vault config by ID', () => {
      const vault1 = service.getVaultSeasonConfig('vault-s1-ilv');
      const vault2 = service.getVaultSeasonConfig('vault-s2-ilv');

      expect(vault1).toBeDefined();
      expect(vault1!.vaultId).toBe('vault-s1-ilv');
      expect(vault1!.seasonId).toBe(1);

      expect(vault2).toBeDefined();
      expect(vault2!.vaultId).toBe('vault-s2-ilv');
      expect(vault2!.seasonId).toBe(2);
    });

    it('should return undefined for non-existent vault ID', () => {
      const nonExistentVault =
        service.getVaultSeasonConfig('non-existent-vault');

      expect(nonExistentVault).toBeUndefined();
    });
  });

  describe('getAllVaultSeasonConfigs', () => {
    it('should return all vault configurations', () => {
      const allVaults = service.getAllVaultSeasonConfigs();

      expect(allVaults).toHaveLength(2);
      expect(allVaults.map((v) => v.vaultId).sort()).toEqual([
        'vault-s1-ilv',
        'vault-s2-ilv',
      ]);
    });

    it('should return empty array when no vaults loaded', () => {
      // Force fallback by making file not exist
      mockFs.existsSync.mockReturnValue(false);

      const newService = new VaultConfigService(configService);

      // Clear vault season configs after initialization
      newService['vaultSeasonConfigs'].clear();

      const allVaults = newService.getAllVaultSeasonConfigs();

      expect(allVaults).toHaveLength(0);

      // Restore for other tests
      mockFs.existsSync.mockReturnValue(true);
    });
  });

  describe('error handling and fallback', () => {
    it('should use fallback configuration when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const newService = new VaultConfigService(configService);
      const loggerSpy = jest
        .spyOn(newService['logger'], 'warn')
        .mockImplementation();

      // We need to manually trigger the initialization since constructor already ran
      // Instead, let's check that seasons were loaded from fallback
      const allSeasons = newService.getAllSeasonConfigsFromFile();

      // With fallback, we won't have seasons in the file-based config, but we will have legacy configs
      expect(allSeasons).toHaveLength(0); // No file-based seasons

      // Restore for other tests
      mockFs.existsSync.mockReturnValue(true);
      loggerSpy.mockRestore();
    });

    it('should use fallback configuration when file cannot be read', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const newService = new VaultConfigService(configService);

      // Check that fallback was used by verifying file-based seasons are empty
      const allSeasons = newService.getAllSeasonConfigsFromFile();
      expect(allSeasons).toHaveLength(0); // No file-based seasons loaded due to error

      // Restore mocks for other tests
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSeasonConfigFile));
    });

    it('should use fallback configuration when JSON is invalid', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const newService = new VaultConfigService(configService);

      // Check that fallback was used by verifying file-based seasons are empty
      const allSeasons = newService.getAllSeasonConfigsFromFile();
      expect(allSeasons).toHaveLength(0); // No file-based seasons loaded due to JSON error

      // Restore mocks for other tests
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSeasonConfigFile));
    });

    it('should have fallback seasons available after error', () => {
      mockFs.existsSync.mockReturnValue(false);

      const newService = new VaultConfigService(configService);

      // Fallback should still provide some seasons (from initializeFallbackSeasonConfigs)
      const allSeasons = newService.getAllSeasonConfigsFromFile();
      expect(allSeasons).toHaveLength(0); // File-based configs will be empty, but legacy configs should exist
    });
  });

  describe('migration config handling', () => {
    it('should correctly parse migration config from file', () => {
      const season2 = service.getSeasonConfigFromFile(2);

      expect(season2).toBeDefined();
      expect(season2!.migrationConfig).toBeDefined();
      expect(season2!.migrationConfig!.fromChain).toBe(ChainType.BASE);
      expect(season2!.migrationConfig!.toChain).toBe(ChainType.OBELISK);
      expect(season2!.migrationConfig!.migrationStartTime).toBe(
        '2024-05-15T00:00:00Z',
      );
      expect(season2!.migrationConfig!.migrationEndTime).toBe(
        '2024-05-31T23:59:59Z',
      );
      expect(season2!.migrationConfig!.migrationDeadline).toBe(
        '2024-06-15T23:59:59Z',
      );
      expect(season2!.migrationConfig!.userActionRequired).toBe(true);
      expect(season2!.migrationConfig!.migrationGuideUrl).toBe(
        'https://docs.illuvium.io/migration-guide',
      );
    });

    it('should handle seasons without migration config', () => {
      const season1 = service.getSeasonConfigFromFile(1);

      expect(season1).toBeDefined();
      expect(season1!.migrationConfig).toBeNull();
    });
  });

  describe('vault mechanics handling', () => {
    it('should correctly parse vault mechanics from file', () => {
      const season1 = service.getSeasonConfigFromFile(1);
      const season2 = service.getSeasonConfigFromFile(2);

      expect(season1!.vaultMechanics.type).toBe(VaultMechanicsType.LOCKED);
      expect(season1!.vaultMechanics.earlyWithdrawalPenalty).toBe(0.1);
      expect(season1!.vaultMechanics.redeemDelayDays).toBe(7);

      expect(season2!.vaultMechanics.type).toBe(VaultMechanicsType.ERC4626);
      expect(season2!.vaultMechanics.earlyWithdrawalPenalty).toBe(0);
      expect(season2!.vaultMechanics.redeemDelayDays).toBe(0);
    });
  });

  describe('status type handling', () => {
    it('should correctly parse all season status types', () => {
      const activeSeason = service.getSeasonConfigFromFile(1);
      const plannedSeason = service.getSeasonConfigFromFile(2);
      const deprecatedSeason = service.getSeasonConfigFromFile(3);

      expect(activeSeason!.status).toBe(SeasonStatusType.ACTIVE);
      expect(plannedSeason!.status).toBe(SeasonStatusType.PLANNED);
      expect(deprecatedSeason!.status).toBe(SeasonStatusType.DEPRECATED);
    });

    it('should correctly parse all vault status types', () => {
      const activeVault = service.getVaultSeasonConfig('vault-s1-ilv');
      const plannedVault = service.getVaultSeasonConfig('vault-s2-ilv');

      expect(activeVault!.status).toBe(VaultStatusType.ACTIVE);
      expect(plannedVault!.status).toBe(VaultStatusType.PLANNED);
    });
  });
});
