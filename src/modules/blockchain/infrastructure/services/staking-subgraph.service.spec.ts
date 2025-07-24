import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StakingSubgraphService } from './staking-subgraph.service';
import { ChainType } from '../../domain/types/staking-types';
import axios from 'axios';

jest.mock('axios');

describe('StakingSubgraphService', () => {
  let service: StakingSubgraphService;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    mockAxiosInstance = {
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingSubgraphService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  SUBGRAPH_BASE_URL:
                    'https://api.thegraph.com/subgraphs/name/obelisk/base-staking',
                  SUBGRAPH_OBELISK_URL:
                    'https://api.thegraph.com/subgraphs/name/obelisk/obelisk-staking',
                };
                return config[key] || defaultValue;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<StakingSubgraphService>(StakingSubgraphService);
  });

  describe('getSyncStatus', () => {
    it('should return sync status from subgraph', async () => {
      const mockResponse = {
        data: {
          data: {
            _meta: {
              block: {
                number: 1000000,
                hash: '0xabc123',
                timestamp: 1705302600,
              },
              deployment: 'deployment-id',
              hasIndexingErrors: false,
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Mock the private getChainHeadBlock method
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000050);

      const result = await service.getSyncStatus(ChainType.BASE);

      expect(result.latestBlock).toBe(1000000);
      expect(result.isHealthy).toBe(true);
      expect(result.blocksBehind).toBe(50);
    });
  });

  describe('getVaultAnalytics', () => {
    it('should return vault analytics data', async () => {
      const vaultAddress = '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A';
      const mockVaultResponse = {
        vault: {
          id: vaultAddress.toLowerCase(),
          totalValueLocked: '1000000000000000000000',
          totalShares: '1000000000000000000000',
          totalParticipants: '100',
          totalDeposits: '2000000000000000000000',
          totalWithdrawals: '1000000000000000000000',
          dailyVolume: '100000000000000000000',
          weeklyVolume: '700000000000000000000',
          averageAPY: '500',
        },
        vaultDayDatas: [
          {
            date: 1705302600,
            totalValueLocked: '1000000000000000000000',
            dailyVolumeUSD: '100000',
            dailyDeposits: '10',
            dailyWithdrawals: '5',
          },
        ],
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method to return appropriate responses
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockVaultResponse); // First call for vault data
      querySpy.mockResolvedValueOnce(mockSyncResponse); // Second call for sync status

      // Mock getChainHeadBlock
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getVaultAnalytics(
        vaultAddress,
        ChainType.BASE,
      );

      expect(result.data).toBeDefined();
      expect(result.data?.vaultAddress).toBe(vaultAddress.toLowerCase());
      expect(result.data?.participantCount).toBe(100);
      expect(result.data?.sharePrice).toBe(1); // Assuming 1:1 share ratio from test data
      expect(result.metadata.source).toBe('subgraph');
    });

    it('should throw error if vault not found', async () => {
      const vaultAddress = '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A';
      const mockResponse = {
        vault: null,
        vaultDayDatas: [],
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);

      await expect(
        service.getVaultAnalytics(vaultAddress, ChainType.BASE),
      ).rejects.toThrow('Failed to fetch vault analytics from subgraph');
    });
  });

  describe('getVaultTVLHistory', () => {
    it('should return TVL history for daily granularity', async () => {
      const vaultAddress = '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A';
      const mockResponse = {
        vaultDayDatas: [
          {
            date: '1705302600',
            totalValueLocked: '1000000000000000000000',
            totalValueLockedUSD: '10000',
          },
          {
            date: '1705389000',
            totalValueLocked: '1100000000000000000000',
            totalValueLockedUSD: '11000',
          },
        ],
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);
      querySpy.mockResolvedValueOnce(mockSyncResponse);
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getVaultTVLHistory(
        vaultAddress,
        ChainType.BASE,
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].timestamp).toBe(1705302600000);
      expect(result.data[0].totalAssetsUsd).toBe(10000);
      expect(result.data[1].totalAssetsUsd).toBe(11000);
    });

    it('should apply timestamp filters', async () => {
      const vaultAddress = '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A';
      const fromTimestamp = 1705302600000;
      const toTimestamp = 1705389000000;

      const mockResponse = { vaultDayDatas: [] };
      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);
      querySpy.mockResolvedValueOnce(mockSyncResponse);
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      await service.getVaultTVLHistory(
        vaultAddress,
        ChainType.BASE,
        fromTimestamp,
        toTimestamp,
      );

      // Check that the query was called with correct parameters
      const queryCall = querySpy.mock.calls[0];
      const query = queryCall[1];

      expect(query).toContain('date_gte: 1705302600');
      expect(query).toContain('date_lte: 1705389000');
    });
  });

  describe('getEcosystemStats', () => {
    it('should return ecosystem stats from protocol metrics', async () => {
      const mockResponse = {
        protocolMetrics: {
          totalValueLocked: '10000000000000000000000',
          totalValueLockedUSD: '100000',
          totalVaults: '10',
          totalUsers: '1000',
          dailyVolumeUSD: '50000',
          weeklyVolumeUSD: '350000',
        },
        vaults: [],
        users: [],
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);
      querySpy.mockResolvedValueOnce(mockSyncResponse);
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getEcosystemStats(ChainType.BASE);

      expect(result.data.totalValueLocked).toBe('10000000000000000000000');
      expect(result.data.totalValueLockedUsd).toBe(100000);
      expect(result.data.totalVaults).toBe(10);
      expect(result.data.totalParticipants).toBe(1000);
      expect(result.data.volume24h).toBe('50000');
      expect(result.data.volume7d).toBe('350000');
    });

    it('should calculate stats from vaults if protocol metrics not available', async () => {
      const mockResponse = {
        protocolMetrics: null,
        vaults: [
          { id: '0x1', totalValueLocked: '1000000000000000000000' },
          { id: '0x2', totalValueLocked: '2000000000000000000000' },
        ],
        users: [{ id: '0xuser1' }, { id: '0xuser2' }, { id: '0xuser3' }],
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);
      querySpy.mockResolvedValueOnce(mockSyncResponse);
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getEcosystemStats(ChainType.BASE);

      expect(result.data.totalValueLocked).toBe('3000000000000000000000');
      expect(result.data.totalVaults).toBe(2);
      expect(result.data.totalParticipants).toBe(3);
      expect(result.data.volume24h).toBe('0');
      expect(result.data.volume7d).toBe('0');
    });
  });

  describe('getLPTokenData', () => {
    it('should return LP token data', async () => {
      const tokenAddress = '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D';
      const mockResponse = {
        lpToken: {
          id: tokenAddress.toLowerCase(),
          token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          token1: '0x4200000000000000000000000000000000000006',
          reserve0: '1000000000000000000000',
          reserve1: '50000000000000000000',
          totalSupply: '100000000000000000000',
          blockNumber: 12345678,
          timestamp: 1705302600,
        },
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);
      querySpy.mockResolvedValueOnce(mockSyncResponse);
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getLPTokenData(tokenAddress, ChainType.BASE);

      expect(result.data).toBeDefined();
      expect(result.data?.address).toBe(tokenAddress.toLowerCase());
      expect(result.data?.reserve0).toBe('1000000000000000000000');
      expect(result.data?.reserve1).toBe('50000000000000000000');
      expect(result.data?.totalSupply).toBe('100000000000000000000');
    });

    it('should return null if LP token not found', async () => {
      const tokenAddress = '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D';
      const mockResponse = {
        lpToken: null,
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse);
      querySpy.mockResolvedValueOnce(mockSyncResponse);
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getLPTokenData(tokenAddress, ChainType.BASE);

      expect(result.data).toBeNull();
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockResponse = {
        vaultTransactions: [
          {
            id: 'tx1',
            vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
            user: '0x1234567890abcdef1234567890abcdef1234ABCD',
            type: 'deposit',
            assets: '1000000000000000000',
            shares: '1000000000000000000',
            timestamp: 1705302600,
            blockNumber: 12345678,
            transactionHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          },
        ],
      };

      const mockCountResponse = {
        vaultTransactions: [{ id: 'tx1' }],
      };

      const mockSyncResponse = {
        _meta: {
          block: {
            number: 1000000,
            hash: '0xabc123',
            timestamp: 1705302600,
          },
          deployment: 'deployment-id',
          hasIndexingErrors: false,
        },
      };

      // Mock the private query method
      const querySpy = jest.spyOn(service as any, 'query');
      querySpy.mockResolvedValueOnce(mockResponse); // First call for transactions
      querySpy.mockResolvedValueOnce(mockCountResponse); // Second call for count
      querySpy.mockResolvedValueOnce(mockSyncResponse); // Third call for sync status
      jest
        .spyOn(service as any, 'getChainHeadBlock')
        .mockResolvedValue(1000100);

      const result = await service.getTransactions({
        chain: ChainType.BASE,
        page: 1,
        limit: 10,
      });

      expect(result.data.data).toHaveLength(1);
      expect(result.data.data[0].id).toBe('tx1');
      expect(result.data.pagination.total).toBe(1);
      expect(result.data.pagination.hasNext).toBe(false);
    });
  });
});
