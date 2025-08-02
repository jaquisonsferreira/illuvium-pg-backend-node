import { Injectable, Logger, Inject } from '@nestjs/common';
import { ITokenMetadataRepository } from '../../domain/repositories/token-metadata.repository.interface';
import { TokenMetadataEntity } from '../../domain/entities/token-metadata.entity';
import { CacheTokenMetadataUseCase } from './cache-token-metadata.use-case';

interface GetTokenMetadataDto {
  tokenAddress?: string;
  chain?: string;
  symbol?: string;
  coingeckoId?: string;
  autoCache?: boolean;
}

interface TokenMetadataResult {
  token: TokenMetadataEntity | null;
  cached: boolean;
  error?: string;
}

interface MultipleTokensResult {
  tokens: TokenMetadataEntity[];
  total: number;
}

@Injectable()
export class GetTokenMetadataUseCase {
  private readonly logger = new Logger(GetTokenMetadataUseCase.name);

  constructor(
    @Inject('ITokenMetadataRepository')
    private readonly tokenMetadataRepository: ITokenMetadataRepository,
    private readonly cacheTokenMetadataUseCase: CacheTokenMetadataUseCase,
  ) {}

  async execute(dto: GetTokenMetadataDto): Promise<TokenMetadataResult> {
    const { tokenAddress, chain, symbol, coingeckoId, autoCache = true } = dto;

    try {
      if (tokenAddress && chain) {
        return await this.getByAddress(tokenAddress, chain, autoCache);
      }

      if (coingeckoId) {
        return await this.getByCoingeckoId(coingeckoId);
      }

      if (symbol) {
        return await this.getBySymbol(symbol, chain);
      }

      return {
        token: null,
        cached: false,
        error: 'At least one search parameter is required',
      };
    } catch (error) {
      this.logger.error(
        'Error retrieving token metadata:',
        error instanceof Error ? error.stack : error,
      );
      return {
        token: null,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getByAddress(
    tokenAddress: string,
    chain: string,
    autoCache: boolean,
  ): Promise<TokenMetadataResult> {
    const normalizedAddress = tokenAddress.toLowerCase();

    const token = await this.tokenMetadataRepository.findByAddress(
      normalizedAddress,
      chain,
    );

    if (!token && autoCache) {
      this.logger.log(
        `Token not found in database, attempting to cache: ${normalizedAddress} on ${chain}`,
      );

      const cacheResult = await this.cacheTokenMetadataUseCase.execute({
        tokenAddress: normalizedAddress,
        chain,
      });

      if (cacheResult.success && cacheResult.tokenMetadata) {
        return {
          token: cacheResult.tokenMetadata,
          cached: false,
        };
      }

      return {
        token: null,
        cached: false,
        error: cacheResult.error || 'Failed to cache token metadata',
      };
    }

    return {
      token,
      cached: true,
    };
  }

  private async getByCoingeckoId(
    coingeckoId: string,
  ): Promise<TokenMetadataResult> {
    const token =
      await this.tokenMetadataRepository.findByCoingeckoId(coingeckoId);

    return {
      token,
      cached: true,
    };
  }

  private async getBySymbol(
    symbol: string,
    chain?: string,
  ): Promise<TokenMetadataResult> {
    const tokens = await this.tokenMetadataRepository.findBySymbol(
      symbol,
      chain,
    );

    if (tokens.length === 0) {
      return {
        token: null,
        cached: true,
        error: 'No tokens found with the specified symbol',
      };
    }

    if (tokens.length === 1) {
      return {
        token: tokens[0],
        cached: true,
      };
    }

    const verifiedTokens = tokens.filter((t) => t.isVerified);
    if (verifiedTokens.length > 0) {
      return {
        token: verifiedTokens[0],
        cached: true,
      };
    }

    return {
      token: tokens[0],
      cached: true,
    };
  }

  async getLpTokens(chain?: string): Promise<MultipleTokensResult> {
    const tokens = await this.tokenMetadataRepository.findLpTokens(chain);

    return {
      tokens,
      total: tokens.length,
    };
  }

  async searchTokens(
    query: string,
    limit: number = 20,
  ): Promise<MultipleTokensResult> {
    const tokens = await this.tokenMetadataRepository.searchTokens(
      query,
      limit,
    );

    return {
      tokens,
      total: tokens.length,
    };
  }

  async getTokensByPoolAddress(
    poolAddress: string,
    chain: string,
  ): Promise<TokenMetadataResult> {
    const normalizedAddress = poolAddress.toLowerCase();

    const token = await this.tokenMetadataRepository.findByPoolAddress(
      normalizedAddress,
      chain,
    );

    return {
      token,
      cached: true,
    };
  }

  async getTokenPairInfo(
    token0Address: string,
    token1Address: string,
    chain: string,
  ): Promise<{
    token0: TokenMetadataEntity | null;
    token1: TokenMetadataEntity | null;
    lpToken: TokenMetadataEntity | null;
  }> {
    const [token0Result, token1Result] = await Promise.all([
      this.execute({ tokenAddress: token0Address, chain }),
      this.execute({ tokenAddress: token1Address, chain }),
    ]);

    const lpTokens = await this.tokenMetadataRepository.findLpTokens(chain);
    const lpToken = lpTokens.find(
      (lp) =>
        lp.token0Address === token0Address.toLowerCase() &&
        lp.token1Address === token1Address.toLowerCase(),
    );

    return {
      token0: token0Result.token,
      token1: token1Result.token,
      lpToken: lpToken || null,
    };
  }

  async validateTokenMetadata(
    tokenAddress: string,
    chain: string,
  ): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const result = await this.execute({ tokenAddress, chain });
    const issues: string[] = [];

    if (!result.token) {
      return {
        isValid: false,
        issues: ['Token not found'],
      };
    }

    const token = result.token;

    if (!token.name || token.name.length === 0) {
      issues.push('Missing token name');
    }

    if (!token.symbol || token.symbol.length === 0) {
      issues.push('Missing token symbol');
    }

    if (token.decimals < 0 || token.decimals > 18) {
      issues.push('Invalid decimals value');
    }

    if (!token.isVerified) {
      issues.push('Contract not verified on block explorer');
    }

    if (token.isStale(30)) {
      issues.push('Token metadata is stale (not updated in 30 days)');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
