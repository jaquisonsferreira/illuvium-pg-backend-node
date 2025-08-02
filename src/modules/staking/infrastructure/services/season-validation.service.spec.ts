import { Test, TestingModule } from '@nestjs/testing';
import { SeasonValidationService } from './season-validation.service';
import { SeasonContextService } from './season-context.service';
import { VaultConfigService } from '../config/vault-config.service';
import {
  SeasonConfig,
  SeasonContext,
  SeasonOperationContext,
  MigrationStatus,
  SeasonStatusType,
  VaultMechanicsType,
  VaultSeasonConfig,
  VaultStatusType,
} from '../../domain/types/season.types';
import { ChainType } from '../../domain/types/staking-types';

describe('SeasonValidationService', () => {
  let service: SeasonValidationService;
  let seasonContextService: jest.Mocked<SeasonContextService>;
  let vaultConfigService: jest.Mocked<VaultConfigService>;

  const mockSeasonContext: SeasonContext = {
    currentSeason: {
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
  };

  const mockDeprecatedSeason: SeasonConfig = {
    ...mockSeasonContext.currentSeason,
    status: SeasonStatusType.DEPRECATED,
    features: {
      ...mockSeasonContext.currentSeason.features,
      depositsEnabled: false,
    },
  };

  const mockMigratingSeason: SeasonConfig = {
    ...mockSeasonContext.currentSeason,
    migrationStatus: MigrationStatus.MIGRATING,
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

  const mockVaultConfig: VaultSeasonConfig = {
    vaultId: 'vault-s1-ilv',
    vaultAddress: '0x1234567890123456789012345678901234567890',
    name: 'ILV Staking Vault',
    chain: ChainType.BASE,
    seasonId: 1,
    status: VaultStatusType.ACTIVE,
    underlyingAsset: 'ILV',
    mechanics: {
      withdrawalEnabled: false,
      lockedUntilMainnet: true,
      redeemDelayDays: 7,
    },
  };

  beforeEach(async () => {
    const mockSeasonContextService = {
      getSeasonContext: jest.fn(),
      getSeasonById: jest.fn(),
      validateSeasonTransition: jest.fn(),
    };

    const mockVaultConfigService = {
      getVaultSeasonConfig: jest.fn(),
      isEmergencyMode: jest.fn(),
      isMaintenanceMode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonValidationService,
        {
          provide: SeasonContextService,
          useValue: mockSeasonContextService,
        },
        {
          provide: VaultConfigService,
          useValue: mockVaultConfigService,
        },
      ],
    }).compile();

    service = module.get<SeasonValidationService>(SeasonValidationService);
    seasonContextService = module.get(SeasonContextService);
    vaultConfigService = module.get(VaultConfigService);

    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSeasonOperation', () => {
    const mockContext: SeasonOperationContext = {
      operation: 'deposit',
      seasonId: 1,
      vaultId: 'vault-s1-ilv',
      userAddress: '0xabcdef1234567890123456789012345678901234',
      amount: '100',
    };

    beforeEach(() => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);
    });

    it('should validate successful deposit operation', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z')); // During season 1

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.seasonContext).toEqual(mockSeasonContext);

      jest.useRealTimers();
    });

    it('should fail validation when no season context available', async () => {
      seasonContextService.getSeasonContext.mockResolvedValue(null);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No season context available');
    });

    it('should fail validation when season not found', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(null);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Season 1 not found');
    });

    it('should fail validation when system is in maintenance mode', async () => {
      vaultConfigService.isMaintenanceMode.mockReturnValue(true);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'System is currently in maintenance mode',
      );
    });

    it('should add warning when system is in emergency mode', async () => {
      vaultConfigService.isEmergencyMode.mockReturnValue(true);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.warnings).toContain(
        'System is in emergency mode - only withdrawals allowed',
      );
    });

    it('should fail validation when vault configuration not found', async () => {
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(undefined);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Vault vault-s1-ilv configuration not found',
      );
    });

    it('should fail validation when vault does not belong to season', async () => {
      const wrongSeasonVault = {
        ...mockVaultConfig,
        seasonId: 2,
      };
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(wrongSeasonVault);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Vault does not belong to the specified season',
      );
    });

    it('should fail validation when vault is not active', async () => {
      const inactiveVault = {
        ...mockVaultConfig,
        status: VaultStatusType.DEPRECATED,
      };
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(inactiveVault);

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Vault is deprecated and not available for operations',
      );
    });

    it('should handle internal errors gracefully', async () => {
      seasonContextService.getSeasonContext.mockRejectedValue(
        new Error('Service error'),
      );

      const result = await service.validateSeasonOperation(mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Internal validation error');
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('validateDeposit', () => {
    beforeEach(() => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);
    });

    it('should validate successful deposit', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z')); // During season 1

      const result = await service.validateDeposit(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      jest.useRealTimers();
    });

    it('should fail validation when deposits are disabled', async () => {
      const seasonWithDisabledDeposits = {
        ...mockSeasonContext.currentSeason,
        features: {
          ...mockSeasonContext.currentSeason.features,
          depositsEnabled: false,
        },
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        seasonWithDisabledDeposits,
      );

      const result = await service.validateDeposit(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deposits are disabled for this season');
    });

    it('should fail validation for zero or negative amount', async () => {
      const result = await service.validateDeposit(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '0',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Deposit amount must be greater than zero',
      );
    });

    it('should add warning when season is migrating', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(mockMigratingSeason);

      const result = await service.validateDeposit(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.warnings).toContain(
        'Season is in migration - consider waiting or depositing in next season',
      );
    });

    it('should fail validation for deprecated season', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(
        mockDeprecatedSeason,
      );

      const result = await service.validateDeposit(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Deposits not allowed in deprecated season',
      );
    });
  });

  describe('validateWithdrawal', () => {
    beforeEach(() => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);
    });

    it('should fail validation when withdrawals are disabled', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );

      const result = await service.validateWithdrawal(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '50',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Withdrawals are disabled for this season',
      );
    });

    it('should validate successful withdrawal when enabled', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z')); // During season 1

      const seasonWithWithdrawals = {
        ...mockSeasonContext.currentSeason,
        features: {
          ...mockSeasonContext.currentSeason.features,
          withdrawalsEnabled: true,
          lockedUntilMainnet: false,
        },
        withdrawalEnabled: true,
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        seasonWithWithdrawals,
      );

      const result = await service.validateWithdrawal(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '50',
      );

      expect(result.isValid).toBe(true);

      jest.useRealTimers();
    });

    it('should fail validation when funds are locked until mainnet', async () => {
      const seasonWithWithdrawals = {
        ...mockSeasonContext.currentSeason,
        features: {
          ...mockSeasonContext.currentSeason.features,
          withdrawalsEnabled: true,
          lockedUntilMainnet: true,
        },
        withdrawalEnabled: true,
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        seasonWithWithdrawals,
      );

      const result = await service.validateWithdrawal(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '50',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Funds are locked until mainnet launch');
    });

    it('should add warning for withdrawal delay', async () => {
      const seasonWithWithdrawals = {
        ...mockSeasonContext.currentSeason,
        features: {
          ...mockSeasonContext.currentSeason.features,
          withdrawalsEnabled: true,
          lockedUntilMainnet: false,
        },
        withdrawalEnabled: true,
        vaultMechanics: {
          ...mockSeasonContext.currentSeason.vaultMechanics,
          redeemDelayDays: 7,
        },
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        seasonWithWithdrawals,
      );

      const result = await service.validateWithdrawal(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '50',
      );

      expect(result.warnings).toContain('Withdrawal has 7 day delay');
    });

    it('should add warning for early withdrawal penalty', async () => {
      const seasonWithWithdrawals = {
        ...mockSeasonContext.currentSeason,
        features: {
          ...mockSeasonContext.currentSeason.features,
          withdrawalsEnabled: true,
          lockedUntilMainnet: false,
        },
        withdrawalEnabled: true,
        vaultMechanics: {
          ...mockSeasonContext.currentSeason.vaultMechanics,
          earlyWithdrawalPenalty: 0.05,
        },
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        seasonWithWithdrawals,
      );

      const result = await service.validateWithdrawal(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '50',
      );

      expect(result.warnings).toContain('Early withdrawal penalty: 5%');
    });
  });

  describe('validateTransfer', () => {
    beforeEach(() => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);
    });

    it('should validate successful transfer', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z')); // During migration period

      seasonContextService.getSeasonById.mockResolvedValue(mockMigratingSeason);

      const result = await service.validateTransfer(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.isValid).toBe(true);

      jest.useRealTimers();
    });

    it('should add warning when no active migration', async () => {
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );

      const result = await service.validateTransfer(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.warnings).toContain('No active migration for this season');
    });

    it('should fail validation when migration is completed', async () => {
      const completedMigrationSeason = {
        ...mockSeasonContext.currentSeason,
        migrationStatus: MigrationStatus.COMPLETED,
      };
      seasonContextService.getSeasonById.mockResolvedValue(
        completedMigrationSeason,
      );

      const result = await service.validateTransfer(
        1,
        'vault-s1-ilv',
        '0xabc123',
        '100',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration period has completed');
    });
  });

  describe('validateMigration', () => {
    beforeEach(() => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);
    });

    it('should validate successful migration', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z')); // During migration period

      seasonContextService.validateSeasonTransition.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      // Mock getSeasonById to return the next season (season 2) instead of current season
      const mockNextSeasonConfig = {
        ...mockMigratingSeason,
        seasonId: 2,
        migrationStatus: MigrationStatus.MIGRATING,
      };

      seasonContextService.getSeasonById.mockResolvedValue(
        mockNextSeasonConfig,
      );

      // Mock vault config for season 2
      const mockSeason2Vault = {
        ...mockVaultConfig,
        seasonId: 2,
        vaultId: 'vault-s2-ilv',
      };
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockSeason2Vault);

      const result = await service.validateMigration(
        1,
        2,
        'vault-s2-ilv',
        '0xabc123',
      );

      expect(result.isValid).toBe(true);

      jest.useRealTimers();
    });

    it('should fail validation when season transition is invalid', async () => {
      seasonContextService.validateSeasonTransition.mockResolvedValue({
        isValid: false,
        errors: ['Seasons must be consecutive'],
      });

      const result = await service.validateMigration(
        1,
        3,
        'vault-s1-ilv',
        '0xabc123',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Seasons must be consecutive');
    });

    it('should handle internal errors gracefully', async () => {
      seasonContextService.validateSeasonTransition.mockRejectedValue(
        new Error('Service error'),
      );

      const result = await service.validateMigration(
        1,
        2,
        'vault-s1-ilv',
        '0xabc123',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Internal migration validation error');
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('isOperationAllowed', () => {
    beforeEach(() => {
      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);
    });

    it('should return true for allowed deposit operation', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z')); // During season 1

      const result = await service.isOperationAllowed(
        'deposit',
        1,
        'vault-s1-ilv',
      );

      expect(result).toBe(true);

      jest.useRealTimers();
    });

    it('should return false for disallowed withdrawal operation', async () => {
      const result = await service.isOperationAllowed(
        'withdrawal',
        1,
        'vault-s1-ilv',
      );

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      seasonContextService.getSeasonContext.mockRejectedValue(
        new Error('Service error'),
      );

      const result = await service.isOperationAllowed(
        'deposit',
        1,
        'vault-s1-ilv',
      );

      expect(result).toBe(false);
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('validateTimingConstraints', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-20T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fail validation when migration period has not started', async () => {
      jest.setSystemTime(new Date('2024-05-10T12:00:00Z'));

      const context: SeasonOperationContext = {
        operation: 'transfer',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(mockMigratingSeason);
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration period has not started');
    });

    it('should fail validation when migration deadline has passed', async () => {
      jest.setSystemTime(new Date('2024-06-20T12:00:00Z'));

      const context: SeasonOperationContext = {
        operation: 'transfer',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(mockMigratingSeason);
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration deadline has passed');
    });

    it('should add warning when migration period has ended but deadline not reached', async () => {
      jest.setSystemTime(new Date('2024-06-05T12:00:00Z'));

      const context: SeasonOperationContext = {
        operation: 'transfer',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(mockMigratingSeason);
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.warnings).toContain(
        'Migration period has ended but deadline not yet reached',
      );
    });

    it('should add warning when migration deadline is within 7 days', async () => {
      jest.setSystemTime(new Date('2024-06-12T12:00:00Z'));

      const context: SeasonOperationContext = {
        operation: 'transfer',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(mockMigratingSeason);
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.warnings).toContain('Migration deadline in 4 days');
    });
  });

  describe('validateSeasonConstraints', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fail validation for planned season before start date', async () => {
      const plannedSeason = {
        ...mockSeasonContext.currentSeason,
        status: SeasonStatusType.PLANNED,
        startDate: '2024-06-01T00:00:00Z',
      };

      const context: SeasonOperationContext = {
        operation: 'deposit',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(plannedSeason);
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Season has not started yet');
    });

    it('should fail validation for ended season', async () => {
      const endedSeason = {
        ...mockSeasonContext.currentSeason,
        status: SeasonStatusType.ENDED,
      };

      const context: SeasonOperationContext = {
        operation: 'deposit',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(endedSeason);
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Season has ended');
    });

    it('should fail deposits for deprecated seasons', async () => {
      const context: SeasonOperationContext = {
        operation: 'deposit',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockDeprecatedSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Deposits not allowed in deprecated season',
      );
    });

    it('should add warning for non-deposit operations in deprecated seasons', async () => {
      const context: SeasonOperationContext = {
        operation: 'withdrawal',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockDeprecatedSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.warnings).toContain(
        'Season is deprecated - consider migrating',
      );
    });

    it('should fail deposits after season end date', async () => {
      jest.setSystemTime(new Date('2024-07-01T12:00:00Z'));

      const context: SeasonOperationContext = {
        operation: 'deposit',
        seasonId: 1,
        vaultId: 'vault-s1-ilv',
        userAddress: '0xabc123',
      };

      seasonContextService.getSeasonContext.mockResolvedValue(
        mockSeasonContext,
      );
      seasonContextService.getSeasonById.mockResolvedValue(
        mockSeasonContext.currentSeason,
      );
      vaultConfigService.getVaultSeasonConfig.mockReturnValue(mockVaultConfig);
      vaultConfigService.isEmergencyMode.mockReturnValue(false);
      vaultConfigService.isMaintenanceMode.mockReturnValue(false);

      const result = await service.validateSeasonOperation(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Season has ended - deposits not allowed',
      );
    });
  });
});
