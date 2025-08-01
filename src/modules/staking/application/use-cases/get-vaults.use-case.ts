import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import {
  GetVaultsQueryDto,
  VaultStatus,
  VaultSortBy,
  SortOrder,
} from '../../interface/dto/get-vaults-query.dto';
import {
  VaultListResponseDto,
  VaultListItemDto,
} from '../../interface/dto/vault-list-response.dto';
import { ChainType } from '../../domain/types/staking-types';
import { formatUnits } from 'ethers';
import { TokenPrice } from '../../domain/types/staking-types';

@Injectable()
export class GetVaultsUseCase {
  private readonly logger = new Logger(GetVaultsUseCase.name);

  constructor(
    private readonly vaultConfigService: VaultConfigService,
    @Inject('IStakingSubgraphRepository')
    private readonly subgraphRepository: IStakingSubgraphRepository,
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
  ) {}

  async execute(query: GetVaultsQueryDto): Promise<VaultListResponseDto> {
    try {
      const currentSeason = this.vaultConfigService.getCurrentSeason();
      if (!currentSeason) {
        throw new Error('No active season found');
      }

      let vaults = this.vaultConfigService.getVaultsBySeason(
        currentSeason.seasonNumber,
      );

      if (query.status) {
        vaults = vaults.filter((vault) =>
          query.status === VaultStatus.ACTIVE
            ? vault.isActive
            : !vault.isActive,
        );
      }

      if (query.asset) {
        vaults = vaults.filter((vault) =>
          vault.tokenConfig.symbol
            .toLowerCase()
            .includes(query.asset!.toLowerCase()),
        );
      }

      if (query.search) {
        const searchLower = query.search.toLowerCase();
        vaults = vaults.filter(
          (vault) =>
            vault.name.toLowerCase().includes(searchLower) ||
            vault.tokenConfig.symbol.toLowerCase().includes(searchLower) ||
            vault.tokenConfig.name.toLowerCase().includes(searchLower),
        );
      }

      const vaultTvlData = await this.subgraphRepository.getVaultsTVL(
        currentSeason.primaryChain,
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
        currentSeason.primaryChain,
      );

      const vaultListItems: VaultListItemDto[] = await Promise.all(
        vaults.map(async (vault) => {
          const tvlData = vaultTvlData[vault.address.toLowerCase()] || {
            totalAssets: '0',
            sharePrice: 0,
          };

          let tvlUsd = 0;
          let vaultSizeFormatted = '0';

          if (vault.tokenConfig.isLP) {
            const lpPrice = await this.calculateLPTokenPrice(
              vault.tokenConfig,
              tokenPrices,
              currentSeason.primaryChain,
            );
            const totalAssetsFormatted = parseFloat(
              formatUnits(tvlData.totalAssets, vault.tokenConfig.decimals),
            );
            tvlUsd = totalAssetsFormatted * lpPrice;
            vaultSizeFormatted =
              this.formatNumber(totalAssetsFormatted, 2) +
              ' ' +
              vault.tokenConfig.symbol;
          } else {
            const tokenPrice =
              tokenPrices.find(
                (p) =>
                  p.tokenAddress.toLowerCase() === vault.asset.toLowerCase(),
              )?.priceUsd || 0;
            const totalAssetsFormatted = parseFloat(
              formatUnits(tvlData.totalAssets, vault.tokenConfig.decimals),
            );
            tvlUsd = totalAssetsFormatted * tokenPrice;
            vaultSizeFormatted =
              this.formatNumber(totalAssetsFormatted, 2) +
              ' ' +
              vault.tokenConfig.symbol;
          }

          const rewardRate = this.calculateRewardRate(vault.seasonNumber);

          return {
            vault_id: this.generateVaultId(vault),
            vault_address: vault.address,
            name: vault.tokenConfig.name,
            underlying_asset: vault.tokenConfig.name,
            underlying_asset_ticker: vault.tokenConfig.symbol,
            underlying_asset_address: vault.asset,
            token_icons: {
              primary: this.getTokenIcon(
                vault.tokenConfig.coingeckoId || vault.tokenConfig.symbol,
              ),
              secondary: vault.tokenConfig.isLP
                ? this.getTokenIcon(
                    this.getCoingeckoIdForToken(vault.tokenConfig.token1),
                  )
                : null,
            },
            chain: vault.chain,
            season_id: vault.seasonNumber,
            status: vault.isActive ? 'active' : 'deprecated',
            staking_rewards: rewardRate,
            tvl: this.formatLargeNumber(tvlUsd),
            tvl_raw: tvlUsd.toFixed(2),
            vault_size: vaultSizeFormatted,
            mechanics: {
              locked_until_mainnet:
                !this.vaultConfigService.isMainnetLaunched(),
              withdrawal_enabled: vault.withdrawalEnabled,
              redeem_delay_days: null,
              minimum_deposit: formatUnits(
                vault.minimumDeposit,
                vault.tokenConfig.decimals,
              ),
              maximum_deposit: vault.maximumDeposit
                ? formatUnits(vault.maximumDeposit, vault.tokenConfig.decimals)
                : null,
            },
          };
        }),
      );

      const sortedVaults = [...vaultListItems];
      if (query.sort_by) {
        sortedVaults.sort((a, b) => {
          let compareValue = 0;
          switch (query.sort_by) {
            case VaultSortBy.TVL:
              compareValue = parseFloat(a.tvl_raw) - parseFloat(b.tvl_raw);
              break;
            case VaultSortBy.VAULT_SIZE:
              compareValue =
                parseFloat(a.vault_size) - parseFloat(b.vault_size);
              break;
            case VaultSortBy.PARTICIPANTS:
              compareValue = 0;
              break;
          }
          return query.sort_order === SortOrder.DESC
            ? -compareValue
            : compareValue;
        });
      }

      const page = query.page || 1;
      const limit = query.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedVaults = sortedVaults.slice(startIndex, endIndex);

      const totalTvl = vaultListItems.reduce(
        (sum, vault) => sum + parseFloat(vault.tvl_raw),
        0,
      );

      const volume24h = await this.getVolume24h(currentSeason.primaryChain);

      return {
        vaults: paginatedVaults,
        pagination: {
          page,
          limit,
          total: sortedVaults.length,
          total_pages: Math.ceil(sortedVaults.length / limit),
          has_next: endIndex < sortedVaults.length,
          has_previous: page > 1,
        },
        season_summary: {
          season_id: currentSeason.seasonNumber,
          chain: currentSeason.primaryChain,
          tvl: this.formatLargeNumber(totalTvl),
          tvl_raw: totalTvl.toFixed(2),
          active_vaults: vaultListItems.filter((v) => v.status === 'active')
            .length,
          volume_24h: this.formatLargeNumber(volume24h),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching vaults:', error);
      throw error;
    }
  }

  private async calculateLPTokenPrice(
    tokenConfig: any,
    tokenPrices: TokenPrice[],
    chain: ChainType,
  ): Promise<number> {
    try {
      const lpData = await this.subgraphRepository.getLPTokenData(
        chain,
        tokenConfig.address,
      );
      if (!lpData || !lpData.data) return 0;

      const token0Price =
        tokenPrices.find(
          (p) =>
            p.tokenAddress.toLowerCase() === tokenConfig.token0.toLowerCase(),
        )?.priceUsd || 0;
      const token1Price =
        tokenPrices.find(
          (p) =>
            p.tokenAddress.toLowerCase() === tokenConfig.token1.toLowerCase(),
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

  private async getVolume24h(chain: ChainType): Promise<number> {
    try {
      return await this.subgraphRepository.getVolume24h(chain);
    } catch (error) {
      this.logger.error('Error fetching 24h volume:', error);
      return 0;
    }
  }

  private generateVaultId(vault: any): string {
    return `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;
  }

  private calculateRewardRate(seasonNumber: number): string {
    const rates = {
      1: { single: 250, lp: 300 },
      2: { single: 300, lp: 350 },
    };
    const rate = rates[seasonNumber] || rates[1];
    return `${rate.single} Shards / $1,000`;
  }

  private getTokenIcon(coingeckoIdOrSymbol: string): string {
    const iconMap = {
      illuvium:
        'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
      ethereum:
        'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
      ilv: 'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
      eth: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
      usdc: 'https://coin-images.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    };
    return (
      iconMap[coingeckoIdOrSymbol.toLowerCase()] ||
      `https://coin-images.coingecko.com/coins/images/279/large/ethereum.png`
    );
  }

  private getCoingeckoIdForToken(tokenAddress: string): string {
    const addressToId = {
      '0x4200000000000000000000000000000000000006': 'ethereum',
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': 'usd-coin',
    };
    return addressToId[tokenAddress] || 'ethereum';
  }

  private formatLargeNumber(value: number): string {
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
  }

  private formatNumber(value: number, decimals: number = 2): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}
