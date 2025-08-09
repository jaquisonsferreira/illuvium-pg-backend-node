import { Test, TestingModule } from '@nestjs/testing';
import { GetUserStakingPositionsUseCase } from './get-user-staking-positions.use-case';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IStakingBlockchainRepository } from '../../domain/repositories/staking-blockchain.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { RewardsConfigService } from '../../infrastructure/services/rewards-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import { CalculateLPTokenPriceUseCase } from './calculate-lp-token-price.use-case';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChainType,
  VaultType,
  VaultConfig,
} from '../../domain/types/staking-types';
import { ShardEarningHistoryEntity } from '../../../shards/domain/entities/shard-earning-history.entity';

describe('GetUserStakingPositionsUseCase', () => {
  let useCase: GetUserStakingPositionsUseCase;
  let stakingSubgraphRepository: jest.Mocked<IStakingSubgraphRepository>;
  let blockchainRepository: jest.Mocked<IStakingBlockchainRepository>;
  let priceFeedRepository: jest.Mocked<IPriceFeedRepository>;
  let vaultConfigService: VaultConfigService;
  let tokenDecimalsService: jest.Mocked<TokenDecimalsService>;
  let calculateLPTokenPriceUseCase: jest.Mocked<CalculateLPTokenPriceUseCase>;
  let shardEarningHistoryRepository: any;

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
            getVaultsTVL: jest.fn(),
          },
        },
        {
          provide: 'IStakingBlockchainRepository',
          useValue: {
            getUserTokenBalance: jest.fn(),
            getTokenMetadata: jest.fn(),
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
          provide: 'IShardEarningHistoryRepository',
          useValue: {
            findByWalletAndDate: jest.fn(),
            findByWallet: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn(),
            getSummaryByWallet: jest.fn(),
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
        {
          provide: RewardsConfigService,
          useValue: {
            getRewardsConfig: jest.fn(),
            calculateApr: jest.fn(),
            getMultipliers: jest.fn(),
            getRewardRate: jest.fn().mockReturnValue(100),
            calculateShardsMultiplier: jest.fn().mockReturnValue(1.0),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetUserStakingPositionsUseCase>(
      GetUserStakingPositionsUseCase,
    );
    stakingSubgraphRepository = module.get('IStakingSubgraphRepository');
    blockchainRepository = module.get('IStakingBlockchainRepository');
    priceFeedRepository = module.get('IPriceFeedRepository');
    vaultConfigService = module.get(VaultConfigService);
    tokenDecimalsService = module.get(TokenDecimalsService);
    calculateLPTokenPriceUseCase = module.get(CalculateLPTokenPriceUseCase);
    shardEarningHistoryRepository = module.get(
      'IShardEarningHistoryRepository',
    );

    // Mock logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Set up default mock for getVaultsTVL
    stakingSubgraphRepository.getVaultsTVL.mockResolvedValue({});
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

      // Mock user token balance
      blockchainRepository.getUserTokenBalance.mockResolvedValue(
        '50250000000000000000', // 50.25 tokens
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

      // Mock user token balance for LP token
      blockchainRepository.getUserTokenBalance.mockResolvedValue('0');

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

      // Mock wallet balance
      blockchainRepository.getUserTokenBalance.mockResolvedValue('0');

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

      tokenDecimalsService.getDecimals.mockResolvedValue(18);

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

      // Mock wallet balances
      blockchainRepository.getUserTokenBalance.mockResolvedValue('0');

      // Mock token prices
      priceFeedRepository.getTokenPrice.mockResolvedValue({
        tokenAddress: '',
        symbol: '',
        priceUsd: 1,
        change24h: 0,
        lastUpdated: new Date(),
        source: 'mock',
        isStale: false,
      });

      tokenDecimalsService.getDecimals.mockResolvedValue(18);

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

    it('should calculate user summary correctly with historical data', async () => {
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

      // Setup getLPTokenData mock for LP vault
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

      // Mock shard earning history for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      const mockShardEarning = ShardEarningHistoryEntity.create({
        walletAddress: mockWalletAddress,
        seasonId: 1,
        date: yesterday,
        stakingShards: 150,
        socialShards: 25,
        developerShards: 10,
        referralShards: 5,
      });

      shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(
        mockShardEarning,
      );

      // Mock historical summary with lifetime earnings including closed positions
      shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue({
        totalDays: 30,
        totalShards: 4500,
        avgDailyShards: 150,
        breakdown: {
          staking: 3500, // Includes both active and closed positions
          social: 500,
          developer: 300,
          referral: 200,
        },
      });

      const result = await useCase.execute({
        walletAddress: mockWalletAddress,
        page: 1,
        limit: 10,
      });

      expect(result.user_summary.total_user_positions).toBe(2);
      expect(result.user_summary.total_vaults_with_stakes).toBe(2);
      expect(result.user_summary.total_portfolio_value_usd).toBeTruthy();
      expect(result.user_summary.shards_earned_last_day).toBe('150');
      expect(result.user_summary.total_user_earned_shards).toBe('3500'); // Historical total, not active positions

      // Verify historical data was used instead of active positions
      expect(
        shardEarningHistoryRepository.getSummaryByWallet,
      ).toHaveBeenCalledWith(
        mockWalletAddress,
        1, // season ID
      );
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

      (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([]);

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

    describe('shards_earned_last_day', () => {
      beforeEach(() => {
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
      });

      it('should return correct shards_earned_last_day when data exists', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        const mockShardEarning = ShardEarningHistoryEntity.create({
          walletAddress: mockWalletAddress,
          seasonId: 1,
          date: yesterday,
          stakingShards: 250,
          socialShards: 50,
          developerShards: 25,
          referralShards: 15,
        });

        shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(
          mockShardEarning,
        );

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(
          shardEarningHistoryRepository.findByWalletAndDate,
        ).toHaveBeenCalledWith(mockWalletAddress, yesterday, 1);
        expect(result.user_summary.shards_earned_last_day).toBe('250');
      });

      it('should return "0" when no data exists for yesterday', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(
          null,
        );

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(
          shardEarningHistoryRepository.findByWalletAndDate,
        ).toHaveBeenCalledWith(mockWalletAddress, yesterday, 1);
        expect(result.user_summary.shards_earned_last_day).toBe('0');
      });

      it('should handle repository errors gracefully and return "0"', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        const repositoryError = new Error('Database connection failed');
        shardEarningHistoryRepository.findByWalletAndDate.mockRejectedValue(
          repositoryError,
        );

        // Mock logger to verify warning was logged
        const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(
          shardEarningHistoryRepository.findByWalletAndDate,
        ).toHaveBeenCalledWith(mockWalletAddress, yesterday, 1);
        expect(result.user_summary.shards_earned_last_day).toBe('0');
        expect(loggerWarnSpy).toHaveBeenCalledWith(
          `Failed to fetch yesterday's shard earnings for wallet ${mockWalletAddress}:`,
          repositoryError,
        );
      });

      it('should handle different shard earning amounts correctly', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        const testCases = [
          { stakingShards: 0, expected: '0' },
          { stakingShards: 1, expected: '1' },
          { stakingShards: 999999, expected: '999999' },
          { stakingShards: 123.45, expected: '123.45' },
        ];

        for (const testCase of testCases) {
          const mockShardEarning = ShardEarningHistoryEntity.create({
            walletAddress: mockWalletAddress,
            seasonId: 1,
            date: yesterday,
            stakingShards: testCase.stakingShards,
          });

          shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(
            mockShardEarning,
          );

          const result = await useCase.execute({
            walletAddress: mockWalletAddress,
            page: 1,
            limit: 10,
          });

          expect(result.user_summary.shards_earned_last_day).toBe(
            testCase.expected,
          );
        }
      });

      it('should call repository with correct parameters for different seasons', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        // Test with season 2
        (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
          seasonNumber: 2,
          primaryChain: ChainType.BASE,
          vaults: [],
          isActive: true,
          startTimestamp: Date.now() / 1000 - 86400,
        });

        shardEarningHistoryRepository.findByWalletAndDate.mockResolvedValue(
          null,
        );

        await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(
          shardEarningHistoryRepository.findByWalletAndDate,
        ).toHaveBeenCalledWith(mockWalletAddress, yesterday, 2);
      });
    });

    describe('total_user_earned_shards with historical data', () => {
      it('should include total_user_earned_shards from closed positions', async () => {
        (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
          seasonNumber: 1,
          primaryChain: ChainType.BASE,
          vaults: [],
          isActive: true,
          startTimestamp: Date.now() / 1000 - 86400,
        });

        (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([]);

        stakingSubgraphRepository.getUserPositions.mockResolvedValue({
          data: [], // No active positions
          metadata: {
            source: 'subgraph',
            lastUpdated: new Date(),
            isStale: false,
          },
        });

        // Mock historical summary showing user has earnings from closed positions
        shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue({
          totalDays: 60,
          totalShards: 8250,
          avgDailyShards: 137.5,
          breakdown: {
            staking: 7500, // All from closed positions
            social: 400,
            developer: 200,
            referral: 150,
          },
        });

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(result.user_summary.total_user_positions).toBe(0); // No active positions
        expect(result.user_summary.total_vaults_with_stakes).toBe(0);
        expect(result.user_summary.total_user_earned_shards).toBe('7500'); // Lifetime earnings from closed positions
        expect(
          shardEarningHistoryRepository.getSummaryByWallet,
        ).toHaveBeenCalledWith(mockWalletAddress, 1);
      });

      it('should calculate user summary with mix of active and closed positions', async () => {
        (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
          seasonNumber: 1,
          primaryChain: ChainType.BASE,
          vaults: [],
          isActive: true,
          startTimestamp: Date.now() / 1000 - 86400,
        });

        const mockVault = {
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
        };

        (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([
          mockVault,
        ]);

        // Mock current active position
        const mockPosition = {
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          shares: '50000000000000000000',
          assets: '50000000000000000000',
          blockNumber: 1000000,
          timestamp: Math.floor(Date.now() / 1000) - 86400,
        };

        stakingSubgraphRepository.getUserPositions.mockResolvedValue({
          data: [mockPosition],
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
          priceUsd: 10,
          change24h: 2.4,
          lastUpdated: new Date(),
          source: 'coingecko',
          isStale: false,
        });

        tokenDecimalsService.getDecimals.mockResolvedValue(18);
        tokenDecimalsService.formatTokenAmount.mockReturnValue('50');
        blockchainRepository.getUserTokenBalance.mockResolvedValue('0');

        // Mock historical summary showing total including closed positions
        shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue({
          totalDays: 45,
          totalShards: 6750,
          avgDailyShards: 150,
          breakdown: {
            staking: 6000, // 5000 from closed positions + 1000 from active
            social: 400,
            developer: 250,
            referral: 100,
          },
        });

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(result.user_summary.total_user_positions).toBe(1); // Active positions
        expect(result.user_summary.total_vaults_with_stakes).toBe(1);
        expect(result.user_summary.total_user_earned_shards).toBe('6000'); // Total lifetime including closed
        expect(
          shardEarningHistoryRepository.getSummaryByWallet,
        ).toHaveBeenCalledWith(mockWalletAddress, 1);
      });

      it('should fallback to active positions calculation when historical repository fails', async () => {
        (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
          seasonNumber: 1,
          primaryChain: ChainType.BASE,
          vaults: [],
          isActive: true,
          startTimestamp: Date.now() / 1000 - 86400,
        });

        const mockVault = {
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
        };

        (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([
          mockVault,
        ]);

        const mockPosition = {
          vault: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
          user: mockWalletAddress,
          shares: '100000000000000000000',
          assets: '100000000000000000000',
          blockNumber: 1000000,
          timestamp: Math.floor(Date.now() / 1000) - 86400,
        };

        stakingSubgraphRepository.getUserPositions.mockResolvedValue({
          data: [mockPosition],
          metadata: {
            source: 'subgraph',
            lastUpdated: new Date(),
            isStale: false,
          },
        });

        priceFeedRepository.getTokenPrice.mockResolvedValue({
          tokenAddress: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
          symbol: 'ILV',
          priceUsd: 10,
          change24h: 2.4,
          lastUpdated: new Date(),
          source: 'coingecko',
          isStale: false,
        });

        tokenDecimalsService.getDecimals.mockResolvedValue(18);
        tokenDecimalsService.formatTokenAmount.mockReturnValue('100');
        blockchainRepository.getUserTokenBalance.mockResolvedValue('0');

        // Mock historical repository failure
        const repositoryError = new Error(
          'Historical data service unavailable',
        );
        shardEarningHistoryRepository.getSummaryByWallet.mockRejectedValue(
          repositoryError,
        );

        // Mock logger to verify warning was logged
        const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        // Should fallback to calculating from active positions only
        // The vault will calculate earned shards based on staked amount * price * rate * multiplier
        // 100 tokens * $10 * (100/1000) rate * 1.0 multiplier = 100 shards
        expect(result.user_summary.total_user_earned_shards).toBe('100'); // Active positions calculation

        expect(
          shardEarningHistoryRepository.getSummaryByWallet,
        ).toHaveBeenCalledWith(mockWalletAddress, 1);

        expect(loggerWarnSpy).toHaveBeenCalledWith(
          `Failed to fetch historical shard data for wallet ${mockWalletAddress}, falling back to active positions:`,
          repositoryError,
        );
      });

      it('should handle zero positions but with historical earnings', async () => {
        (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
          seasonNumber: 1,
          primaryChain: ChainType.BASE,
          vaults: [],
          isActive: true,
          startTimestamp: Date.now() / 1000 - 86400,
        });

        (vaultConfigService.getActiveVaults as jest.Mock).mockReturnValue([]);

        // No active positions
        stakingSubgraphRepository.getUserPositions.mockResolvedValue({
          data: [],
          metadata: {
            source: 'subgraph',
            lastUpdated: new Date(),
            isStale: false,
          },
        });

        // But has historical earnings (all positions were closed)
        shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue({
          totalDays: 90,
          totalShards: 12750,
          avgDailyShards: 141.67,
          breakdown: {
            staking: 10000, // All from previous closed positions
            social: 1500,
            developer: 800,
            referral: 450,
          },
        });

        const result = await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        expect(result.user_summary.total_user_positions).toBe(0);
        expect(result.user_summary.total_vaults_with_stakes).toBe(0);
        expect(result.user_summary.total_portfolio_value_usd).toBe('0.00');
        expect(result.user_summary.total_user_earned_shards).toBe('10000'); // Historical total
        expect(result.vaults).toEqual([]);

        expect(
          shardEarningHistoryRepository.getSummaryByWallet,
        ).toHaveBeenCalledWith(mockWalletAddress, 1);
      });

      it('should handle different season IDs in historical data queries', async () => {
        (vaultConfigService.getCurrentSeason as jest.Mock).mockReturnValue({
          seasonNumber: 3, // Different season
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

        shardEarningHistoryRepository.getSummaryByWallet.mockResolvedValue({
          totalDays: 15,
          totalShards: 2250,
          avgDailyShards: 150,
          breakdown: {
            staking: 2000,
            social: 150,
            developer: 75,
            referral: 25,
          },
        });

        await useCase.execute({
          walletAddress: mockWalletAddress,
          page: 1,
          limit: 10,
        });

        // Verify it uses the correct season ID
        expect(
          shardEarningHistoryRepository.getSummaryByWallet,
        ).toHaveBeenCalledWith(
          mockWalletAddress,
          3, // Season 3
        );
      });
    });
  });
});
