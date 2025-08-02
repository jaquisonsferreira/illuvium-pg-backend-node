import { Test, TestingModule } from '@nestjs/testing';
import { GetUserStakingTransactionsUseCase } from './get-user-staking-transactions.use-case';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import { Logger } from '@nestjs/common';
import {
  ChainType,
  VaultType,
  VaultConfig,
} from '../../domain/types/staking-types';
import {
  TransactionType,
  TransactionSortBy,
  TransactionSortOrder,
} from '../../interface/dto/get-transactions-query.dto';

describe('GetUserStakingTransactionsUseCase', () => {
  let useCase: GetUserStakingTransactionsUseCase;
  let stakingSubgraphRepository: jest.Mocked<IStakingSubgraphRepository>;
  let priceFeedRepository: jest.Mocked<IPriceFeedRepository>;
  let vaultConfigService: VaultConfigService;
  let tokenDecimalsService: jest.Mocked<TokenDecimalsService>;

  const mockWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserStakingTransactionsUseCase,
        {
          provide: 'IStakingSubgraphRepository',
          useValue: {
            getUserTransactions: jest.fn(),
          },
        },
        {
          provide: 'IPriceFeedRepository',
          useValue: {
            getTokenPrice: jest.fn(),
          },
        },
        {
          provide: VaultConfigService,
          useValue: {
            getCurrentSeason: jest.fn(),
            getActiveVaults: jest.fn(),
            getVaultConfig: jest.fn(),
          },
        },
        {
          provide: TokenDecimalsService,
          useValue: {
            getDecimals: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetUserStakingTransactionsUseCase>(
      GetUserStakingTransactionsUseCase,
    );
    stakingSubgraphRepository = module.get('IStakingSubgraphRepository');
    priceFeedRepository = module.get('IPriceFeedRepository');
    vaultConfigService = module.get(VaultConfigService);
    tokenDecimalsService = module.get(TokenDecimalsService);

    // Mock logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  describe('execute', () => {
    it('should return user transactions with enriched data', async () => {
      // Mock current season
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      // Mock vault config
      const mockVault: VaultConfig = {
        address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        name: 'ILV Staking Vault',
        symbol: 'sILV',
        asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        type: VaultType.SINGLE_TOKEN,
        chain: ChainType.BASE,
        tokenConfig: {
          address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          symbol: 'ILV',
          name: 'Illuvium',
          decimals: 18,
          coingeckoId: 'illuvium',
          isLP: false,
        },
        isActive: true,
        totalAssets: '0',
        totalSupply: '0',
        depositEnabled: true,
        withdrawalEnabled: true,
        seasonNumber: 1,
        minimumDeposit: '1000000000000000000',
        maximumDeposit: '1000000000000000000000000',
        lockDuration: 0,
        aprBase: 0.05,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (vaultConfigService.getVaultConfig as jest.Mock).mockReturnValue(
        mockVault,
      );

      // Mock transactions
      const mockTransactions = [
        {
          hash: '0xabc123',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '100500000000000000000',
          shares: '100500000000000000000',
          timestamp: Math.floor(
            new Date('2025-03-15T10:30:00Z').getTime() / 1000,
          ),
          blockNumber: 12345678,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          gasPrice: '5000000000',
          gasUsed: '150000',
        },
        {
          hash: '0xdef456',
          type: 'withdrawal' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '50250000000000000000',
          shares: '50250000000000000000',
          timestamp: Math.floor(
            new Date('2025-03-10T14:20:00Z').getTime() / 1000,
          ),
          blockNumber: 12345600,
          from: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          to: mockWalletAddress,
          gasPrice: '4000000000',
          gasUsed: '100000',
        },
      ];

      stakingSubgraphRepository.getUserTransactions.mockResolvedValue({
        data: mockTransactions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      // Mock token price
      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        symbol: 'ILV',
        priceUsd: 15.16,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      // Mock token decimals
      (tokenDecimalsService.getDecimals as jest.Mock).mockResolvedValue(18);

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        page: 1,
        limit: 10,
      });

      expect(result.wallet).toBe(mockWalletAddress);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].type).toBe('deposit');
      expect(result.data[0].amount).toBe('100.5');
      expect(result.data[0].vault_id).toBe('ilv_vault');
      expect(result.summary.total_transactions).toBe(2);
      expect(result.summary.total_deposits).toBe(1);
      expect(result.summary.total_withdrawals).toBe(1);

      // Verify new fields match issue #20 spec
      expect(result.data[0].transaction_hash).toBe('0xabc123');
      expect(result.data[0].underlying_asset).toBe('Illuvium');
      expect(result.data[0].underlying_asset_ticker).toBe('ILV');
      expect(result.data[0].token_icons).toBeDefined();
      expect(result.data[0].token_icons.primary).toBeTruthy();
    });

    it('should filter transactions by vault_id', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      const mockVaults: VaultConfig[] = [
        {
          address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          name: 'ILV Staking Vault',
          symbol: 'sILV',
          asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          type: VaultType.SINGLE_TOKEN,
          chain: ChainType.BASE,
          tokenConfig: {
            address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            symbol: 'ILV',
            name: 'Illuvium',
            decimals: 18,
            coingeckoId: 'illuvium',
            isLP: false,
          },
          isActive: true,
          totalAssets: '0',
          totalSupply: '0',
          depositEnabled: true,
          withdrawalEnabled: true,
          seasonNumber: 1,
          minimumDeposit: '1000000000000000000',
          maximumDeposit: '1000000000000000000000000',
          lockDuration: 0,
          aprBase: 0.05,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue(
        mockVaults,
      );
      (vaultConfigService.getVaultConfig as jest.Mock).mockReturnValue(
        mockVaults[0],
      );

      const mockTransactions = [
        {
          hash: '0xabc123',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '100500000000000000000',
          timestamp: Date.now() / 1000 - 3600,
          blockNumber: 12345678,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        },
        {
          hash: '0xdef456',
          type: 'deposit' as const,
          vault: '0x999999999999999999999999999999999999999999',
          user: mockWalletAddress,
          amount: '50000000000000000000',
          timestamp: Date.now() / 1000 - 7200,
          blockNumber: 12345600,
          from: mockWalletAddress,
          to: '0x999999999999999999999999999999999999999999',
        },
      ];

      stakingSubgraphRepository.getUserTransactions.mockResolvedValue({
        data: mockTransactions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        symbol: 'ILV',
        priceUsd: 15.16,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      (tokenDecimalsService.getDecimals as jest.Mock).mockResolvedValue(18);

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        vaultId: 'ilv_vault',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].vault_id).toBe('ilv_vault');
    });

    it('should filter transactions by type', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      const mockVault: VaultConfig = {
        address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        name: 'ILV Staking Vault',
        symbol: 'sILV',
        asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        type: VaultType.SINGLE_TOKEN,
        chain: ChainType.BASE,
        tokenConfig: {
          address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          symbol: 'ILV',
          name: 'Illuvium',
          decimals: 18,
          coingeckoId: 'illuvium',
          isLP: false,
        },
        isActive: true,
        totalAssets: '0',
        totalSupply: '0',
        depositEnabled: true,
        withdrawalEnabled: true,
        seasonNumber: 1,
        minimumDeposit: '1000000000000000000',
        maximumDeposit: '1000000000000000000000000',
        lockDuration: 0,
        aprBase: 0.05,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (vaultConfigService.getVaultConfig as jest.Mock).mockReturnValue(
        mockVault,
      );

      const mockTransactions = [
        {
          hash: '0xabc123',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '100500000000000000000',
          timestamp: Date.now() / 1000 - 3600,
          blockNumber: 12345678,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        },
        {
          hash: '0xdef456',
          type: 'withdrawal' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '50250000000000000000',
          timestamp: Date.now() / 1000 - 7200,
          blockNumber: 12345600,
          from: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          to: mockWalletAddress,
        },
      ];

      stakingSubgraphRepository.getUserTransactions.mockResolvedValue({
        data: mockTransactions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        symbol: 'ILV',
        priceUsd: 15.16,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      (tokenDecimalsService.getDecimals as jest.Mock).mockResolvedValue(18);

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        type: TransactionType.DEPOSIT,
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('deposit');
    });

    it('should filter transactions by date range', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      const mockVault: VaultConfig = {
        address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        name: 'ILV Staking Vault',
        symbol: 'sILV',
        asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        type: VaultType.SINGLE_TOKEN,
        chain: ChainType.BASE,
        tokenConfig: {
          address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          symbol: 'ILV',
          name: 'Illuvium',
          decimals: 18,
          coingeckoId: 'illuvium',
          isLP: false,
        },
        isActive: true,
        totalAssets: '0',
        totalSupply: '0',
        depositEnabled: true,
        withdrawalEnabled: true,
        seasonNumber: 1,
        minimumDeposit: '1000000000000000000',
        maximumDeposit: '1000000000000000000000000',
        lockDuration: 0,
        aprBase: 0.05,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (vaultConfigService.getVaultConfig as jest.Mock).mockReturnValue(
        mockVault,
      );

      const marchTimestamp = Math.floor(
        new Date('2025-03-15T00:00:00Z').getTime() / 1000,
      );
      const februaryTimestamp = Math.floor(
        new Date('2025-02-15T00:00:00Z').getTime() / 1000,
      );

      const mockTransactions = [
        {
          hash: '0xabc123',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '100500000000000000000',
          timestamp: marchTimestamp,
          blockNumber: 12345678,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        },
        {
          hash: '0xdef456',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '50250000000000000000',
          timestamp: februaryTimestamp,
          blockNumber: 12345600,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        },
      ];

      stakingSubgraphRepository.getUserTransactions.mockResolvedValue({
        data: mockTransactions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        symbol: 'ILV',
        priceUsd: 15.16,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      (tokenDecimalsService.getDecimals as jest.Mock).mockResolvedValue(18);

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        startDate: '2025-03-01T00:00:00Z',
        endDate: '2025-03-31T23:59:59Z',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].transaction_hash).toBe('0xabc123');
    });

    it('should sort transactions correctly', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      const mockVault: VaultConfig = {
        address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        name: 'ILV Staking Vault',
        symbol: 'sILV',
        asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        type: VaultType.SINGLE_TOKEN,
        chain: ChainType.BASE,
        tokenConfig: {
          address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          symbol: 'ILV',
          name: 'Illuvium',
          decimals: 18,
          coingeckoId: 'illuvium',
          isLP: false,
        },
        isActive: true,
        totalAssets: '0',
        totalSupply: '0',
        depositEnabled: true,
        withdrawalEnabled: true,
        seasonNumber: 1,
        minimumDeposit: '1000000000000000000',
        maximumDeposit: '1000000000000000000000000',
        lockDuration: 0,
        aprBase: 0.05,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (vaultConfigService.getVaultConfig as jest.Mock).mockReturnValue(
        mockVault,
      );

      const mockTransactions = [
        {
          hash: '0xabc123',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '50000000000000000000',
          timestamp: Date.now() / 1000 - 7200,
          blockNumber: 12345678,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        },
        {
          hash: '0xdef456',
          type: 'deposit' as const,
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          amount: '100000000000000000000',
          timestamp: Date.now() / 1000 - 3600,
          blockNumber: 12345600,
          from: mockWalletAddress,
          to: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        },
      ];

      stakingSubgraphRepository.getUserTransactions.mockResolvedValue({
        data: mockTransactions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        symbol: 'ILV',
        priceUsd: 15.16,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      (tokenDecimalsService.getDecimals as jest.Mock).mockResolvedValue(18);

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        sortBy: TransactionSortBy.AMOUNT,
        sortOrder: TransactionSortOrder.DESC,
        page: 1,
        limit: 10,
      });

      expect(result.data[0].amount).toBe('100.0');
      expect(result.data[1].amount).toBe('50.0');
    });

    it('should handle empty transactions gracefully', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      stakingSubgraphRepository.getUserTransactions.mockResolvedValue({
        data: [],
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.summary.total_transactions).toBe(0);
      expect(result.summary.total_deposited_usd).toBe('0.00');
    });

    it('should handle subgraph errors gracefully', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      stakingSubgraphRepository.getUserTransactions.mockRejectedValue(
        new Error('Subgraph unavailable'),
      );

      await expect(
        useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow('Subgraph unavailable');
    });
  });
});
