import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { formatUnits } from 'ethers';
import { CacheService } from '@shared/services/cache.service';
import { TokenPrice, ChainType } from '../../domain/types/staking-types';

interface GetStakingStatsParams {
  timeframe: string;
}

export interface StakingStatsResponse {
  season_id: number;
  chain: string;
  tvl: string;
  tvl_raw: string;
  volume_24h: string;
  volume_7d?: string;
  active_vaults: number;
  last_updated: string;
}

@Injectable()
export class GetStakingStatsUseCase {
  private readonly logger = new Logger(GetStakingStatsUseCase.name);

  constructor(
    private readonly vaultConfigService: VaultConfigService,
    @Inject('IStakingSubgraphRepository')
    private readonly subgraphRepository: IStakingSubgraphRepository,
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
    @Inject(CacheService)
    private readonly cacheService: CacheService,
  ) {}

  async execute(params: GetStakingStatsParams): Promise<StakingStatsResponse> {
    try {
      const cacheKey = `staking:stats:${params.timeframe}`;
      const cached =
        await this.cacheService.get<StakingStatsResponse>(cacheKey);
      if (cached) return cached;

      const currentSeason = this.vaultConfigService.getCurrentSeason();
      if (!currentSeason) {
        throw new Error('No active season found');
      }

      const activeVaults = this.vaultConfigService.getActiveVaults();

      const [tvlData, volume24h, volume7d] = await Promise.all([
        this.calculateTotalTVL(currentSeason.primaryChain, activeVaults),
        this.subgraphRepository.getVolume24h(currentSeason.primaryChain),
        params.timeframe === '7d'
          ? this.subgraphRepository.getVolume7d(currentSeason.primaryChain)
          : Promise.resolve(0),
      ]);

      const stats: StakingStatsResponse = {
        season_id: currentSeason.seasonNumber,
        chain: currentSeason.primaryChain,
        tvl: this.formatLargeNumber(tvlData),
        tvl_raw: tvlData.toFixed(2),
        volume_24h: this.formatLargeNumber(volume24h),
        active_vaults: activeVaults.length,
        last_updated: new Date().toISOString(),
      };

      if (params.timeframe === '7d') {
        stats.volume_7d = this.formatLargeNumber(volume7d);
      }

      await this.cacheService.set(cacheKey, stats, 300); // 5 minutes cache
      return stats;
    } catch (error) {
      this.logger.error('Error fetching staking stats:', error);
      throw error;
    }
  }

  private async calculateTotalTVL(
    chain: ChainType,
    vaults: any[],
  ): Promise<number> {
    const vaultTvlData = await this.subgraphRepository.getVaultsTVL(
      chain,
      vaults.map((v) => v.address),
    );

    const tokenAddresses = vaults
      .map((v) =>
        v.tokenConfig.isLP
          ? [v.tokenConfig.token0, v.tokenConfig.token1]
          : [v.asset],
      )
      .flat()
      .filter((addr, index, self) => self.indexOf(addr) === index);

    const tokenPrices = await this.priceFeedRepository.getMultipleTokenPrices(
      tokenAddresses,
      chain,
    );

    let totalTvl = 0;

    for (const vault of vaults) {
      const tvlData = vaultTvlData[vault.address.toLowerCase()] || {
        totalAssets: '0',
      };

      if (vault.tokenConfig.isLP) {
        const lpPrice = await this.calculateLPTokenPrice(
          vault,
          tokenPrices,
          chain,
        );
        const totalAssetsFormatted = parseFloat(
          formatUnits(tvlData.totalAssets, vault.tokenConfig.decimals),
        );
        totalTvl += totalAssetsFormatted * lpPrice;
      } else {
        const tokenPrice =
          tokenPrices.find(
            (p) => p.tokenAddress.toLowerCase() === vault.asset.toLowerCase(),
          )?.priceUsd || 0;
        const totalAssetsFormatted = parseFloat(
          formatUnits(tvlData.totalAssets, vault.tokenConfig.decimals),
        );
        totalTvl += totalAssetsFormatted * tokenPrice;
      }
    }

    return totalTvl;
  }

  private async calculateLPTokenPrice(
    vault: any,
    tokenPrices: TokenPrice[],
    chain: ChainType,
  ): Promise<number> {
    try {
      const lpData = await this.subgraphRepository.getLPTokenData(
        chain,
        vault.asset,
      );
      if (!lpData || !lpData.data) return 0;

      const token0Price =
        tokenPrices.find(
          (p) =>
            p.tokenAddress.toLowerCase() ===
            vault.tokenConfig.token0.toLowerCase(),
        )?.priceUsd || 0;
      const token1Price =
        tokenPrices.find(
          (p) =>
            p.tokenAddress.toLowerCase() ===
            vault.tokenConfig.token1.toLowerCase(),
        )?.priceUsd || 0;

      const reserve0 = parseFloat(formatUnits(lpData.data.reserve0, 18));
      const reserve1 = parseFloat(formatUnits(lpData.data.reserve1, 18));
      const totalSupply = parseFloat(formatUnits(lpData.data.totalSupply, 18));

      if (totalSupply === 0) return 0;

      const totalValue = reserve0 * token0Price + reserve1 * token1Price;
      return totalValue / totalSupply;
    } catch (error) {
      this.logger.error('Error calculating LP token price:', error);
      return 0;
    }
  }

  private formatLargeNumber(value: number): string {
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
  }
}
