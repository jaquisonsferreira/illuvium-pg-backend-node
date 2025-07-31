import { Test, TestingModule } from '@nestjs/testing';
import { GetUserStakingPositionsUseCase } from './get-user-staking-positions.use-case';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import { CalculateLPTokenPriceUseCase } from './calculate-lp-token-price.use-case';
import { Logger } from '@nestjs/common';
import {
  ChainType,
  VaultType,
  VaultConfig,
} from '../../domain/types/staking-types';

describe('GetUserStakingPositionsUseCase', () => {
  let useCase: GetUserStakingPositionsUseCase;
  let stakingSubgraphRepository: jest.Mocked<IStakingSubgraphRepository>;
  let priceFeedRepository: jest.Mocked<IPriceFeedRepository>;
  let vaultConfigService: VaultConfigService;
  let tokenDecimalsService: jest.Mocked<TokenDecimalsService>;
  let calculateLPTokenPriceUseCase: jest.Mocked<CalculateLPTokenPriceUseCase>;

  const mockWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserStakingPositionsUseCase,
        {
          provide: 'IStakingSubgraphRepository',
          useValue: {
            getUserPositions: jest.fn(),
            getLPTokenData: jest.fn(),
          },
        },
        {
          provide: 'IPriceFeedRepository',
          useValue: {
            getTokenPrice: jest.fn(),
            getMultipleTokenPrices: jest.fn(),
          },
        },
        {
          provide: VaultConfigService,
          useValue: {
            getActiveVaults: jest.fn(),
            getVaultConfig: jest.fn(),
            getCurrentSeason: jest.fn(),
            validateChain: jest.fn(),
          },
        },
        {
          provide: TokenDecimalsService,
          useValue: {
            getDecimals: jest.fn(),
            formatTokenAmount: jest.fn(),
          },
        },
        {
          provide: CalculateLPTokenPriceUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetUserStakingPositionsUseCase>(
      GetUserStakingPositionsUseCase,
    );
    stakingSubgraphRepository = module.get('IStakingSubgraphRepository');
    priceFeedRepository = module.get('IPriceFeedRepository');
    vaultConfigService = module.get(VaultConfigService);
    tokenDecimalsService = module.get(TokenDecimalsService);
    calculateLPTokenPriceUseCase = module.get(CalculateLPTokenPriceUseCase);

    // Mock logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  describe('execute', () => {
    it('should return user positions with enriched vault data', async () => {
      // Mock current season
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      // Mock active vaults
      const mockVaults: VaultConfig[] = [
        {
          address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          name: 'ILV Staking Vault',
          symbol: 'sILV',
          asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          type: VaultType.SINGLE_TOKEN,
          chain: ChainType.BASE,
          isActive: true,
          totalAssets: '2200000000000000000000',
          totalSupply: '2200000000000000000000',
          depositEnabled: true,
          withdrawalEnabled: true,
          tokenConfig: {
            address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            symbol: 'ILV',
            name: 'Illuvium',
            decimals: 18,
            coingeckoId: 'illuvium',
            isLP: false,
          },
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

      // Mock subgraph positions
      const mockPositions = [
        {
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          shares: '125500000000000000000',
          assets: '125500000000000000000',
          blockNumber: 1000000,
          timestamp: Math.floor(
            new Date('2025-03-15T10:30:00Z').getTime() / 1000,
          ),
        },
      ];

      stakingSubgraphRepository.getUserPositions.mockResolvedValue({
        data: mockPositions,
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
        priceUsd: 9.56,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      // Mock token decimals
      (tokenDecimalsService.getDecimals as jest.Mock).mockResolvedValue(18);
      tokenDecimalsService.formatTokenAmount.mockImplementation(
        (amount, decimals) => {
          const divisor = BigInt(10) ** BigInt(decimals);
          const value = BigInt(amount) / divisor;
          return value.toString();
        },
      );

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        page: 1,
        limit: 10,
      });

      expect(result.wallet).toBe(mockWalletAddress);
      expect(result.current_season.season_id).toBe(1);
      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0].vault_id).toBe('ilv_vault');
      expect(result.vaults[0].userHasStake).toBe(true);
      expect(result.vaults[0].positions).toHaveLength(1);
      expect(result.vaults[0].user_total_staked).toBe('125.5');
    });

    it('should handle LP token vaults correctly', async () => {
      // Mock LP vault
      const mockLPVault = {
        address: '0x853e4A8C1C7B9A4F5D6E9C8B7A5F2E1D0C9B8A7E',
        vault_id: 'ilv_eth_vault',
        name: 'ILV/ETH',
        symbol: 'ILV/ETH LP',
        asset: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
        type: VaultType.LP_TOKEN,
        chain: ChainType.BASE,
        isActive: true,
        token_icons: {
          primary:
            'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
          secondary:
            'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
        },
      };

      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      const completeMockLPVault = {
        ...mockLPVault,
        tokenConfig: {
          address: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
          symbol: 'ILV-ETH-LP',
          name: 'ILV/ETH LP',
          decimals: 18,
          coingeckoId: '',
          isLP: true,
          token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        },
        seasonNumber: 1,
        minimumDeposit: '1000000000000000000',
        maximumDeposit: '100000000000000000000000',
        lockDuration: 0,
        aprBase: 0.08,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalAssets: '0',
        totalSupply: '0',
        depositEnabled: true,
        withdrawalEnabled: true,
      };

      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([
        completeMockLPVault,
      ]);

      // Mock LP token data
      stakingSubgraphRepository.getLPTokenData.mockResolvedValue({
        data: {
          address: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
          token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          reserve0: '1000000000000000000000',
          reserve1: '500000000000000000000',
          totalSupply: '1000000000000000000000',
          blockNumber: 1000000,
          timestamp: Date.now() / 1000,
        },
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      // Mock LP price calculation
      calculateLPTokenPriceUseCase.execute.mockResolvedValue({
        lpTokenPrice: {
          lpTokenAddress: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
          token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          token0Symbol: 'ILV',
          token1Symbol: 'ETH',
          priceUsd: 1500,
          reserve0: '1000000000000000000000',
          reserve1: '500000000000000000000',
          reserve0Formatted: '1000',
          reserve1Formatted: '500',
          reserve0ValueUsd: 10000,
          reserve1ValueUsd: 1500000,
          totalLiquidityUsd: 1500000,
          totalSupply: '1000000000000000000000',
          totalSupplyFormatted: '1000',
          token0Weight: 0.0067,
          token1Weight: 0.9933,
          lastUpdated: new Date(),
          blockNumber: 1000000,
          source: 'calculated',
        },
      });

      stakingSubgraphRepository.getUserPositions.mockResolvedValue({
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

      expect(result.vaults[0].vault_id).toBe('ilv-eth_vault');
      expect(result.vaults[0].token_icons.secondary).toBeTruthy();
      expect(result.vaults[0].underlying_asset_ticker).toContain('LP');
    });

    it('should filter vaults by vault_id when provided', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      const mockVault = {
        address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        vault_id: 'ilv_vault',
        name: 'ILV',
      };

      const completeVault = {
        ...mockVault,
        tokenConfig: {
          address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          symbol: 'ILV',
          name: 'Illuvium',
          decimals: 18,
          coingeckoId: 'illuvium',
          isLP: false,
        },
        type: VaultType.SINGLE_TOKEN,
        chain: ChainType.BASE,
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

      // Mock getActiveVaults to return the vault when filtered by ID
      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([
        completeVault,
      ]);

      stakingSubgraphRepository.getUserPositions.mockResolvedValue({
        data: [],
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        vaultId: 'ilv_vault',
        page: 1,
        limit: 10,
      });

      expect(vaultConfigService.getActiveVaults).toHaveBeenCalled();
      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0].vault_id).toBe('ilv_vault');
    });

    it('should handle search parameter correctly', async () => {
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
          name: 'ILV',
          symbol: 'ILV',
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
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          name: 'USDC',
          symbol: 'USDC',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          type: VaultType.SINGLE_TOKEN,
          chain: ChainType.BASE,
          tokenConfig: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            coingeckoId: 'usd-coin',
            isLP: false,
          },
          isActive: true,
          totalAssets: '0',
          totalSupply: '0',
          depositEnabled: true,
          withdrawalEnabled: true,
          seasonNumber: 1,
          minimumDeposit: '1000000',
          maximumDeposit: '1000000000000',
          lockDuration: 0,
          aprBase: 0.03,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue(
        mockVaults,
      );

      stakingSubgraphRepository.getUserPositions.mockResolvedValue({
        data: [],
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        search: 'ILV',
        page: 1,
        limit: 10,
      });

      // Should filter vaults to only show ILV
      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0].vault_id).toBe('ilv_vault');
    });

    it('should calculate user summary correctly', async () => {
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
          name: 'ILV',
          symbol: 'ILV',
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
        {
          address: '0x853e4A8C1C7B9A4F5D6E9C8B7A5F2E1D0C9B8A7E',
          name: 'ILV/ETH',
          symbol: 'ILV/ETH LP',
          asset: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
          type: VaultType.LP_TOKEN,
          chain: ChainType.BASE,
          tokenConfig: {
            address: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
            symbol: 'ILV-ETH-LP',
            name: 'ILV/ETH LP',
            decimals: 18,
            coingeckoId: '',
            isLP: true,
            token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          },
          isActive: true,
          totalAssets: '0',
          totalSupply: '0',
          depositEnabled: true,
          withdrawalEnabled: true,
          seasonNumber: 1,
          minimumDeposit: '1000000000000000000',
          maximumDeposit: '100000000000000000000000',
          lockDuration: 0,
          aprBase: 0.08,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue(
        mockVaults,
      );

      // Mock positions for multiple vaults
      const mockPositions = [
        {
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          shares: '100000000000000000000',
          assets: '100000000000000000000',
          blockNumber: 1000000,
          timestamp: Math.floor(Date.now() / 1000) - 86400,
        },
        {
          vault: '0x853e4A8C1C7B9A4F5D6E9C8B7A5F2E1D0C9B8A7E',
          user: mockWalletAddress,
          shares: '50000000000000000000',
          assets: '50000000000000000000',
          blockNumber: 1000001,
          timestamp: Math.floor(Date.now() / 1000) - 86400,
        },
      ];

      stakingSubgraphRepository.getUserPositions.mockResolvedValue({
        data: mockPositions,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
        },
      });

      // Mock prices
      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        symbol: 'ILV',
        priceUsd: 10,
        change24h: 2.4,
        lastUpdated: new Date(),
        source: 'coingecko',
        isStale: false,
      });

      calculateLPTokenPriceUseCase.execute.mockResolvedValue({
        lpTokenPrice: {
          lpTokenAddress: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
          token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          token0Symbol: 'ILV',
          token1Symbol: 'ETH',
          priceUsd: 1500,
          reserve0: '1000000000000000000000',
          reserve1: '500000000000000000000',
          reserve0Formatted: '1000',
          reserve1Formatted: '500',
          reserve0ValueUsd: 10000,
          reserve1ValueUsd: 1500000,
          totalLiquidityUsd: 1510000,
          totalSupply: '1000000000000000000000',
          totalSupplyFormatted: '1000',
          token0Weight: 0.0066,
          token1Weight: 0.9934,
          lastUpdated: new Date(),
          blockNumber: 1000000,
          source: 'calculated',
        },
      });

      tokenDecimalsService.formatTokenAmount.mockReturnValue('100');

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        page: 1,
        limit: 10,
      });

      expect(result.user_summary.total_user_positions).toBe(2);
      expect(result.user_summary.total_vaults_with_stakes).toBe(2);
      expect(result.user_summary.total_portfolio_value_usd).toBeTruthy();
    });

    it('should handle empty positions gracefully', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([]);

      stakingSubgraphRepository.getUserPositions.mockResolvedValue({
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

      expect(result.vaults).toEqual([]);
      expect(result.user_summary.total_user_positions).toBe(0);
      expect(result.user_summary.total_portfolio_value_usd).toBe('0.00');
    });

    it('should handle subgraph errors gracefully', async () => {
      (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
        seasonNumber: 1,
        primaryChain: ChainType.BASE,
        vaults: [],
        isActive: true,
        startTimestamp: Date.now() / 1000 - 86400,
      });

      stakingSubgraphRepository.getUserPositions.mockRejectedValue(
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
