import { Injectable, Logger, Inject } from '@nestjs/common';
import { IStakingBlockchainRepository } from '../../domain/types/staking-types';
import { formatUnits, parseUnits } from 'ethers';

interface TokenDecimalCache {
  decimals: number;
  cachedAt: Date;
  ttl: number;
}

@Injectable()
export class TokenDecimalsService {
  private readonly logger = new Logger(TokenDecimalsService.name);
  private readonly cache = new Map<string, TokenDecimalCache>();
  private readonly DEFAULT_DECIMALS = 18;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  private readonly KNOWN_DECIMALS: Record<string, number> = {
    '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E': 18, // ILV
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': 6, // USDC on Base
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 8, // WBTC
    '0x4200000000000000000000000000000000000006': 18, // WETH on Base
  };

  constructor(
    @Inject('IStakingBlockchainRepository')
    private readonly blockchainRepository: IStakingBlockchainRepository,
  ) {}

  async getDecimals(tokenAddress: string, chain: string): Promise<number> {
    const cacheKey = `${chain}:${tokenAddress.toLowerCase()}`;

    const cached = this.getCachedDecimals(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const knownDecimals = this.KNOWN_DECIMALS[tokenAddress];
    if (knownDecimals !== undefined) {
      this.setCachedDecimals(cacheKey, knownDecimals);
      return knownDecimals;
    }

    try {
      const tokenMetadata = await this.blockchainRepository.getTokenMetadata(
        tokenAddress,
        chain as any,
      );
      const decimals = tokenMetadata.decimals;

      this.setCachedDecimals(cacheKey, decimals);
      return decimals;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch decimals for token ${tokenAddress} on ${chain}, using default: ${this.DEFAULT_DECIMALS}`,
        error,
      );
      return this.DEFAULT_DECIMALS;
    }
  }

  async getBatchDecimals(
    tokenAddresses: string[],
    chain: string,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    const promises = tokenAddresses.map(async (address) => {
      const decimals = await this.getDecimals(address, chain);
      result.set(address.toLowerCase(), decimals);
    });

    await Promise.all(promises);
    return result;
  }

  formatTokenAmount(rawAmount: string, decimals: number): string {
    try {
      return formatUnits(rawAmount, decimals);
    } catch (error) {
      this.logger.error(
        `Failed to format amount ${rawAmount} with decimals ${decimals}`,
        error,
      );
      return '0';
    }
  }

  parseTokenAmount(formattedAmount: string, decimals: number): string {
    try {
      return parseUnits(formattedAmount, decimals).toString();
    } catch (error) {
      this.logger.error(
        `Failed to parse amount ${formattedAmount} with decimals ${decimals}`,
        error,
      );
      return '0';
    }
  }

  formatWithFixedDecimals(
    rawAmount: string,
    decimals: number,
    displayDecimals: number = 2,
  ): string {
    try {
      const formatted = this.formatTokenAmount(rawAmount, decimals);
      const [whole, fraction = ''] = formatted.split('.');
      const truncatedFraction = fraction
        .slice(0, displayDecimals)
        .padEnd(displayDecimals, '0');
      return `${whole}.${truncatedFraction}`;
    } catch (error) {
      this.logger.error(`Failed to format with fixed decimals`, error);
      return '0.00';
    }
  }

  addKnownToken(tokenAddress: string, decimals: number): void {
    this.KNOWN_DECIMALS[tokenAddress] = decimals;
    const cacheKey = `*:${tokenAddress.toLowerCase()}`;
    this.setCachedDecimals(cacheKey, decimals);
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.log('Token decimals cache cleared');
  }

  getCacheStats(): { size: number; tokens: string[] } {
    return {
      size: this.cache.size,
      tokens: Array.from(this.cache.keys()),
    };
  }

  private getCachedDecimals(cacheKey: string): number | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const now = new Date().getTime();
    const cachedTime = cached.cachedAt.getTime();

    if (now - cachedTime > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.decimals;
  }

  private setCachedDecimals(cacheKey: string, decimals: number): void {
    this.cache.set(cacheKey, {
      decimals,
      cachedAt: new Date(),
      ttl: this.CACHE_TTL_MS,
    });
  }
}
