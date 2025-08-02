import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { RewardsConfigService } from '../../infrastructure/services/rewards-config.service';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { IStakingBlockchainRepository } from '../../domain/repositories/staking-blockchain.repository.interface';
import { VaultDetailsResponseDto } from '../../interface/dto/vault-details-response.dto';
import { formatUnits } from 'ethers';
import { CacheService } from '@shared/services/cache.service';

interface GetVaultDetailsParams {
  vaultId: string;
  walletAddress?: string;
  timeframe: string;
}

@Injectable()
export class GetVaultDetailsUseCase {
  private readonly logger = new Logger(GetVaultDetailsUseCase.name);

  constructor(
    private readonly vaultConfigService: VaultConfigService,
    private readonly rewardsConfigService: RewardsConfigService,
    @Inject('IStakingSubgraphRepository')
    private readonly subgraphRepository: IStakingSubgraphRepository,
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
    @Inject('IStakingBlockchainRepository')
    private readonly blockchainRepository: IStakingBlockchainRepository,
    @Inject(CacheService)
    private readonly cacheService: CacheService,
  ) {}

  async execute(
    params: GetVaultDetailsParams,
  ): Promise<VaultDetailsResponseDto> {
    try {
      const vault = await this.findVaultByIdOrAddress(params.vaultId);
      if (!vault) {
        throw new NotFoundException(`Vault not found: ${params.vaultId}`);
      }

      const [currentStats, chartData, historicalStats] = await Promise.all([
        this.getCurrentStats(vault),
        this.getChartData(vault, params.timeframe),
        this.getHistoricalStats(vault),
      ]);

      let userPosition = null;
      if (params.walletAddress) {
        userPosition = await this.getUserPosition(vault, params.walletAddress);
      }

      return {
        vault_id: this.generateVaultId(vault),
        vault_address: vault.address,
        name: vault.name,
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
        description: this.generateVaultDescription(vault),
        reward_rate: this.calculateRewardRate(vault),
        current_stats: currentStats,
        mechanics: {
          locked_until_mainnet: !this.vaultConfigService.isMainnetLaunched(),
          withdrawal_enabled: vault.withdrawalEnabled,
          redeem_delay_days: null,
          minimum_deposit: formatUnits(
            vault.minimumDeposit,
            vault.tokenConfig.decimals,
          ),
          maximum_deposit: vault.maximumDeposit
            ? formatUnits(vault.maximumDeposit, vault.tokenConfig.decimals)
            : null,
          deposit_enabled: vault.depositEnabled,
        },
        chart_data: chartData,
        user_position: userPosition,
        historical_stats: historicalStats,
      };
    } catch (error) {
      this.logger.error('Error fetching vault details:', error);
      throw error;
    }
  }

