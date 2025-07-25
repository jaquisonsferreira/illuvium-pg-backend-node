import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  GetTokenPriceQueryDto,
  GetHistoricalPricesQueryDto,
  GetMultiplePricesDto,
  TokenPriceDto,
  HistoricalPriceResponseDto,
  MultiplePricesResponseDto,
  ErrorResponseDto,
  ApiError,
} from '../dto';
import { GetTokenPriceUseCase } from '../../application/use-cases/get-token-price.use-case';

@ApiTags('prices')
@Controller('api/prices')
export class PricesController {
  constructor(private readonly getTokenPriceUseCase: GetTokenPriceUseCase) {}

  @Get('token')
  @ApiOperation({
    summary: 'Get current token price',
    description:
      'Returns the current price for a specific token with optional caching control',
  })
  @ApiQuery({ type: GetTokenPriceQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Token price retrieved successfully',
    type: TokenPriceDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token address or parameters',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Token not found',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async getTokenPrice(
    @Query() query: GetTokenPriceQueryDto,
  ): Promise<TokenPriceDto> {
    try {
      if (!this.isValidAddress(query.tokenAddress)) {
        throw ApiError.invalidWalletAddress(query.tokenAddress);
      }

      const priceData = await this.getTokenPriceUseCase.execute({
        tokenAddress: query.tokenAddress,
        chain: query.chain,
        date: query.date ? new Date(query.date) : undefined,
        useCache: query.useCache,
        maxCacheAgeMinutes: query.maxCacheAgeMinutes,
      });

      return {
        tokenAddress: priceData.tokenAddress,
        chain: priceData.chain,
        symbol: priceData.symbol,
        priceUsd: priceData.priceUsd,
        priceChange24h: priceData.priceChange24h,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        timestamp: priceData.timestamp.toISOString(),
        source: priceData.source,
        isCached: priceData.isCached,
        cacheAgeMinutes: priceData.cacheAgeMinutes,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: '/api/prices/token',
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }

      if (
        error instanceof Error &&
        error.message.includes('Token metadata not found')
      ) {
        throw new HttpException(
          {
            statusCode: 404,
            error: 'TOKEN_NOT_FOUND',
            message: `Token ${query.tokenAddress} not found on ${query.chain}`,
            path: '/api/prices/token',
            timestamp: new Date().toISOString(),
          },
          404,
        );
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve token price',
          path: '/api/prices/token',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get('historical')
  @ApiOperation({
    summary: 'Get historical token prices',
    description:
      'Returns historical price data for a token within a specified date range',
  })
  @ApiQuery({ type: GetHistoricalPricesQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Historical prices retrieved successfully',
    type: HistoricalPriceResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters or date range',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Token not found or no data for the specified range',
    type: ErrorResponseDto,
  })
  async getHistoricalPrices(
    @Query() query: GetHistoricalPricesQueryDto,
  ): Promise<HistoricalPriceResponseDto> {
    try {
      if (!this.isValidAddress(query.tokenAddress)) {
        throw ApiError.invalidWalletAddress(query.tokenAddress);
      }

      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);

      if (startDate >= endDate) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_DATE_RANGE',
            message: 'Start date must be before end date',
            details: [
              {
                field: 'startDate',
                message: 'Must be before endDate',
                value: query.startDate,
              },
            ],
            path: '/api/prices/historical',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const historicalData =
        await this.getTokenPriceUseCase.getHistoricalPrices({
          tokenAddress: query.tokenAddress,
          chain: query.chain,
          startDate,
          endDate,
          granularity: query.granularity,
          fillMissingData: query.fillMissingData,
        });

      return {
        tokenAddress: historicalData.tokenAddress,
        chain: historicalData.chain,
        symbol: historicalData.symbol,
        prices: historicalData.prices.map((p) => ({
          timestamp: p.timestamp.toISOString(),
          priceUsd: p.priceUsd,
          priceChange24h: p.priceChange24h,
          marketCap: p.marketCap,
          volume24h: p.volume24h,
        })),
        averagePrice: historicalData.averagePrice,
        highPrice: historicalData.highPrice,
        lowPrice: historicalData.lowPrice,
        priceChange: historicalData.priceChange,
        granularity: historicalData.granularity,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message.includes('Token metadata not found')
      ) {
        throw new HttpException(
          {
            statusCode: 404,
            error: 'TOKEN_NOT_FOUND',
            message: `Token ${query.tokenAddress} not found on ${query.chain}`,
            path: '/api/prices/historical',
            timestamp: new Date().toISOString(),
          },
          404,
        );
      }

      if (
        error instanceof Error &&
        error.message.includes('No price data available')
      ) {
        throw new HttpException(
          {
            statusCode: 404,
            error: 'NO_PRICE_DATA',
            message: 'No price data available for the specified time range',
            path: '/api/prices/historical',
            timestamp: new Date().toISOString(),
          },
          404,
        );
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve historical prices',
          path: '/api/prices/historical',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Post('batch')
  @ApiOperation({
    summary: 'Get prices for multiple tokens',
    description:
      'Returns current prices for multiple tokens in a single request',
  })
  @ApiBody({ type: GetMultiplePricesDto })
  @ApiResponse({
    status: 200,
    description: 'Token prices retrieved successfully',
    type: MultiplePricesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body',
    type: ErrorResponseDto,
  })
  async getMultiplePrices(
    @Body() body: GetMultiplePricesDto,
  ): Promise<MultiplePricesResponseDto> {
    try {
      if (body.tokens.length === 0) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_REQUEST',
            message: 'At least one token is required',
            path: '/api/prices/batch',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      if (body.tokens.length > 50) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'TOO_MANY_TOKENS',
            message: 'Maximum 50 tokens per request',
            path: '/api/prices/batch',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const invalidTokens = body.tokens.filter(
        (t) => !this.isValidAddress(t.address),
      );
      if (invalidTokens.length > 0) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_TOKEN_ADDRESSES',
            message: 'Some token addresses are invalid',
            details: invalidTokens.map((t) => ({
              field: 'address',
              message: 'Invalid token address format',
              value: t.address,
            })),
            path: '/api/prices/batch',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const priceResults =
        await this.getTokenPriceUseCase.getMultipleTokenPrices(
          body.tokens.map((t) => ({ address: t.address, chain: t.chain })),
          body.useCache,
          body.maxCacheAgeMinutes,
        );

      const successfulPrices = priceResults.map((p) => ({
        tokenAddress: p.tokenAddress,
        chain: p.chain,
        symbol: p.symbol,
        priceUsd: p.priceUsd,
        priceChange24h: p.priceChange24h,
        marketCap: p.marketCap,
        volume24h: p.volume24h,
        timestamp: p.timestamp.toISOString(),
        source: p.source,
        isCached: p.isCached,
        cacheAgeMinutes: p.cacheAgeMinutes,
      }));

      const requestedAddresses = body.tokens.map((t) =>
        t.address.toLowerCase(),
      );
      const returnedAddresses = priceResults.map((p) =>
        p.tokenAddress.toLowerCase(),
      );
      const failedAddresses = requestedAddresses.filter(
        (addr) => !returnedAddresses.includes(addr),
      );

      return {
        data: successfulPrices,
        total: successfulPrices.length,
        failed: failedAddresses.length > 0 ? failedAddresses : undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve token prices',
          path: '/api/prices/batch',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
