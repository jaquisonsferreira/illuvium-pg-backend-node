import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CrossSeasonDataService } from './cross-season-data.service';
import { StakingSubgraphService } from './staking-subgraph.service';
import { AlchemyStakingService } from './alchemy-staking.service';
import { SeasonContextService } from './season-context.service';
import { VaultConfigService } from '../config/vault-config.service';
import { ChainType } from '../../domain/types/staking-types';

describe('CrossSeasonDataService', () => {
  let service: CrossSeasonDataService;
  let mockSubgraphService: jest.Mocked<StakingSubgraphService>;
  let mockAlchemyService: jest.Mocked<AlchemyStakingService>;
  let mockSeasonContextService: jest.Mocked<SeasonContextService>;
  let mockVaultConfigService: jest.Mocked<VaultConfigService>;

  const mockWallet = '0x742d35Cc6Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A';

  beforeEach(async () => {
    const mockVaultConfigs = [
      {
        vaultId: 'ILV_vault_base',
        vaultAddress: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
        chain: ChainType.BASE,
        seasonId: 1,
        underlyingAsset: 'ILV',
        status: 'active',
      },
      {
        vaultId: 'ILV_vault_obelisk',
        vaultAddress: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
        chain: ChainType.OBELISK,
        seasonId: 2,
        underlyingAsset: 'ILV',
        status: 'planned',
      },
    ];
    const mockSubgraphServiceProvider = {
      provide: StakingSubgraphService,
      useValue: {
        getUserPositionsAcrossSeasons: jest.fn(),
        getUserTransactions: jest.fn(),
        getVaultMigrationData: jest.fn(),
        getCrossSeasonTVL: jest.fn(),
        getVaultPositions: jest.fn(),
      },
    };

    const mockAlchemyServiceProvider = {
      provide: AlchemyStakingService,
      useValue: {
        getUserPosition: jest.fn(),
        getUserTransactions: jest.fn(),
      },
    };

    const mockSeasonContextServiceProvider = {
      provide: SeasonContextService,
      useValue: {
        getAllSeasons: jest.fn(),
      },
    };

    const mockVaultConfigServiceProvider = {
      provide: VaultConfigService,
      useValue: {
        getAllVaultSeasonConfigs: jest.fn().mockReturnValue(mockVaultConfigs),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossSeasonDataService,
        mockSubgraphServiceProvider,
        mockAlchemyServiceProvider,
        mockSeasonContextServiceProvider,
        mockVaultConfigServiceProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CrossSeasonDataService>(CrossSeasonDataService);
    mockSubgraphService = module.get(StakingSubgraphService);
    mockAlchemyService = module.get(AlchemyStakingService);
    mockSeasonContextService = module.get(SeasonContextService);
    mockVaultConfigService = module.get(VaultConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPositionsAcrossSeasons', () => {
    it('should aggregate positions from multiple seasons', async () => {
      const mockSeasons = [
        {
          seasonId: 1,
          seasonName: 'Season 1',
          chain: ChainType.BASE,
          features: { rewardsMultiplier: 1.0 },
        },
        {
          seasonId: 2,
          seasonName: 'Season 2',
          chain: ChainType.OBELISK,
          features: { rewardsMultiplier: 1.2 },
        },
      ];

      const mockVaultConfigs = [
        {
          vaultId: 'ILV_vault_base',
          vaultAddress: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
          seasonId: 1,
          chain: ChainType.BASE,
          status: 'active',
        },
        {
          vaultId: 'ILV_vault_obelisk',
          vaultAddress: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
          seasonId: 2,
          chain: ChainType.OBELISK,
          status: 'planned',
        },
      ];

      const mockPositionsResponse = {
        data: {
          [ChainType.BASE]: [
            {
              vault: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
              user: mockWallet,
              assets: '1000000000000000000',
              shares: '1000000000000000000',
              blockNumber: 123456,
              timestamp: 1640995200,
            },
          ],
          [ChainType.OBELISK]: [],
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      mockSeasonContextService.getAllSeasons.mockResolvedValue(
        mockSeasons as any,
      );
      mockVaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs as any,
      );
      mockSubgraphService.getUserPositionsAcrossSeasons.mockResolvedValue(
        mockPositionsResponse as any,
      );

      const result = await service.getUserPositionsAcrossSeasons(mockWallet);

      expect(result.data.wallet).toBe(mockWallet);
      expect(result.data.positionsBySeason).toHaveLength(1);
      expect(result.data.positionsBySeason[0]).toMatchObject({
        seasonId: 1,
        chain: ChainType.BASE,
        vaultId: 'ILV_vault_base',
        balance: '1000000000000000000',
        requiresMigration: false,
      });
    });

    it('should fallback to Alchemy when subgraph fails', async () => {
      const mockSeasons = [
        {
          seasonId: 1,
          seasonName: 'Season 1',
          chain: ChainType.BASE,
          features: { rewardsMultiplier: 1.0 },
        },
      ];

      const mockVaultConfigs = [
        {
          vaultId: 'ILV_vault_base',
          vaultAddress: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
          seasonId: 1,
          chain: ChainType.BASE,
          status: 'active',
        },
      ];

      const mockAlchemyPosition = {
        vault: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
        user: mockWallet,
        assets: '500000000000000000',
        shares: '500000000000000000',
        blockNumber: 123456,
        timestamp: 1640995200,
      };

      mockSeasonContextService.getAllSeasons.mockResolvedValue(
        mockSeasons as any,
      );
      mockVaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs as any,
      );
      mockSubgraphService.getUserPositionsAcrossSeasons.mockRejectedValue(
        new Error('Subgraph unavailable'),
      );
      mockAlchemyService.getUserPosition.mockResolvedValue(
        mockAlchemyPosition as any,
      );

      const result = await service.getUserPositionsAcrossSeasons(mockWallet);

      expect(result.data.wallet).toBe(mockWallet);
      expect(result.data.positionsBySeason).toHaveLength(1);
      expect(result.data.positionsBySeason[0].balance).toBe(
        '500000000000000000',
      );
      expect(result.metadata.source).toBe('alchemy');
    });
  });

  describe('getHistoricalShardsEarned', () => {
    it('should calculate shards from transaction history', async () => {
      const mockSeason1Transactions = [
        {
          hash: '0x123',
          type: 'deposit' as const,
          amount: '1000000000000000000',
          timestamp: 1640995200,
          blockNumber: 123456,
          vault: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
          user: mockWallet,
          from: mockWallet,
          to: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
        },
      ];

      const mockSeason2Transactions = [
        {
          hash: '0x456',
          type: 'deposit' as const,
          amount: '2000000000000000000',
          timestamp: 1672531200,
          blockNumber: 234567,
          vault: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
          user: mockWallet,
          from: mockWallet,
          to: '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
        },
      ];

      mockSubgraphService.getUserTransactions
        .mockResolvedValueOnce({
          data: mockSeason1Transactions,
          metadata: {
            source: 'subgraph',
            lastUpdated: new Date(),
            isStale: false,
          },
        } as any)
        .mockResolvedValueOnce({
          data: mockSeason2Transactions,
          metadata: {
            source: 'subgraph',
            lastUpdated: new Date(),
            isStale: false,
          },
        } as any);

      const result = await service.getHistoricalShardsEarned(mockWallet);

      expect(result.data.season1Shards).toBe('1000000000000000000');
      expect(parseInt(result.data.season2Shards)).toBeGreaterThan(
        2300000000000000000,
      );
      expect(parseInt(result.data.totalShards)).toBeGreaterThan(
        3300000000000000000,
      );
      expect(result.data.multiplierBonus).toBeGreaterThan(450000000000000000);
    });
  });

  describe('getCrossSeasonAnalytics', () => {
    it('should aggregate analytics across seasons', async () => {
      const mockTVLData = {
        data: {
          totalTVL: '5000000000000000000',
          totalTVLUsd: 50000,
          tvlByChain: {
            [ChainType.BASE]: {
              totalAssets: '3000000000000000000',
              totalAssetsUsd: 30000,
            },
            [ChainType.OBELISK]: {
              totalAssets: '2000000000000000000',
              totalAssetsUsd: 20000,
            },
          },
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      const mockSeasons = [
        { seasonId: 1, status: 'active' },
        { seasonId: 2, status: 'planned' },
      ];

      const mockVaultConfigs = [
        { vaultId: 'vault1', seasonId: 1 },
        { vaultId: 'vault2', seasonId: 2 },
      ];

      mockSubgraphService.getCrossSeasonTVL.mockResolvedValue(
        mockTVLData as any,
      );
      mockSeasonContextService.getAllSeasons.mockResolvedValue(
        mockSeasons as any,
      );
      mockVaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs as any,
      );
      mockSubgraphService.getVaultMigrationData.mockResolvedValue({
        data: { fromVaultData: null, toVaultData: null, migrationEvents: [] },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });
      mockSubgraphService.getVaultPositions.mockResolvedValue({
        data: {
          data: [],
          pagination: {
            page: 1,
            limit: 100,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      const result = await service.getCrossSeasonAnalytics();

      expect(result.data.totalTVL).toBe('5000000000000000000');
      expect(result.data.totalTVLUsd).toBe(50000);
      expect(result.data.activeSeasons).toBe(1);
      expect(result.data.totalVaults).toBe(2);
    });
  });

  describe('getVaultCorrelationData', () => {
    it('should calculate migration correlation between vaults', async () => {
      const fromVaultId = 'ILV_vault_base';
      const toVaultId = 'ILV_vault_obelisk';

      const mockVaultConfigs = [
        {
          vaultId: fromVaultId,
          chain: ChainType.BASE,
          underlyingAsset: 'ILV',
        },
        {
          vaultId: toVaultId,
          chain: ChainType.OBELISK,
          underlyingAsset: 'ILV',
        },
      ];

      mockVaultConfigService.getAllVaultSeasonConfigs.mockReturnValue(
        mockVaultConfigs as any,
      );

      const mockFromPositions = {
        data: {
          data: [
            { user: '0x123', assets: '1000000000000000000' },
            { user: '0x456', assets: '2000000000000000000' },
          ],
          pagination: {
            page: 1,
            limit: 100,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      const mockToPositions = {
        data: {
          data: [{ user: '0x123', assets: '1000000000000000000' }],
          pagination: {
            page: 1,
            limit: 100,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      };

      mockSubgraphService.getVaultPositions
        .mockResolvedValueOnce(mockFromPositions as any)
        .mockResolvedValueOnce(mockToPositions as any);

      const result = await service.getVaultCorrelationData(
        fromVaultId,
        toVaultId,
      );

      expect(result.data.correlatedUsers).toBe(1);
      expect(result.data.migrationRate).toBe(50);
      expect(result.data.totalMigratedValue).toBe('1000000000000000000');
    });
  });
});