  private async findVaultByIdOrAddress(vaultId: string): Promise<any> {
    const allVaults = this.vaultConfigService.getAllVaultConfigs();

    // Try to find by exact vault_id match (with chain suffix)
    let vault = allVaults.find((v) => this.generateVaultId(v) === vaultId);

    // Try to find by vault_id without chain suffix (e.g., "ilv_vault")
    if (!vault) {
      vault = allVaults.find((v) => {
        const generatedVaultId = `${v.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;
        return generatedVaultId === vaultId.toLowerCase();
      });
    }

    // Try to find by vault address
    if (!vault) {
      vault = this.vaultConfigService.getVaultConfig(vaultId);
    }

    return vault;
  }

  private async getVaultData(vault: any): Promise<any> {
    const cacheKey = `vault:data:${vault.address}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.subgraphRepository.getVaultData(
      vault.chain,
      vault.address,
    );
    await this.cacheService.set(cacheKey, data, 300); // 5 minutes
    return data;
  }

  private async getCurrentStats(vault: any): Promise<any> {
    const tvlData = await this.subgraphRepository.getVaultsTVL(vault.chain, [
      vault.address,
    ]);

    const vaultTvl = tvlData[vault.address.toLowerCase()] || {
      totalAssets: '0',
    };

    let tvlUsd = 0;
    let tokenPrice = 0;
    let vaultSizeFormatted = '0';
    let priceChange24h = 0;

    if (vault.tokenConfig.isLP) {
      tokenPrice = await this.calculateLPTokenPrice(vault);
      const totalAssetsFormatted = parseFloat(
        formatUnits(vaultTvl.totalAssets, vault.tokenConfig.decimals),
      );
      tvlUsd = totalAssetsFormatted * tokenPrice;
      vaultSizeFormatted =
        this.formatNumber(totalAssetsFormatted, 2) +
        ' ' +
        vault.tokenConfig.symbol;
    } else {
      const priceData = await this.priceFeedRepository.getTokenPrice(
        vault.asset,
        vault.chain,
      );
      tokenPrice = priceData?.priceUsd || 0;
      priceChange24h = priceData?.change24h || 0;
      const totalAssetsFormatted = parseFloat(
        formatUnits(vaultTvl.totalAssets, vault.tokenConfig.decimals),
      );
      tvlUsd = totalAssetsFormatted * tokenPrice;
      vaultSizeFormatted =
        this.formatNumber(totalAssetsFormatted, 2) +
        ' ' +
        vault.tokenConfig.symbol;
    }

    return {
      tvl: this.formatLargeNumber(tvlUsd),
      tvl_raw: tvlUsd.toFixed(2),
      vault_size: vaultSizeFormatted,
      token_price: tokenPrice.toFixed(2),
      '24h_change':
        priceChange24h >= 0
          ? `+${priceChange24h.toFixed(1)}%`
          : `${priceChange24h.toFixed(1)}%`,
    };
  }

  private async getChartData(vault: any, timeframe: string): Promise<any> {
    const endTime = Math.floor(Date.now() / 1000);
    const timeframeSeconds = {
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000,
      all: 31536000, // 1 year
    };
    const startTime = endTime - timeframeSeconds[timeframe];

    const [tvlHistory, volumeHistory] = await Promise.all([
      this.subgraphRepository.getVaultTVLHistory(
        vault.chain,
        vault.address,
        startTime,
        endTime,
      ),
      this.subgraphRepository.getVaultVolumeHistory(
        vault.chain,
        vault.address,
        startTime,
        endTime,
      ),
    ]);

    const formatChartData = (data: any[]) => {
      return {
        [timeframe]: data.map((point) => ({
          timestamp: new Date(point.timestamp * 1000).toISOString(),
          value: point.value,
        })),
      };
    };

    return {
      tvl: formatChartData(tvlHistory || []),
      volume: formatChartData(volumeHistory || []),
      fees: formatChartData(
        (volumeHistory || []).map((v) => ({ ...v, value: v.value * 0.005 })),
      ), // 0.5% fee assumption
    };
  }

  private async getHistoricalStats(vault: any): Promise<any> {
    const stats = await this.subgraphRepository.getVaultHistoricalStats(
      vault.chain,
      vault.address,
    );

    return {
      all_time_deposits: stats.totalDeposits.toFixed(2),
      all_time_withdrawals: stats.totalWithdrawals.toFixed(2),
      highest_tvl: stats.highestTVL.toFixed(2),
    };
  }

  private async getUserPosition(
    vault: any,
    walletAddress: string,
  ): Promise<any> {
    const [position, walletBalance, shardData] = await Promise.all([
      this.subgraphRepository.getUserPosition(
        vault.chain,
        vault.address,
        walletAddress,
      ),
      this.blockchainRepository.getUserTokenBalance(
        walletAddress,
        vault.asset,
        vault.chain,
      ),
      this.getShardData(walletAddress, vault.address),
    ]);

    if (!position) {
      return null;
    }

    const stakedFormatted = formatUnits(
      position.assets,
      vault.tokenConfig.decimals,
    );
    const walletFormatted = formatUnits(
      walletBalance,
      vault.tokenConfig.decimals,
    );

    let tokenPrice = 0;
    if (vault.tokenConfig.isLP) {
      tokenPrice = await this.calculateLPTokenPrice(vault);
    } else {
      const priceData = await this.priceFeedRepository.getTokenPrice(
        vault.asset,
        vault.chain,
      );
      tokenPrice = priceData?.priceUsd || 0;
    }

    const stakedUsd = parseFloat(stakedFormatted) * tokenPrice;

    return {
      wallet_address: walletAddress,
      underlying_asset_staked_balance: stakedFormatted,
      underlying_asset_staked_balance_raw: position.assets,
      underlying_asset_balance_in_wallet: walletFormatted,
      underlying_asset_balance_in_wallet_raw: walletBalance.toString(),
      underlying_balance_usd: stakedUsd.toFixed(2),
      pending_shards: shardData.pending.toString(),
      earned_shards: shardData.earned.toString(),
      is_unstake_enabled:
        vault.withdrawalEnabled && this.vaultConfigService.isMainnetLaunched(),
    };
  }

  private async calculateLPTokenPrice(vault: any): Promise<number> {
    const cacheKey = `lp-price:${vault.address}`;
    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      const lpData = await this.subgraphRepository.getLPTokenData(
        vault.chain,
        vault.asset,
      );
      if (!lpData) return 0;

      const [token0Price, token1Price] = await Promise.all([
        this.priceFeedRepository.getTokenPrice(
          vault.tokenConfig.token0,
          vault.chain,
        ),
        this.priceFeedRepository.getTokenPrice(
          vault.tokenConfig.token1,
          vault.chain,
        ),
      ]);

      const lpDataValue = lpData.data;
      if (!lpDataValue) return 0;

      const reserve0 = parseFloat(formatUnits(lpDataValue.reserve0, 18));
      const reserve1 = parseFloat(formatUnits(lpDataValue.reserve1, 18));
      const totalSupply = parseFloat(formatUnits(lpDataValue.totalSupply, 18));

      if (totalSupply === 0) return 0;

      const totalValue =
        reserve0 * (token0Price?.priceUsd || 0) +
        reserve1 * (token1Price?.priceUsd || 0);
      const lpPrice = totalValue / totalSupply;

      await this.cacheService.set(cacheKey, lpPrice, 300); // 5 minutes
      return lpPrice;
    } catch (error) {
      this.logger.error('Error calculating LP token price:', error);
      return 0;
    }
  }

  private async getShardData(
    walletAddress: string,
    vaultAddress: string,
  ): Promise<any> {
    // This would integrate with the shards module
    // For now, returning mock data
    // TODO: Use walletAddress and vaultAddress to fetch real shard data
    void walletAddress;
    void vaultAddress;
    return {
      pending: 315,
      earned: 1200,
    };
  }

  private generateVaultId(vault: any): string {
    return `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '').replace('-', '_')}_vault`;
  }

  private generateVaultDescription(vault: any): string {
    const rewardRate = this.calculateRewardRate(vault);
    return `This vault allows you to stake ${vault.tokenConfig.name} and earn ${rewardRate} as rewards.`;
  }

  private calculateRewardRate(vault: any): string {
    return this.rewardsConfigService.getFormattedRewardRate(vault.type);
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
