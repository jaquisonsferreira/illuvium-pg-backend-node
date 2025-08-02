import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { PricesController } from './prices.controller';
import { GetTokenPriceUseCase } from '../../application/use-cases/get-token-price.use-case';
import { ApiError } from '../dto';

describe('PricesController', () => {
  let controller: PricesController;
  let getTokenPriceUseCase: jest.Mocked<GetTokenPriceUseCase>;

  const validTokenAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const invalidTokenAddress = 'invalid_address';

  const mockTokenPrice = {
    tokenAddress: validTokenAddress,
    chain: 'base',
    symbol: 'ETH',
    priceUsd: 3000,
    priceChange24h: 2.5,
    marketCap: 350000000000,
    volume24h: 15000000000,
    timestamp: new Date('2024-01-15T12:00:00Z'),
    source: 'coingecko',
    isCached: false,
    cacheAgeMinutes: 0,
  };

  const mockHistoricalPriceData = {
    timestamp: new Date('2024-01-15T12:00:00Z'),
    priceUsd: 3000,
    priceChange24h: 2.5,
    marketCap: 350000000000,
    volume24h: 15000000000,
  };

  const mockHistoricalData = {
    tokenAddress: validTokenAddress,
    chain: 'base',
    symbol: 'ETH',
    prices: [mockHistoricalPriceData],
    averagePrice: 2950,
    highPrice: 3100,
    lowPrice: 2800,
    priceChange: 7.14,
    granularity: 'hour',
  };

  beforeEach(async () => {
    const mockGetTokenPriceUseCase = {
      execute: jest.fn(),
      getHistoricalPrices: jest.fn(),
      getMultipleTokenPrices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricesController],
      providers: [
        {
          provide: GetTokenPriceUseCase,
          useValue: mockGetTokenPriceUseCase,
        },
      ],
    }).compile();

    controller = module.get<PricesController>(PricesController);
    getTokenPriceUseCase = module.get(GetTokenPriceUseCase);
  });

  describe('getTokenPrice', () => {
    it('should return token price for valid address', async () => {
      getTokenPriceUseCase.execute.mockResolvedValue(mockTokenPrice);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        useCache: true,
      };

      const result = await controller.getTokenPrice(query);

      expect(getTokenPriceUseCase.execute).toHaveBeenCalledWith({
        tokenAddress: validTokenAddress,
        chain: 'base',
        date: undefined,
        useCache: true,
        maxCacheAgeMinutes: undefined,
      });

      expect(result).toEqual({
        tokenAddress: validTokenAddress,
        chain: 'base',
        symbol: 'ETH',
        priceUsd: 3000,
        priceChange24h: 2.5,
        marketCap: 350000000000,
        volume24h: 15000000000,
        timestamp: '2024-01-15T12:00:00.000Z',
        source: 'coingecko',
        isCached: false,
        cacheAgeMinutes: 0,
      });
    });

    it('should handle date parameter', async () => {
      getTokenPriceUseCase.execute.mockResolvedValue(mockTokenPrice);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        date: '2024-01-15',
      };

      await controller.getTokenPrice(query);

      expect(getTokenPriceUseCase.execute).toHaveBeenCalledWith({
        tokenAddress: validTokenAddress,
        chain: 'base',
        date: new Date('2024-01-15'),
        useCache: undefined,
        maxCacheAgeMinutes: undefined,
      });
    });

    it('should handle cache parameters', async () => {
      getTokenPriceUseCase.execute.mockResolvedValue({
        ...mockTokenPrice,
        isCached: true,
        cacheAgeMinutes: 5,
      });

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        useCache: true,
        maxCacheAgeMinutes: 10,
      };

      const result = await controller.getTokenPrice(query);

      expect(getTokenPriceUseCase.execute).toHaveBeenCalledWith({
        tokenAddress: validTokenAddress,
        chain: 'base',
        date: undefined,
        useCache: true,
        maxCacheAgeMinutes: 10,
      });

      expect(result.isCached).toBe(true);
      expect(result.cacheAgeMinutes).toBe(5);
    });

    it('should throw error for invalid token address', async () => {
      const query = {
        tokenAddress: invalidTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenPrice(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getTokenPrice(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_WALLET_ADDRESS',
          message: 'The provided wallet address is invalid',
        });
      }
    });

    it('should handle token not found error', async () => {
      getTokenPriceUseCase.execute.mockRejectedValue(
        new Error('Token metadata not found'),
      );

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenPrice(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getTokenPrice(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(404);
        expect(error.getResponse()).toMatchObject({
          statusCode: 404,
          error: 'TOKEN_NOT_FOUND',
          message: `Token ${validTokenAddress} not found on base`,
        });
      }
    });

    it('should transform ApiError to HttpException', async () => {
      const apiError = ApiError.invalidWalletAddress(validTokenAddress);
      getTokenPriceUseCase.execute.mockRejectedValue(apiError);

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenPrice(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getTokenPrice(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(apiError.statusCode);
        expect(error.getResponse()).toMatchObject({
          statusCode: apiError.statusCode,
          error: apiError.errorCode,
          message: apiError.message,
        });
      }
    });

    it('should handle unexpected errors', async () => {
      getTokenPriceUseCase.execute.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
      };

      await expect(controller.getTokenPrice(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getTokenPrice(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(500);
        expect(error.getResponse()).toMatchObject({
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve token price',
        });
      }
    });
  });

  describe('getHistoricalPrices', () => {
    it('should return historical prices for valid parameters', async () => {
      getTokenPriceUseCase.getHistoricalPrices.mockResolvedValue(
        mockHistoricalData,
      );

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        granularity: 'hour' as const,
      };

      const result = await controller.getHistoricalPrices(query);

      expect(getTokenPriceUseCase.getHistoricalPrices).toHaveBeenCalledWith({
        tokenAddress: validTokenAddress,
        chain: 'base',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        granularity: 'hour' as const,
        fillMissingData: undefined,
      });

      expect(result).toEqual({
        tokenAddress: validTokenAddress,
        chain: 'base',
        symbol: 'ETH',
        prices: [
          {
            timestamp: '2024-01-15T12:00:00.000Z',
            priceUsd: 3000,
            priceChange24h: 2.5,
            marketCap: 350000000000,
            volume24h: 15000000000,
          },
        ],
        averagePrice: 2950,
        highPrice: 3100,
        lowPrice: 2800,
        priceChange: 7.14,
        granularity: 'hour' as const,
      });
    });

    it('should handle fillMissingData parameter', async () => {
      getTokenPriceUseCase.getHistoricalPrices.mockResolvedValue(
        mockHistoricalData,
      );

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        fillMissingData: true,
      };

      await controller.getHistoricalPrices(query);

      expect(getTokenPriceUseCase.getHistoricalPrices).toHaveBeenCalledWith({
        tokenAddress: validTokenAddress,
        chain: 'base',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        granularity: undefined,
        fillMissingData: true,
      });
    });

    it('should throw error for invalid token address', async () => {
      const query = {
        tokenAddress: invalidTokenAddress,
        chain: 'base',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await expect(controller.getHistoricalPrices(query)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error for invalid date range', async () => {
      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        startDate: '2024-01-31',
        endDate: '2024-01-01',
      };

      await expect(controller.getHistoricalPrices(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHistoricalPrices(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_DATE_RANGE',
          message: 'Start date must be before end date',
        });
      }
    });

    it('should handle no price data error', async () => {
      getTokenPriceUseCase.getHistoricalPrices.mockRejectedValue(
        new Error('No price data available'),
      );

      const query = {
        tokenAddress: validTokenAddress,
        chain: 'base',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await expect(controller.getHistoricalPrices(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHistoricalPrices(query);
      } catch (error: any) {
        expect(error.getStatus()).toBe(404);
        expect(error.getResponse()).toMatchObject({
          statusCode: 404,
          error: 'NO_PRICE_DATA',
          message: 'No price data available for the specified time range',
        });
      }
    });
  });

  describe('getMultiplePrices', () => {
    const mockMultiplePrices = [
      mockTokenPrice,
      {
        ...mockTokenPrice,
        tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        symbol: 'USDC',
      },
    ];

    it('should return prices for multiple tokens', async () => {
      getTokenPriceUseCase.getMultipleTokenPrices.mockResolvedValue(
        mockMultiplePrices,
      );

      const body = {
        tokens: [
          { address: validTokenAddress, chain: 'base' },
          {
            address: '0xabcdef1234567890abcdef1234567890abcdef12',
            chain: 'base',
          },
        ],
        useCache: true,
      };

      const result = await controller.getMultiplePrices(body);

      expect(getTokenPriceUseCase.getMultipleTokenPrices).toHaveBeenCalledWith(
        [
          { address: validTokenAddress, chain: 'base' },
          {
            address: '0xabcdef1234567890abcdef1234567890abcdef12',
            chain: 'base',
          },
        ],
        true,
        undefined,
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.failed).toBeUndefined();
    });

    it('should handle partial failures when use case returns fewer results', async () => {
      // Only return one price even though two valid addresses were requested
      getTokenPriceUseCase.getMultipleTokenPrices.mockResolvedValue([
        mockTokenPrice,
      ]);

      const body = {
        tokens: [
          { address: validTokenAddress, chain: 'base' },
          {
            address: '0xabcdef1234567890abcdef1234567890abcdef12',
            chain: 'base',
          },
        ],
      };

      const result = await controller.getMultiplePrices(body);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.failed).toEqual([
        '0xabcdef1234567890abcdef1234567890abcdef12',
      ]);
    });

    it('should throw error for empty tokens array', async () => {
      const body = {
        tokens: [],
      };

      await expect(controller.getMultiplePrices(body)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getMultiplePrices(body);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_REQUEST',
          message: 'At least one token is required',
        });
      }
    });

    it('should throw error for too many tokens', async () => {
      const body = {
        tokens: Array(51).fill({ address: validTokenAddress, chain: 'base' }),
      };

      await expect(controller.getMultiplePrices(body)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getMultiplePrices(body);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'TOO_MANY_TOKENS',
          message: 'Maximum 50 tokens per request',
        });
      }
    });

    it('should throw error for invalid token addresses', async () => {
      const body = {
        tokens: [
          { address: validTokenAddress, chain: 'base' },
          { address: invalidTokenAddress, chain: 'base' },
        ],
      };

      await expect(controller.getMultiplePrices(body)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getMultiplePrices(body);
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          error: 'INVALID_TOKEN_ADDRESSES',
          message: 'Some token addresses are invalid',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'address',
              value: invalidTokenAddress,
            }),
          ]),
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
});
