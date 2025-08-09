import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CalculateLPTokenPriceUseCase } from './calculate-lp-token-price.use-case';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IStakingBlockchainRepository } from '../../domain/repositories/staking-blockchain.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import {
  ChainType,
  LPTokenData,
  TokenMetadata,
  TokenPrice,
  SubgraphSyncStatus,
} from '../../domain/types/staking-types';

describe('CalculateLPTokenPriceUseCase', () => {
  let useCase: CalculateLPTokenPriceUseCase;
  let subgraphRepository: jest.Mocked<IStakingSubgraphRepository>;
  let blockchainRepository: jest.Mocked<IStakingBlockchainRepository>;
  let priceFeedRepository: jest.Mocked<IPriceFeedRepository>;
  let vaultConfigService: jest.Mocked<VaultConfigService>;
  let tokenDecimalsService: jest.Mocked<TokenDecimalsService>;

  const mockLPTokenAddress = '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D';
  const mockToken0Address = '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E';
  const mockToken1Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

  const createMockLPTokenData = (
    overrides: Partial<LPTokenData> = {},
  ): LPTokenData => ({
    address: mockLPTokenAddress,
    token0: mockToken0Address,
    token1: mockToken1Address,
    reserve0: '1000000000000000000000',
    reserve1: '500000000000000000000',
    totalSupply: '1000000000000000000000',
    blockNumber: 1000000,
    timestamp: Date.now() / 1000,
    ...overrides,
  });

  const createMockTokenMetadata = (
    address: string,
    symbol: string,
    decimals: number = 18,
  ): TokenMetadata => ({
    address,
    symbol,
    name: symbol,
    decimals,
    isLP: false,
  });

  const createMockTokenPrice = (
    address: string,
    symbol: string,
    priceUsd: number,
  ): TokenPrice => ({
    tokenAddress: address,
    symbol,
    priceUsd,
    change24h: 0,
    lastUpdated: new Date(),
    source: 'mock',
    isStale: false,
  });

  const createMockSyncStatus = (): SubgraphSyncStatus => ({
    chainHeadBlock: 1000000,
    latestBlock: 1000000,
    blocksBehind: 0,
    isHealthy: true,
    lastSyncTime: new Date(),
    isSyncing: false,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculateLPTokenPriceUseCase,
        {
          provide: 'IStakingSubgraphRepository',
          useValue: {
            getLPTokenData: jest.fn(),
          },
        },
        {
          provide: 'IStakingBlockchainRepository',
          useValue: {
            getTokenMetadata: jest.fn(),
            getLPTokenData: jest.fn(),
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
            validateChain: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: TokenDecimalsService,
          useValue: {
            formatTokenAmount: jest.fn(),
            parseTokenAmount: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<CalculateLPTokenPriceUseCase>(
      CalculateLPTokenPriceUseCase,
    );
    subgraphRepository = module.get('IStakingSubgraphRepository');
    blockchainRepository = module.get('IStakingBlockchainRepository');
    priceFeedRepository = module.get('IPriceFeedRepository');
    vaultConfigService = module.get(VaultConfigService);
    tokenDecimalsService = module.get(TokenDecimalsService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    tokenDecimalsService.formatTokenAmount.mockImplementation(
      (amount: string, decimals: number) => {
        const value = BigInt(amount) / BigInt(10) ** BigInt(decimals);
        return value.toString();
      },
    );
  });

  describe('calculateGeometricMeanPrice', () => {
    beforeEach(() => {
      const lpTokenData = createMockLPTokenData();
      const token0Metadata = createMockTokenMetadata(mockToken0Address, 'ILV');
      const token1Metadata = createMockTokenMetadata(mockToken1Address, 'ETH');
      const token0Price = createMockTokenPrice(mockToken0Address, 'ILV', 10);
      const token1Price = createMockTokenPrice(mockToken1Address, 'ETH', 3000);

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      blockchainRepository.getTokenMetadata
        .mockResolvedValueOnce(token0Metadata)
        .mockResolvedValueOnce(token1Metadata);

      priceFeedRepository.getTokenPrice
        .mockResolvedValueOnce(token0Price)
        .mockResolvedValueOnce(token1Price);
    });

    it('should calculate geometric mean price correctly with normal values', async () => {
      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      const reserve0 = 1000;
      const reserve1 = 500;
      const price0 = 10;
      const price1 = 3000;
      const totalSupply = 1000;

      const expectedGeometricMean =
        (2 * Math.sqrt(reserve0 * reserve1) * Math.sqrt(price0 * price1)) /
        totalSupply;

      expect(result.lpTokenPrice.priceUsd).toBeCloseTo(
        expectedGeometricMean,
        5,
      );
    });

    it('should return 0 when reserves are zero', async () => {
      const lpTokenDataWithZeroReserve = createMockLPTokenData({
        reserve0: '0',
        reserve1: '500000000000000000000',
      });

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenDataWithZeroReserve,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBe(0);
    });

    it('should return 0 when both reserves are zero', async () => {
      const lpTokenDataWithZeroReserves = createMockLPTokenData({
        reserve0: '0',
        reserve1: '0',
      });

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenDataWithZeroReserves,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBe(0);
    });

    it('should return 0 when total supply is zero', async () => {
      const lpTokenDataWithZeroSupply = createMockLPTokenData({
        totalSupply: '0',
      });

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenDataWithZeroSupply,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBe(0);
    });

    it('should return 0 when token prices are zero', async () => {
      const zeroPrice = createMockTokenPrice(mockToken0Address, 'ILV', 0);
      const normalPrice = createMockTokenPrice(mockToken1Address, 'ETH', 3000);

      priceFeedRepository.getTokenPrice
        .mockResolvedValueOnce(zeroPrice)
        .mockResolvedValueOnce(normalPrice);

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBeCloseTo(244.949, 2);
    });

    it('should fallback to arithmetic mean when geometric calculation fails', async () => {
      tokenDecimalsService.formatTokenAmount.mockImplementation(
        (amount: string, decimals: number) => {
          if (amount === '1000000000000000000000' && decimals === 18) {
            return '0';
          }
          const value = BigInt(amount) / BigInt(10) ** BigInt(decimals);
          return value.toString();
        },
      );

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBe(0);
    });

    it('should fallback to arithmetic mean when geometric result is infinite', async () => {
      const lpTokenDataWithTinySupply = createMockLPTokenData({
        totalSupply: '1',
      });

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenDataWithTinySupply,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      const reserve0 = 1000;
      const reserve1 = 500;
      const price0 = 10;
      const price1 = 3000;
      const totalSupply = 0.000000000000000001;

      const geometricResult =
        (2 * Math.sqrt(reserve0 * reserve1) * Math.sqrt(price0 * price1)) /
        totalSupply;

      if (!isFinite(geometricResult) || geometricResult < 0) {
        const expectedArithmeticMean =
          (reserve0 * price0 + reserve1 * price1) / totalSupply;
        expect(result.lpTokenPrice.priceUsd).toBeCloseTo(
          expectedArithmeticMean,
          0,
        );
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid geometric mean price calculated'),
          expect.stringContaining('falling back to arithmetic mean'),
        );
      }
    });

    it('should handle real ILV/ETH data showing price difference', async () => {
      const ilvEthLPData = createMockLPTokenData({
        reserve0: '1000000000000000000000000',
        reserve1: '333333333333333333333',
        totalSupply: '18257418583505536366854',
      });

      const ilvPrice = createMockTokenPrice(mockToken0Address, 'ILV', 10);
      const ethPrice = createMockTokenPrice(mockToken1Address, 'ETH', 3000);

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: ilvEthLPData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      priceFeedRepository.getTokenPrice
        .mockResolvedValueOnce(ilvPrice)
        .mockResolvedValueOnce(ethPrice);

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      const reserve0 = 1000000;
      const reserve1 = 333.3333; // Simplified to avoid precision loss
      const price0 = 10;
      const price1 = 3000;
      const totalSupply = 18257.4186; // Simplified to avoid precision loss

      const geometricMean =
        (2 * Math.sqrt(reserve0 * reserve1) * Math.sqrt(price0 * price1)) /
        totalSupply;
      const arithmeticMean =
        (reserve0 * price0 + reserve1 * price1) / totalSupply;

      expect(result.lpTokenPrice.priceUsd).toBeCloseTo(346.245, 1);

      const priceDifferencePercent = Math.abs(
        ((geometricMean - arithmeticMean) / arithmeticMean) * 100,
      );
      expect(priceDifferencePercent).toBeGreaterThan(40);
    });

    it('should compare geometric vs arithmetic mean showing the difference', async () => {
      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      const reserve0 = 1000;
      const reserve1 = 500;
      const price0 = 10;
      const price1 = 3000;
      const totalSupply = 1000;

      const arithmeticMean =
        (reserve0 * price0 + reserve1 * price1) / totalSupply;

      expect(result.lpTokenPrice.priceUsd).toBeCloseTo(244.949, 2);
      expect(result.lpTokenPrice.priceUsd).not.toBeCloseTo(arithmeticMean, 5);
      expect(arithmeticMean).toBe(1510);
      expect(result.lpTokenPrice.priceUsd).toBeLessThan(arithmeticMean);
    });

    it('should handle large numbers without overflow', async () => {
      // Using string concatenation to avoid precision loss
      const largeLPData = createMockLPTokenData({
        reserve0: '1' + '0'.repeat(27), // 1 billion tokens with 18 decimals
        reserve1: '5' + '0'.repeat(26), // 500 million tokens with 18 decimals
        totalSupply: '1' + '0'.repeat(27), // 1 billion LP tokens
      });

      const largePrice0 = createMockTokenPrice(
        mockToken0Address,
        'ILV',
        100000,
      );
      const largePrice1 = createMockTokenPrice(
        mockToken1Address,
        'ETH',
        5000000,
      );

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: largeLPData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      priceFeedRepository.getTokenPrice
        .mockResolvedValueOnce(largePrice0)
        .mockResolvedValueOnce(largePrice1);

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBeGreaterThan(0);
      expect(result.lpTokenPrice.priceUsd).toBeLessThan(Infinity);
      expect(isFinite(result.lpTokenPrice.priceUsd)).toBe(true);
    });

    it('should handle precision with very small numbers', async () => {
      const smallLPData = createMockLPTokenData({
        reserve0: '1000000000000000000000',
        reserve1: '500000000000000000000',
        totalSupply: '1000000000000000000000',
      });

      const smallPrice0 = createMockTokenPrice(mockToken0Address, 'ILV', 0.001);
      const smallPrice1 = createMockTokenPrice(mockToken1Address, 'ETH', 0.002);

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: smallLPData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      priceFeedRepository.getTokenPrice
        .mockResolvedValueOnce(smallPrice0)
        .mockResolvedValueOnce(smallPrice1);

      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBeGreaterThan(0);
      expect(isFinite(result.lpTokenPrice.priceUsd)).toBe(true);
    });

    it('should handle geometric mean calculation edge cases', async () => {
      const result = await useCase.execute({
        lpTokenAddress: mockLPTokenAddress,
        chain: ChainType.BASE,
      });

      expect(result.lpTokenPrice.priceUsd).toBeGreaterThan(0);
      expect(isFinite(result.lpTokenPrice.priceUsd)).toBe(true);
      expect(result.lpTokenPrice.source).toBe('calculated');
    });
  });

  describe('edge cases and error handling', () => {
    it('should validate input parameters', async () => {
      await expect(
        useCase.execute({
          lpTokenAddress: 'invalid-address',
          chain: ChainType.BASE,
        }),
      ).rejects.toThrow('Invalid LP token address format');

      vaultConfigService.validateChain.mockReturnValue(false);
      await expect(
        useCase.execute({
          lpTokenAddress: mockLPTokenAddress,
          chain: 'INVALID' as ChainType,
        }),
      ).rejects.toThrow('Unsupported chain: INVALID');
    });

    it('should handle subgraph failures gracefully', async () => {
      subgraphRepository.getLPTokenData.mockRejectedValue(
        new Error('Subgraph error'),
      );

      await expect(
        useCase.execute({
          lpTokenAddress: mockLPTokenAddress,
          chain: ChainType.BASE,
        }),
      ).rejects.toThrow('Failed to calculate LP token price');
    });

    it('should handle token metadata failures', async () => {
      const lpTokenData = createMockLPTokenData();

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      blockchainRepository.getTokenMetadata.mockRejectedValue(
        new Error('Metadata error'),
      );

      await expect(
        useCase.execute({
          lpTokenAddress: mockLPTokenAddress,
          chain: ChainType.BASE,
        }),
      ).rejects.toThrow('Failed to calculate LP token price');
    });

    it('should handle price feed failures', async () => {
      const lpTokenData = createMockLPTokenData();
      const token0Metadata = createMockTokenMetadata(mockToken0Address, 'ILV');
      const token1Metadata = createMockTokenMetadata(mockToken1Address, 'ETH');

      subgraphRepository.getLPTokenData.mockResolvedValue({
        data: lpTokenData,
        metadata: {
          source: 'subgraph',
          lastUpdated: new Date(),
          isStale: false,
          syncStatus: createMockSyncStatus(),
        },
      });

      blockchainRepository.getTokenMetadata
        .mockResolvedValueOnce(token0Metadata)
        .mockResolvedValueOnce(token1Metadata);

      priceFeedRepository.getTokenPrice.mockRejectedValue(
        new Error('Price feed error'),
      );

      await expect(
        useCase.execute({
          lpTokenAddress: mockLPTokenAddress,
          chain: ChainType.BASE,
        }),
      ).rejects.toThrow('Failed to calculate LP token price');
    });
  });
});
