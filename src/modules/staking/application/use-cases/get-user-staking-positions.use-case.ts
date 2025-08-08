import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IStakingBlockchainRepository } from '../../domain/repositories/staking-blockchain.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { IShardEarningHistoryRepository } from '../../../shards/domain/repositories/shard-earning-history.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { RewardsConfigService } from '../../infrastructure/services/rewards-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import { CalculateLPTokenPriceUseCase } from './calculate-lp-token-price.use-case';
import { StakingPositionsResponseDto } from '../../interface/dto/staking-positions-response.dto';
import {
  VaultType,
  VaultPosition,
  ChainType,
} from '../../domain/types/staking-types';
import { formatUnits } from 'ethers';

interface ExecuteParams {
  walletAddress: string;
  vaultId?: string;
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class GetUserStakingPositionsUseCase {
  private readonly logger = new Logger(GetUserStakingPositionsUseCase.name);

  constructor(
    @Inject('IStakingSubgraphRepository')
    private readonly stakingSubgraphRepository: IStakingSubgraphRepository,
    @Inject('IStakingBlockchainRepository')
    private readonly blockchainRepository: IStakingBlockchainRepository,
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
    @Inject('IShardEarningHistoryRepository')
    private readonly shardEarningHistoryRepository: IShardEarningHistoryRepository,
    private readonly vaultConfigService: VaultConfigService,
    private readonly rewardsConfigService: RewardsConfigService,
    private readonly tokenDecimalsService: TokenDecimalsService,
    private readonly calculateLPTokenPriceUseCase: CalculateLPTokenPriceUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(params: ExecuteParams): Promise<StakingPositionsResponseDto> {
    const { walletAddress, vaultId, page, limit, search } = params;

    this.logger.log(`Fetching positions for wallet: ${walletAddress}`);

    const currentSeasonConfig = this.vaultConfigService.getCurrentSeason();
    if (!currentSeasonConfig) {
      throw new Error('No active season found');
    }

    const currentSeason = {
      season_id: currentSeasonConfig.seasonNumber,
      season_name: `Season ${currentSeasonConfig.seasonNumber}`,
      chain: currentSeasonConfig.primaryChain,
    };

    let vaults: any[] = [];
    if (vaultId) {
      const allVaults = this.vaultConfigService.getActiveVaults();
      const vaultByCustomId = allVaults.find((v) => {
        const customId = `${v.tokenConfig.symbol.toLowerCase()}_vault`;
        return customId === vaultId.toLowerCase();
      });

      if (vaultByCustomId) {
        vaults = [vaultByCustomId];
      } else {
        const vaultByAddress = this.vaultConfigService.getVaultConfig(vaultId);
        if (vaultByAddress) {
          vaults = [vaultByAddress];
        }
      }
    } else {
      vaults = this.vaultConfigService.getActiveVaults();
    }

    this.logger.log(`Found ${vaults.length} active vaults`);
    vaults.forEach((v) => {
      this.logger.log(`Vault: ${v.name} at ${v.address}`);
    });

    if (search) {
      const searchLower = search.toLowerCase();
      vaults = vaults.filter(
        (vault) =>
          vault.name?.toLowerCase().includes(searchLower) ||
          vault.symbol?.toLowerCase().includes(searchLower) ||
          vault.tokenConfig?.symbol?.toLowerCase().includes(searchLower),
      );
    }

    const positionsResponse =
      await this.stakingSubgraphRepository.getUserPositions({
        userAddress: walletAddress,
        chain: currentSeason.chain,
      });

    const userPositions = positionsResponse.data || [];

    this.logger.log(
      `Subgraph returned ${userPositions.length} positions for wallet ${walletAddress}`,
    );

    const positionsByVault = new Map<string, VaultPosition[]>();
    for (const position of userPositions) {
      const vaultAddress = position.vault.toLowerCase();
      if (!positionsByVault.has(vaultAddress)) {
        positionsByVault.set(vaultAddress, []);
      }
      positionsByVault.get(vaultAddress)!.push(position);
    }

    // Get vault TVL data
    const vaultTvlData = await this.stakingSubgraphRepository.getVaultsTVL(
      currentSeason.chain,
      vaults.map((v) => v.address),
    );

    const enrichedVaults = await Promise.all(
      vaults.map(async (vault) => {
        const vaultAddress = vault.address.toLowerCase();
        const vaultPositions = positionsByVault.get(vaultAddress) || [];
        const hasPositions = vaultPositions.length > 0;

        // Get TVL data for this vault
        const tvlData = vaultTvlData[vaultAddress] || {
          totalAssets: '0',
          sharePrice: 0,
        };

        let tokenPrice = 0;
        let price24hChange = 0;
        let tokenIcons: { primary: string; secondary: string | null } = {
          primary: '',
          secondary: null,
        };

        try {
          if (vault.type === VaultType.LP_TOKEN) {
            try {
              const lpData =
                await this.stakingSubgraphRepository.getLPTokenData(
                  vault.asset,
                  vault.chain,
                );

              if (lpData.data) {
                const lpPrice = await this.calculateLPTokenPriceUseCase.execute(
                  {
                    lpTokenAddress: vault.asset,
                    chain: vault.chain,
                  },
                );
                tokenPrice = lpPrice.lpTokenPrice?.priceUsd || 0;
              }
            } catch (lpError) {
              this.logger.warn(
                `Failed to get LP token price for ${vault.asset}, using fallback price`,
                lpError,
              );
              // Use a fallback price for LP tokens when calculation fails
              tokenPrice = 100; // Mock price for testing
              price24hChange = 2.5; // Mock 24h change
            }

            if (vault.tokenConfig.isLP) {
              tokenIcons = {
                primary:
                  'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
                secondary:
                  'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
              };
            }
          } else {
            const priceData = await this.priceFeedRepository.getTokenPrice(
              vault.asset,
              vault.chain,
            );
            tokenPrice = priceData.priceUsd || 0;
            price24hChange = priceData.change24h || 0;

            tokenIcons = {
              primary:
                vault.tokenConfig.coingeckoId === 'illuvium'
                  ? 'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png'
                  : '',
              secondary: null,
            };
          }
        } catch (error) {
          this.logger.error(
            `Failed to get price for vault ${vault.address}: ${error.message}`,
          );
          if (error.response?.statusCode === 503) {
            tokenPrice = 0;
            price24hChange = 0;
          } else {
            throw error;
          }
        }

        const decimals = await this.tokenDecimalsService.getDecimals(
          vault.asset,
          vault.chain,
        );

        let totalStaked = BigInt(0);
        let totalStakedFormatted = '0';

        const shardsRate = this.rewardsConfigService.getRewardRate(vault.type);

        let walletBalance = '0';
        let walletBalanceRaw = '0';
        try {
          walletBalanceRaw =
            await this.blockchainRepository.getUserTokenBalance(
              walletAddress,
              vault.asset,
              vault.chain,
            );
          walletBalance = formatUnits(walletBalanceRaw, decimals);
        } catch (error) {
          this.logger.warn(
            `Failed to get wallet balance for ${vault.asset}:`,
            error,
          );
        }

        let depositInfo: {
          timestamps: bigint[];
          lockDurations: bigint[];
          shareAmounts: bigint[];
        } | null = null;
        try {
          depositInfo = await this.blockchainRepository.getUserDepositInfo(
            walletAddress,
            vaultAddress,
            vault.chain,
          );

          if (depositInfo) {
            this.logger.log(
              `Got deposit info for ${walletAddress} in vault ${vaultAddress}: ${depositInfo.lockDurations.length} positions`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get deposit info from contract for ${walletAddress} in vault ${vaultAddress}:`,
            error,
          );
        }

        if (depositInfo && depositInfo.shareAmounts.length > 0) {
          // Only sum shares that are greater than 0 (non-withdrawn positions)
          const totalShares = depositInfo.shareAmounts.reduce(
            (sum, shares) => (shares > BigInt(0) ? sum + shares : sum),
            BigInt(0),
          );

          if (totalShares > BigInt(0)) {
            const totalAssets =
              await this.blockchainRepository.convertSharesToAssets(
                totalShares.toString(),
                vaultAddress,
                vault.chain,
              );
            totalStaked = BigInt(totalAssets);
            totalStakedFormatted = formatUnits(totalAssets, decimals);
          }
        } else if (vaultPositions.length > 0) {
          totalStaked = vaultPositions.reduce(
            (sum, pos) => sum + BigInt(pos.assets || '0'),
            BigInt(0),
          );
          totalStakedFormatted = formatUnits(totalStaked, decimals);
        }

        let formattedPositions: any[] = [];

        if (depositInfo && depositInfo.timestamps.length > 0) {
          const positionsPromises = depositInfo.timestamps.map(
            async (timestamp, index) => {
              const shareAmount = depositInfo.shareAmounts[index];

              // Skip positions with 0 shares (withdrawn positions)
              if (shareAmount === BigInt(0)) {
                return null;
              }

              const lockDurationSeconds = Number(
                depositInfo.lockDurations[index],
              );
              const totalLockDays = Math.floor(
                lockDurationSeconds / (24 * 60 * 60),
              );
              const depositTimestamp = Number(timestamp);

              // Convert shares to assets
              const assets =
                await this.blockchainRepository.convertSharesToAssets(
                  shareAmount.toString(),
                  vaultAddress,
                  vault.chain,
                );

              const stakedAmount = formatUnits(assets, decimals);

              this.logger.log(
                `Position ${index}: Lock duration from contract: ${lockDurationSeconds}s = ${totalLockDays} days, shares: ${shareAmount}, assets: ${assets}`,
              );

              const remainingLockDays = this.calculateLockDuration(
                depositTimestamp,
                totalLockDays,
              );
              const isLocked = remainingLockDays > 0;

              const shardsMultiplier =
                this.rewardsConfigService.calculateShardsMultiplier(
                  totalLockDays,
                );

              const vaultId = `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '').replace('-', '_')}_vault`;

              const unlockDate =
                totalLockDays > 0
                  ? new Date(
                      (depositTimestamp + totalLockDays * 24 * 60 * 60) * 1000,
                    )
                  : new Date(depositTimestamp * 1000);

              const uniquePositionId = `${vault.address.toLowerCase()}_${walletAddress.toLowerCase()}_${index}_${depositTimestamp}`;

              return {
                position_id: `${vault.tokenConfig.symbol} #${index + 1}`,
                unique_id: uniquePositionId,
                vault_id: vaultId,
                underlying_asset_ticker: vault.tokenConfig.symbol,
                earned_shards: Math.floor(
                  ((parseFloat(stakedAmount) * tokenPrice) / 1000) *
                    shardsRate *
                    shardsMultiplier,
                ).toString(),
                staked_amount: stakedAmount,
                staked_amount_raw: assets,
                lock_duration: isLocked
                  ? `${remainingLockDays} days`
                  : 'Unlocked',
                shards_multiplier: shardsMultiplier.toFixed(2),
                isLocked,
                deposit_date: new Date(depositTimestamp * 1000).toISOString(),
                unlock_date: unlockDate.toISOString(),
                block_number: 0, // We don't have block number from contract data
                timestamp: depositTimestamp,
              };
            },
          );

          // Wait for all promises and filter out null values
          const allPositions = await Promise.all(positionsPromises);
          formattedPositions = allPositions
            .filter((position) => position !== null)
            .map((position, index) => ({
              ...position,
              position_id: `${vault.tokenConfig.symbol} #${index + 1}`,
            }));
        } else if (vaultPositions.length > 0) {
          const pos = vaultPositions[0];
          const stakedAmount = formatUnits(pos.assets || '0', decimals);
          const totalLockDays = 0;
          const remainingLockDays = this.calculateLockDuration(
            pos.timestamp,
            totalLockDays,
          );
          const isLocked = remainingLockDays > 0;

          const shardsMultiplier =
            this.rewardsConfigService.calculateShardsMultiplier(totalLockDays);

          const vaultId = `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '').replace('-', '_')}_vault`;
          const unlockDate = new Date(pos.timestamp * 1000);
          const uniquePositionId = `${vault.address.toLowerCase()}_${pos.user.toLowerCase()}_${pos.blockNumber}_${pos.timestamp}`;

          formattedPositions = [
            {
              position_id: `${vault.tokenConfig.symbol} #1`,
              unique_id: uniquePositionId,
              vault_id: vaultId,
              underlying_asset_ticker: vault.tokenConfig.symbol,
              earned_shards: Math.floor(
                ((parseFloat(stakedAmount) * tokenPrice) / 1000) *
                  shardsRate *
                  shardsMultiplier,
              ).toString(),
              staked_amount: stakedAmount,
              staked_amount_raw: pos.assets,
              lock_duration: isLocked
                ? `${remainingLockDays} days`
                : 'Unlocked',
              shards_multiplier: shardsMultiplier.toFixed(2),
              isLocked,
              deposit_date: new Date(pos.timestamp * 1000).toISOString(),
              unlock_date: unlockDate.toISOString(),
              block_number: pos.blockNumber,
              timestamp: pos.timestamp,
            },
          ];
        }

        const tvl = parseFloat(formatUnits(tvlData.totalAssets, decimals));
        const tvlUsd = tvl * tokenPrice;

        const vaultId = `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;

        const totalEarnedShards = formattedPositions.reduce((sum, position) => {
          return sum + parseInt(position.earned_shards);
        }, 0);

        return {
          vault_id: vaultId,
          vault_name: vault.tokenConfig.symbol,
          underlying_asset_ticker: vault.tokenConfig.symbol,
          vault_address: vault.address,
          underlying_asset_address: vault.asset,
          chain: this.getChainDisplayName(vault.chain),
          token_icons: tokenIcons,
          tvl: `$${this.formatNumber(tvlUsd)}`,
          tvl_raw: tvlUsd.toFixed(2),
          vault_size: formatUnits(tvlData.totalAssets, decimals),
          token_price: tokenPrice.toFixed(2),
          '24h_change':
            price24hChange > 0
              ? `+${price24hChange.toFixed(1)}%`
              : `${price24hChange.toFixed(1)}%`,
          shards_rate: shardsRate.toString(),
          userHasStake: hasPositions,
          user_total_staked: totalStakedFormatted,
          user_total_staked_raw: totalStaked.toString(),
          user_active_positions_count: formattedPositions.length,
          user_total_earned_shards: Math.floor(totalEarnedShards).toString(),
          underlying_asset_balance_in_wallet: walletBalance,
          underlying_asset_balance_in_wallet_raw: walletBalanceRaw,
          positions: formattedPositions,
        };
      }),
    );

    const offset = (page - 1) * limit;
    const paginatedVaults = enrichedVaults.slice(offset, offset + limit);

    const userSummary = await this.calculateUserSummary(
      enrichedVaults,
      walletAddress,
      currentSeason.season_id,
    );

    return {
      wallet: walletAddress,
      current_season: currentSeason,
      vaults: paginatedVaults,
      user_summary: userSummary,
      pagination: {
        page,
        limit,
        total: enrichedVaults.length,
        total_pages: Math.ceil(enrichedVaults.length / limit),
        has_next: offset + limit < enrichedVaults.length,
        has_previous: page > 1,
      },
      last_updated: new Date().toISOString(),
    };
  }

  private calculateLockDuration(
    depositTimestamp: number,
    totalLockDays: number = 0,
  ): number {
    if (totalLockDays <= 0) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const unlockTimestamp = depositTimestamp + totalLockDays * 24 * 60 * 60;

    if (now >= unlockTimestamp) {
      return 0;
    }
    const remainingSeconds = unlockTimestamp - now;
    const remainingDays = Math.ceil(remainingSeconds / (24 * 60 * 60));

    return remainingDays;
  }

  private getChainDisplayName(chain: ChainType): string {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (chain === ChainType.BASE) {
      return isProduction ? 'Base' : 'Base Sepolia';
    }

    return chain === ChainType.OBELISK ? 'Obelisk' : chain;
  }

  private async calculateUserSummary(
    vaults: any[],
    walletAddress: string,
    seasonId: number,
  ): Promise<any> {
    const totalPositions = vaults.reduce(
      (sum, vault) => sum + vault.user_active_positions_count,
      0,
    );

    const vaultsWithStakes = vaults.filter(
      (vault) => vault.userHasStake,
    ).length;

    const totalIlvStaked = vaults
      .filter((vault) => vault.underlying_asset_ticker === 'ILV')
      .reduce((sum, vault) => sum + parseFloat(vault.user_total_staked), 0);

    const totalIlvEthStaked = vaults
      .filter((vault) => vault.underlying_asset_ticker.includes('ILV/ETH'))
      .reduce((sum, vault) => sum + parseFloat(vault.user_total_staked), 0);

    let totalEarnedShards = 0;
    try {
      const historicalSummary =
        await this.shardEarningHistoryRepository.getSummaryByWallet(
          walletAddress,
          seasonId,
        );
      totalEarnedShards = Math.floor(historicalSummary.breakdown.staking);
    } catch (error) {
      this.logger.warn(
        `Failed to fetch historical shard data for wallet ${walletAddress}, falling back to active positions:`,
        error,
      );
      totalEarnedShards = vaults.reduce(
        (sum, vault) => sum + parseInt(vault.user_total_earned_shards),
        0,
      );
    }

    const totalPortfolioValue = vaults.reduce((sum, vault) => {
      const staked = parseFloat(vault.user_total_staked);
      const price = parseFloat(vault.token_price);
      return sum + staked * price;
    }, 0);

    let shardsEarnedLastDay = '0';
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      const yesterdayEarnings =
        await this.shardEarningHistoryRepository.findByWalletAndDate(
          walletAddress,
          yesterday,
          seasonId,
        );

      if (yesterdayEarnings) {
        shardsEarnedLastDay = yesterdayEarnings.stakingShards.toString();
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch yesterday's shard earnings for wallet ${walletAddress}:`,
        error,
      );
    }

    return {
      total_portfolio_value_usd: totalPortfolioValue.toFixed(2),
      total_user_positions: totalPositions,
      total_vaults_with_stakes: vaultsWithStakes,
      total_user_staked_ilv: totalIlvStaked.toFixed(2),
      total_user_staked_ilv_eth: totalIlvEthStaked.toFixed(2),
      total_user_earned_shards: totalEarnedShards.toString(),
      shards_earned_last_day: shardsEarnedLastDay,
    };
  }

  private formatNumber(value: number): string {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`;
    }
    return value.toFixed(2);
  }
}
