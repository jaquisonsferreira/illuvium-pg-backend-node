import { Controller, Get, Query, Param, HttpException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  GetTokenMetadataQueryDto,
  SearchTokensQueryDto,
  GetLpTokensQueryDto,
  GetTokenPairQueryDto,
  ValidateTokenQueryDto,
  TokenMetadataDto,
  TokenMetadataResponseDto,
  TokenSearchResultDto,
  LpTokensResponseDto,
  TokenPairInfoDto,
  TokenValidationResultDto,
  ErrorResponseDto,
  ApiError,
} from '../dto';
import { GetTokenMetadataUseCase } from '../../application/use-cases/get-token-metadata.use-case';

@ApiTags('tokens')
@Controller('tokens')
export class TokensController {
  constructor(
    private readonly getTokenMetadataUseCase: GetTokenMetadataUseCase,
  ) {}

  @Get('metadata')
  @ApiOperation({
    summary: 'Get token metadata',
    description:
      'Returns metadata for a token by address, symbol, or CoinGecko ID',
  })
  @ApiQuery({ type: GetTokenMetadataQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Token metadata retrieved successfully',
    type: TokenMetadataResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Token not found',
    type: ErrorResponseDto,
  })
  async getTokenMetadata(
    @Query() query: GetTokenMetadataQueryDto,
  ): Promise<TokenMetadataResponseDto> {
    try {
      if (!query.tokenAddress && !query.symbol && !query.coingeckoId) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'MISSING_PARAMETERS',
            message:
              'At least one search parameter is required (tokenAddress, symbol, or coingeckoId)',
            path: '/api/tokens/metadata',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      if (query.tokenAddress && !this.isValidAddress(query.tokenAddress)) {
        throw ApiError.invalidWalletAddress(query.tokenAddress);
      }

      const result = await this.getTokenMetadataUseCase.execute(query);

      if (!result.token && result.error) {
        throw new HttpException(
          {
            statusCode: 404,
            error: 'TOKEN_NOT_FOUND',
            message: result.error,
            path: '/api/tokens/metadata',
            timestamp: new Date().toISOString(),
          },
          404,
        );
      }

      return {
        token: result.token ? this.mapTokenMetadata(result.token) : null,
        cached: result.cached,
        error: result.error,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: '/api/tokens/metadata',
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve token metadata',
          path: '/api/tokens/metadata',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search tokens',
    description: 'Search for tokens by name, symbol, or address',
  })
  @ApiQuery({ type: SearchTokensQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: TokenSearchResultDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid search parameters',
    type: ErrorResponseDto,
  })
  async searchTokens(
    @Query() query: SearchTokensQueryDto,
  ): Promise<TokenSearchResultDto> {
    try {
      if (!query.query || query.query.trim().length < 2) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_SEARCH_QUERY',
            message: 'Search query must be at least 2 characters long',
            path: '/api/tokens/search',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const result = await this.getTokenMetadataUseCase.searchTokens(
        query.query,
        query.limit,
      );

      const filteredTokens = query.chain
        ? result.tokens.filter((token) => token.chain === query.chain)
        : result.tokens;

      return {
        tokens: filteredTokens.map((token) => this.mapTokenMetadata(token)),
        total: filteredTokens.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search tokens',
          path: '/api/tokens/search',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get('lp-tokens')
  @ApiOperation({
    summary: 'Get LP tokens',
    description: 'Returns a paginated list of LP (liquidity provider) tokens',
  })
  @ApiQuery({ type: GetLpTokensQueryDto })
  @ApiResponse({
    status: 200,
    description: 'LP tokens retrieved successfully',
    type: LpTokensResponseDto,
  })
  async getLpTokens(
    @Query() query: GetLpTokensQueryDto,
  ): Promise<LpTokensResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      const result = await this.getTokenMetadataUseCase.getLpTokens(
        query.chain,
      );

      const paginatedTokens = result.tokens.slice(offset, offset + limit);

      return {
        data: paginatedTokens.map((token) => this.mapTokenMetadata(token)),
        pagination: {
          page,
          limit,
          totalItems: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch {
      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve LP tokens',
          path: '/api/tokens/lp-tokens',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get('pair-info')
  @ApiOperation({
    summary: 'Get token pair information',
    description:
      'Returns metadata for a token pair and their LP token if available',
  })
  @ApiQuery({ type: GetTokenPairQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Token pair information retrieved successfully',
    type: TokenPairInfoDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token addresses',
    type: ErrorResponseDto,
  })
  async getTokenPairInfo(
    @Query() query: GetTokenPairQueryDto,
  ): Promise<TokenPairInfoDto> {
    try {
      if (!this.isValidAddress(query.token0Address)) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_TOKEN_ADDRESS',
            message: 'Invalid token0Address format',
            details: [
              {
                field: 'token0Address',
                message: 'Must be a valid Ethereum address',
                value: query.token0Address,
              },
            ],
            path: '/api/tokens/pair-info',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      if (!this.isValidAddress(query.token1Address)) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_TOKEN_ADDRESS',
            message: 'Invalid token1Address format',
            details: [
              {
                field: 'token1Address',
                message: 'Must be a valid Ethereum address',
                value: query.token1Address,
              },
            ],
            path: '/api/tokens/pair-info',
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const pairInfo = await this.getTokenMetadataUseCase.getTokenPairInfo(
        query.token0Address,
        query.token1Address,
        query.chain,
      );

      return {
        token0: pairInfo.token0 ? this.mapTokenMetadata(pairInfo.token0) : null,
        token1: pairInfo.token1 ? this.mapTokenMetadata(pairInfo.token1) : null,
        lpToken: pairInfo.lpToken
          ? this.mapTokenMetadata(pairInfo.lpToken)
          : null,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve token pair information',
          path: '/api/tokens/pair-info',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get('validate')
  @ApiOperation({
    summary: 'Validate token metadata',
    description: 'Validates token metadata and returns any issues found',
  })
  @ApiQuery({ type: ValidateTokenQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Validation completed',
    type: TokenValidationResultDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token address',
    type: ErrorResponseDto,
  })
  async validateToken(
    @Query() query: ValidateTokenQueryDto,
  ): Promise<TokenValidationResultDto> {
    try {
      if (!this.isValidAddress(query.tokenAddress)) {
        throw ApiError.invalidWalletAddress(query.tokenAddress);
      }

      const validationResult =
        await this.getTokenMetadataUseCase.validateTokenMetadata(
          query.tokenAddress,
          query.chain,
        );

      return {
        isValid: validationResult.isValid,
        issues: validationResult.issues,
        tokenAddress: query.tokenAddress,
        chain: query.chain,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            details: error.details,
            path: '/api/tokens/validate',
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate token',
          path: '/api/tokens/validate',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get('pool/:poolAddress')
  @ApiOperation({
    summary: 'Get token by pool address',
    description: 'Returns LP token metadata associated with a pool address',
  })
  @ApiParam({
    name: 'poolAddress',
    description: 'Pool contract address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiQuery({
    name: 'chain',
    description: 'Blockchain chain',
    enum: ['ethereum', 'base', 'arbitrum', 'polygon'],
    example: 'base',
  })
  @ApiResponse({
    status: 200,
    description: 'Token metadata retrieved successfully',
    type: TokenMetadataResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No LP token found for the pool address',
    type: ErrorResponseDto,
  })
  async getTokenByPoolAddress(
    @Param('poolAddress') poolAddress: string,
    @Query('chain') chain: string,
  ): Promise<TokenMetadataResponseDto> {
    try {
      if (!this.isValidAddress(poolAddress)) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_POOL_ADDRESS',
            message: 'Invalid pool address format',
            path: `/api/tokens/pool/${poolAddress}`,
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      if (
        !chain ||
        !['ethereum', 'base', 'arbitrum', 'polygon'].includes(chain)
      ) {
        throw new HttpException(
          {
            statusCode: 400,
            error: 'INVALID_CHAIN',
            message: 'Valid chain parameter is required',
            path: `/api/tokens/pool/${poolAddress}`,
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const result = await this.getTokenMetadataUseCase.getTokensByPoolAddress(
        poolAddress,
        chain,
      );

      if (!result.token) {
        throw new HttpException(
          {
            statusCode: 404,
            error: 'LP_TOKEN_NOT_FOUND',
            message: `No LP token found for pool ${poolAddress} on ${chain}`,
            path: `/api/tokens/pool/${poolAddress}`,
            timestamp: new Date().toISOString(),
          },
          404,
        );
      }

      return {
        token: this.mapTokenMetadata(result.token),
        cached: result.cached,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve token by pool address',
          path: `/api/tokens/pool/${poolAddress}`,
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private mapTokenMetadata(entity: any): TokenMetadataDto {
    return {
      address: entity.tokenAddress,
      chain: entity.chain,
      symbol: entity.symbol,
      name: entity.name,
      decimals: entity.decimals,
      coingeckoId: entity.coingeckoId,
      isLpToken: entity.isLpToken,
      token0Address: entity.token0Address,
      token1Address: entity.token1Address,
      poolAddress: entity.poolAddress,
      dex: entity.dexName,
      isVerified: entity.isVerified,
      lastUpdated: entity.updatedAt.toISOString(),
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
