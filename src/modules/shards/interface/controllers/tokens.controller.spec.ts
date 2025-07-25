import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { TokensController } from './tokens.controller';
import { GetTokenMetadataUseCase } from '../../application/use-cases/get-token-metadata.use-case';
import { ApiError } from '../dto';
import { TokenMetadataEntity } from '../../domain/entities/token-metadata.entity';

describe('TokensController', () => {
  let controller: TokensController;
  let getTokenMetadataUseCase: jest.Mocked<GetTokenMetadataUseCase>;

  const validTokenAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const invalidTokenAddress = 'invalid_address';

  const mockTokenMetadata = new TokenMetadataEntity(
    'mock-id-1',
    validTokenAddress,
    'base',
    'ETH',
    'Ethereum',
    18,
    '1000000000000000000000000',
    '900000000000000000000000',
    'ethereum',
    false,
    null,
    null,
    null,
    null,
    'https://example.com/eth.png',
    'ERC20',
    true,
    new Date('2024-01-15T12:00:00Z'),
    new Date('2024-01-01T00:00:00Z'),
    new Date('2024-01-15T12:00:00Z'),
  );

  const mockLpToken = new TokenMetadataEntity(
    'mock-id-2',
    '0xabcdef1234567890abcdef1234567890abcdef12',
    'base',
    'ETH-USDC-LP',
    'ETH-USDC LP Token',
    18,
    '50000000000000000000000',
    '50000000000000000000000',
    null,
    true,
    validTokenAddress,
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
    'uniswap-v2',
    null,
    'LP',
    true,
    new Date('2024-01-15T12:00:00Z'),
    new Date('2024-01-01T00:00:00Z'),
    new Date('2024-01-15T12:00:00Z'),
  );

  beforeEach(async () => {
    const mockGetTokenMetadataUseCase = {
      execute: jest.fn(),
      searchTokens: jest.fn(),
      getLpTokens: jest.fn(),
      getTokenPairInfo: jest.fn(),
      validateTokenMetadata: jest.fn(),
      getTokensByPoolAddress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokensController],
      providers: [
        {
          provide: GetTokenMetadataUseCase,
          useValue: mockGetTokenMetadataUseCase,
        },
      ],
    }).compile();

    controller = module.get<TokensController>(TokensController);
    getTokenMetadataUseCase = module.get(GetTokenMetadataUseCase);
  });

  describe('getTokenMetadata', () => {
    it('should return token metadata by address', async () => {
      getTokenMetadataUseCase.execute.mockResolvedValue({
        token: mockTokenMetadata,
        cached: false,
      });

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      const result = await controller.getTokenMetadata(query);

      expect(getTokenMetadataUseCase.execute).toHaveBeenCalledWith(query);
      expect(result).toEqual({
        token: {
          address: validTokenAddress,
          chain: 'base',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          coingeckoId: 'ethereum',
          isLpToken: false,
          token0Address: null,
          token1Address: null,
          poolAddress: null,
          dex: null,
          isVerified: true,
          lastUpdated: '2024-01-15T12:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        cached: false,
        error: undefined,
      });
    });

    it('should return token metadata by symbol', async () => {
      getTokenMetadataUseCase.execute.mockResolvedValue({
        token: mockTokenMetadata,
        cached: true,
      });

      const query = {
        symbol: 'ETH',
        chain: 'base',
      };

      const result = await controller.getTokenMetadata(query);

      expect(getTokenMetadataUseCase.execute).toHaveBeenCalledWith(query);
      expect(result.cached).toBe(true);
    });

    it('should return token metadata by coingeckoId', async () => {
      getTokenMetadataUseCase.execute.mockResolvedValue({
        token: mockTokenMetadata,
        cached: false,
      });

      const query = {
        coingeckoId: 'ethereum',
        chain: 'base',
      };

      const result = await controller.getTokenMetadata(query);

      expect(getTokenMetadataUseCase.execute).toHaveBeenCalledWith(query);
      expect(result.token?.coingeckoId).toBe('ethereum');
    });

    it('should throw error when no search parameters provided', async () => {
      const query = {
        chain: 'base',
      };

      await expect(controller.getTokenMetadata(query)).rejects.toThrow(HttpException);

      try {
        await controller.getTokenMetadata(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'MISSING_PARAMETERS',
          message: 'At least one search parameter is required (tokenAddress, symbol, or coingeckoId)',
        });
      }
    });

    it('should throw error for invalid token address', async () => {
      const query = {
        tokenAddress: invalidTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenMetadata(query)).rejects.toThrow(HttpException);
    });

    it('should handle token not found', async () => {
      getTokenMetadataUseCase.execute.mockResolvedValue({
        token: null,
        cached: false,
        error: 'Token not found in database',
      });

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenMetadata(query)).rejects.toThrow(HttpException);

      try {
        await controller.getTokenMetadata(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(404);
        expect(error.getResponse()).toMatchObject({
          statusCode: 404,
          error: 'TOKEN_NOT_FOUND',
          message: 'Token not found in database',
        });
      }
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.invalidWalletAddress(validTokenAddress);
      getTokenMetadataUseCase.execute.mockRejectedValue(apiError);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenMetadata(query)).rejects.toThrow(HttpException);
    });
  });

  describe('searchTokens', () => {
    it('should return search results', async () => {
      const mockSearchResults = {
        tokens: [mockTokenMetadata, mockLpToken],
        total: 2,
      };

      getTokenMetadataUseCase.searchTokens.mockResolvedValue(mockSearchResults);

      const query = {
        query: 'ETH',
        limit: 10,
      };

      const result = await controller.searchTokens(query);

      expect(getTokenMetadataUseCase.searchTokens).toHaveBeenCalledWith('ETH', 10);
      expect(result.tokens).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter results by chain', async () => {
      const ethereumToken = new TokenMetadataEntity(
        'mock-id-3',
        mockTokenMetadata.tokenAddress,
        'ethereum',
        mockTokenMetadata.symbol,
        mockTokenMetadata.name,
        mockTokenMetadata.decimals,
        mockTokenMetadata.totalSupply,
        mockTokenMetadata.circulatingSupply,
        mockTokenMetadata.coingeckoId,
        mockTokenMetadata.isLpToken,
        mockTokenMetadata.token0Address,
        mockTokenMetadata.token1Address,
        mockTokenMetadata.poolAddress,
        mockTokenMetadata.dexName,
        mockTokenMetadata.logoUrl,
        mockTokenMetadata.contractType,
        mockTokenMetadata.isVerified,
        mockTokenMetadata.lastUpdated,
        mockTokenMetadata.createdAt,
        mockTokenMetadata.updatedAt,
      );

      const mockSearchResults = {
        tokens: [mockTokenMetadata, ethereumToken],
        total: 2,
      };

      getTokenMetadataUseCase.searchTokens.mockResolvedValue(mockSearchResults);

      const query = {
        query: 'ETH',
        chain: 'base',
      };

      const result = await controller.searchTokens(query);

      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].chain).toBe('base');
    });

    it('should throw error for short search query', async () => {
      const query = {
        query: 'E',
      };

      await expect(controller.searchTokens(query)).rejects.toThrow(HttpException);

      try {
        await controller.searchTokens(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_SEARCH_QUERY',
          message: 'Search query must be at least 2 characters long',
        });
      }
    });

    it('should throw error for empty search query', async () => {
      const query = {
        query: '  ',
      };

      await expect(controller.searchTokens(query)).rejects.toThrow(HttpException);
    });
  });

  describe('getLpTokens', () => {
    it('should return paginated LP tokens', async () => {
      const mockLpTokens = Array(25).fill(null).map((_, index) => 
        new TokenMetadataEntity(
          `mock-id-lp-${index}`,
          `0x${index.toString().padStart(40, '0')}`,
          mockLpToken.chain,
          mockLpToken.symbol,
          mockLpToken.name,
          mockLpToken.decimals,
          mockLpToken.totalSupply,
          mockLpToken.circulatingSupply,
          mockLpToken.coingeckoId,
          mockLpToken.isLpToken,
          mockLpToken.token0Address,
          mockLpToken.token1Address,
          mockLpToken.poolAddress,
          mockLpToken.dexName,
          mockLpToken.logoUrl,
          mockLpToken.contractType,
          mockLpToken.isVerified,
          mockLpToken.lastUpdated,
          mockLpToken.createdAt,
          mockLpToken.updatedAt,
        ),
      );

      getTokenMetadataUseCase.getLpTokens.mockResolvedValue({
        tokens: mockLpTokens,
        total: 25,
      });

      const query = {
        chain: 'base',
        page: 1,
        limit: 20,
      };

      const result = await controller.getLpTokens(query);

      expect(getTokenMetadataUseCase.getLpTokens).toHaveBeenCalledWith('base');
      expect(result.data).toHaveLength(20);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        totalItems: 25,
        totalPages: 2,
      });
    });

    it('should handle page 2 of results', async () => {
      const mockLpTokens = Array(25).fill(null).map((_, index) => 
        new TokenMetadataEntity(
          `mock-id-lp-${index}`,
          `0x${index.toString().padStart(40, '0')}`,
          mockLpToken.chain,
          mockLpToken.symbol,
          mockLpToken.name,
          mockLpToken.decimals,
          mockLpToken.totalSupply,
          mockLpToken.circulatingSupply,
          mockLpToken.coingeckoId,
          mockLpToken.isLpToken,
          mockLpToken.token0Address,
          mockLpToken.token1Address,
          mockLpToken.poolAddress,
          mockLpToken.dexName,
          mockLpToken.logoUrl,
          mockLpToken.contractType,
          mockLpToken.isVerified,
          mockLpToken.lastUpdated,
          mockLpToken.createdAt,
          mockLpToken.updatedAt,
        ),
      );

      getTokenMetadataUseCase.getLpTokens.mockResolvedValue({
        tokens: mockLpTokens,
        total: 25,
      });

      const query = {
        chain: 'base',
        page: 2,
        limit: 20,
      };

      const result = await controller.getLpTokens(query);

      expect(result.data).toHaveLength(5);
      expect(result.pagination.page).toBe(2);
    });

    it('should use default pagination values', async () => {
      getTokenMetadataUseCase.getLpTokens.mockResolvedValue({
        tokens: [],
        total: 0,
      });

      const query = {
        chain: 'base',
      };

      const result = await controller.getLpTokens(query);

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('should handle errors', async () => {
      getTokenMetadataUseCase.getLpTokens.mockRejectedValue(
        new Error('Database error'),
      );

      const query = {
        chain: 'base',
      };

      await expect(controller.getLpTokens(query)).rejects.toThrow(HttpException);

      try {
        await controller.getLpTokens(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(500);
        expect(error.getResponse()).toMatchObject({
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve LP tokens',
        });
      }
    });
  });

  describe('getTokenPairInfo', () => {
    it('should return token pair information', async () => {
      const mockPairInfo = {
        token0: mockTokenMetadata,
        token1: new TokenMetadataEntity(
          'mock-id-4',
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          mockTokenMetadata.chain,
          'USDC',
          'USD Coin',
          6,
          mockTokenMetadata.totalSupply,
          mockTokenMetadata.circulatingSupply,
          'usd-coin',
          mockTokenMetadata.isLpToken,
          mockTokenMetadata.token0Address,
          mockTokenMetadata.token1Address,
          mockTokenMetadata.poolAddress,
          mockTokenMetadata.dexName,
          mockTokenMetadata.logoUrl,
          mockTokenMetadata.contractType,
          mockTokenMetadata.isVerified,
          mockTokenMetadata.lastUpdated,
          mockTokenMetadata.createdAt,
          mockTokenMetadata.updatedAt,
        ),
        lpToken: mockLpToken,
      };

      getTokenMetadataUseCase.getTokenPairInfo.mockResolvedValue(mockPairInfo);

      const query = {
        token0Address: validTokenAddress,
        token1Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        chain: 'base',
      };

      const result = await controller.getTokenPairInfo(query);

      expect(getTokenMetadataUseCase.getTokenPairInfo).toHaveBeenCalledWith(
        validTokenAddress,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'base',
      );

      expect(result.token0?.symbol).toBe('ETH');
      expect(result.token1?.symbol).toBe('USDC');
      expect(result.lpToken?.isLpToken).toBe(true);
    });

    it('should handle missing LP token', async () => {
      const mockPairInfo = {
        token0: mockTokenMetadata,
        token1: new TokenMetadataEntity(
          'mock-id-5',
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          mockTokenMetadata.chain,
          'USDC',
          'USD Coin',
          6,
          mockTokenMetadata.totalSupply,
          mockTokenMetadata.circulatingSupply,
          'usd-coin',
          mockTokenMetadata.isLpToken,
          mockTokenMetadata.token0Address,
          mockTokenMetadata.token1Address,
          mockTokenMetadata.poolAddress,
          mockTokenMetadata.dexName,
          mockTokenMetadata.logoUrl,
          mockTokenMetadata.contractType,
          mockTokenMetadata.isVerified,
          mockTokenMetadata.lastUpdated,
          mockTokenMetadata.createdAt,
          mockTokenMetadata.updatedAt,
        ),
        lpToken: null,
      };

      getTokenMetadataUseCase.getTokenPairInfo.mockResolvedValue(mockPairInfo);

      const query = {
        token0Address: validTokenAddress,
        token1Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        chain: 'base',
      };

      const result = await controller.getTokenPairInfo(query);

      expect(result.lpToken).toBe(null);
    });

    it('should throw error for invalid token0Address', async () => {
      const query = {
        token0Address: invalidTokenAddress,
        token1Address: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenPairInfo(query)).rejects.toThrow(HttpException);

      try {
        await controller.getTokenPairInfo(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_TOKEN_ADDRESS',
          message: 'Invalid token0Address format',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'token0Address',
              value: invalidTokenAddress,
            }),
          ]),
        });
      }
    });

    it('should throw error for invalid token1Address', async () => {
      const query = {
        token0Address: validTokenAddress,
        token1Address: invalidTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenPairInfo(query)).rejects.toThrow(HttpException);

      try {
        await controller.getTokenPairInfo(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_TOKEN_ADDRESS',
          message: 'Invalid token1Address format',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'token1Address',
              value: invalidTokenAddress,
            }),
          ]),
        });
      }
    });
  });

  describe('validateToken', () => {
    it('should return valid token validation result', async () => {
      const validationResult = {
        isValid: true,
        issues: [],
      };

      getTokenMetadataUseCase.validateTokenMetadata.mockResolvedValue(validationResult);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      const result = await controller.validateToken(query);

      expect(getTokenMetadataUseCase.validateTokenMetadata).toHaveBeenCalledWith(
        validTokenAddress,
        'base',
      );

      expect(result).toEqual({
        isValid: true,
        issues: [],
        tokenAddress: validTokenAddress,
        chain: 'base',
      });
    });

    it('should return validation issues', async () => {
      const validationResult = {
        isValid: false,
        issues: [
          'Missing CoinGecko ID',
          'Token not verified',
        ],
      };

      getTokenMetadataUseCase.validateTokenMetadata.mockResolvedValue(validationResult);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      const result = await controller.validateToken(query);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(2);
    });

    it('should throw error for invalid token address', async () => {
      const query = {
        tokenAddress: invalidTokenAddress,
        chain: 'base',
      };

      await expect(controller.validateToken(query)).rejects.toThrow(HttpException);
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.invalidWalletAddress(validTokenAddress);
      getTokenMetadataUseCase.validateTokenMetadata.mockRejectedValue(apiError);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.validateToken(query)).rejects.toThrow(HttpException);
    });
  });

  describe('getTokenByPoolAddress', () => {
    it('should return LP token for pool address', async () => {
      getTokenMetadataUseCase.getTokensByPoolAddress.mockResolvedValue({
        token: mockLpToken,
        cached: false,
      });

      const poolAddress = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc';
      const chain = 'base';

      const result = await controller.getTokenByPoolAddress(poolAddress, chain);

      expect(getTokenMetadataUseCase.getTokensByPoolAddress).toHaveBeenCalledWith(
        poolAddress,
        chain,
      );

      expect(result.token).toMatchObject({
        isLpToken: true,
        poolAddress,
      });
    });

    it('should throw error for invalid pool address', async () => {
      const poolAddress = invalidTokenAddress;
      const chain = 'base';

      await expect(
        controller.getTokenByPoolAddress(poolAddress, chain),
      ).rejects.toThrow(HttpException);

      try {
        await controller.getTokenByPoolAddress(poolAddress, chain);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_POOL_ADDRESS',
          message: 'Invalid pool address format',
        });
      }
    });

    it('should throw error for missing chain', async () => {
      const poolAddress = validTokenAddress;
      const chain = '';

      await expect(
        controller.getTokenByPoolAddress(poolAddress, chain),
      ).rejects.toThrow(HttpException);

      try {
        await controller.getTokenByPoolAddress(poolAddress, chain);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_CHAIN',
          message: 'Valid chain parameter is required',
        });
      }
    });

    it('should throw error for invalid chain', async () => {
      const poolAddress = validTokenAddress;
      const chain = 'invalid-chain';

      await expect(
        controller.getTokenByPoolAddress(poolAddress, chain),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error when LP token not found', async () => {
      getTokenMetadataUseCase.getTokensByPoolAddress.mockResolvedValue({
        token: null,
        cached: false,
      });

      const poolAddress = validTokenAddress;
      const chain = 'base';

      await expect(
        controller.getTokenByPoolAddress(poolAddress, chain),
      ).rejects.toThrow(HttpException);

      try {
        await controller.getTokenByPoolAddress(poolAddress, chain);
      } catch (error: any) {
        expect(error.getStatus()).toBe(404);
        expect(error.getResponse()).toMatchObject({
          statusCode: 404,
          error: 'LP_TOKEN_NOT_FOUND',
          message: `No LP token found for pool ${poolAddress} on ${chain}`,
        });
      }
    });
  });

  describe('isValidAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      const validAddresses = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        '0x0000000000000000000000000000000000000000',
      ];

      validAddresses.forEach((address) => {
        const isValid = (controller as any).isValidAddress(address);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid Ethereum addresses', () => {
      const invalidAddresses = [
        'invalid',
        '0x123',
        '1234567890abcdef1234567890abcdef12345678',
        '0x1234567890abcdef1234567890abcdef12345678x',
        '0xgggggggggggggggggggggggggggggggggggggggg',
        '0x1234567890abcdef1234567890abcdef123456',
      ];

      invalidAddresses.forEach((address) => {
        const isValid = (controller as any).isValidAddress(address);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('mapTokenMetadata', () => {
    it('should correctly map token entity to DTO', () => {
      const mapped = (controller as any).mapTokenMetadata(mockTokenMetadata);

      expect(mapped).toEqual({
        address: validTokenAddress,
        chain: 'base',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        coingeckoId: 'ethereum',
        isLpToken: false,
        token0Address: null,
        token1Address: null,
        poolAddress: null,
        dex: null,
        isVerified: true,
        lastUpdated: '2024-01-15T12:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should correctly map LP token entity to DTO', () => {
      const mapped = (controller as any).mapTokenMetadata(mockLpToken);

      expect(mapped).toMatchObject({
        isLpToken: true,
        token0Address: validTokenAddress,
        token1Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        poolAddress: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
        dex: 'uniswap-v2',
      });
    });
  });
});