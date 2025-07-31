import { Injectable, Inject, Logger } from '@nestjs/common';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import { CalculateLPTokenPriceUseCase } from './calculate-lp-token-price.use-case';
import { StakingPositionsResponseDto } from '../../interface/dto/staking-positions-response.dto';
import {
  VaultType,
  VaultPosition,
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
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
    private readonly vaultConfigService: VaultConfigService,
    private readonly tokenDecimalsService: TokenDecimalsService,
    private readonly calculateLPTokenPriceUseCase: CalculateLPTokenPriceUseCase,
  ) {}

  async execute(params: ExecuteParams): Promise<StakingPositionsResponseDto> {
    const { walletAddress, vaultId, page, limit, search } = params;

    this.logger.log(`Fetching positions for wallet: ${walletAddress}`);

    // Get current season info
    const currentSeasonConfig = this.vaultConfigService.getCurrentSeason();
    if (!currentSeasonConfig) {
      throw new Error('No active season found');
    }

    const currentSeason = {
      season_id: currentSeasonConfig.seasonNumber,
      season_name: `Season ${currentSeasonConfig.seasonNumber}`,
      chain: currentSeasonConfig.primaryChain,
    };

    // Get vaults based on filters
    let vaults: any[] = [];
    if (vaultId) {
      // Try to find vault by ID first (assuming vaultId could be vault_id like "ilv_vault")
      const allVaults = this.vaultConfigService.getActiveVaults();
      const vaultByCustomId = allVaults.find((v) => {
        // Create a custom ID from vault symbol
        const customId = `${v.tokenConfig.symbol.toLowerCase()}_vault`;
        return customId === vaultId.toLowerCase();
      });

      if (vaultByCustomId) {
        vaults = [vaultByCustomId];
      } else {
        // Try by address
        const vaultByAddress = this.vaultConfigService.getVaultConfig(vaultId);
        if (vaultByAddress) {
          vaults = [vaultByAddress];
        }
      }
    } else {
      vaults = this.vaultConfigService.getActiveVaults();
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      vaults = vaults.filter(
        (vault) =>
          vault.name?.toLowerCase().includes(searchLower) ||
          vault.symbol?.toLowerCase().includes(searchLower) ||
          vault.tokenConfig?.symbol?.toLowerCase().includes(searchLower),
      );
    }

    // Get user positions from subgraph
    const positionsResponse =
      await this.stakingSubgraphRepository.getUserPositions({
        userAddress: walletAddress,
        chain: currentSeason.chain,
      });

    const userPositions = positionsResponse.data || [];

    // Group positions by vault
    const positionsByVault = new Map<string, VaultPosition[]>();
    for (const position of userPositions) {
      const vaultAddress = position.vault.toLowerCase();
      if (!positionsByVault.has(vaultAddress)) {
        positionsByVault.set(vaultAddress, []);
      }
      positionsByVault.get(vaultAddress)!.push(position);
    }

    // Process each vault and enrich with data
    const enrichedVaults = await Promise.all(
      vaults.map(async (vault) => {
        const vaultAddress = vault.address.toLowerCase();
        const vaultPositions = positionsByVault.get(vaultAddress) || [];
        const hasPositions = vaultPositions.length > 0;

        // Get token price
        let tokenPrice = 0;
        let price24hChange = 0;
        let tokenIcons: { primary: string; secondary: string | null } = {
          primary: '',
          secondary: null,
        };

        try {
          if (vault.type === VaultType.LP_TOKEN) {
            // Get LP token data and calculate price
            const lpData = await this.stakingSubgraphRepository.getLPTokenData(
              vault.asset,
              vault.chain,
            );

            if (lpData.data) {
              const lpPrice = await this.calculateLPTokenPriceUseCase.execute({
                lpTokenAddress: vault.asset,
                chain: vault.chain,
              });
              tokenPrice = lpPrice.lpTokenPrice?.priceUsd || 0;
            }

            // For LP tokens, we need to get icons for both tokens
            if (vault.tokenConfig.isLP) {
              tokenIcons = {
                primary:
                  'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png', // ILV icon
                secondary:
                  'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png', // ETH icon
              };
            }
          } else {
            // Get single token price
            const priceData = await this.priceFeedRepository.getTokenPrice(
              vault.asset,
              vault.chain,
            );
            tokenPrice = priceData.priceUsd || 0;
            price24hChange = priceData.change24h || 0;

            // For single tokens
            tokenIcons = {
              primary:
                vault.tokenConfig.coingeckoId === 'illuvium'
                  ? 'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png'
                  : '',
              secondary: null,
            };
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get price for vault ${vault.address}:`,
            error,
          );
        }

        // Format vault data
        const totalStaked = vaultPositions.reduce(
          (sum, pos) => sum + BigInt(pos.assets || '0'),
          BigInt(0),
        );

        const decimals = await this.tokenDecimalsService.getDecimals(
          vault.asset,
          vault.chain,
        );

        const formattedTotalStaked = formatUnits(totalStaked, decimals);
        const totalStakedUsd = parseFloat(formattedTotalStaked) * tokenPrice;

        // Calculate earned shards (simplified - should use actual formula)
        const shardsRate = vault.type === VaultType.LP_TOKEN ? 20 : 80;
        const totalEarnedShards = (totalStakedUsd / 1000) * shardsRate;

        // Get wallet balance
        // TODO: This should be fetched from blockchain service
        const walletBalance = '0';

        // Format positions
        const formattedPositions = await Promise.all(
          vaultPositions.map(async (pos, index) => {
            const stakedAmount = formatUnits(pos.assets || '0', decimals);
            const lockDuration = this.calculateLockDuration(pos.timestamp);
            const shardsMultiplier =
              this.calculateShardsMultiplier(lockDuration);

            const vaultId = `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;

            return {
              position_id: `${vault.tokenConfig.symbol} #${index + 1}`,
              vault_id: vaultId,
              underlying_asset_ticker: vault.tokenConfig.symbol,
              earned_shards: Math.floor(
                ((parseFloat(stakedAmount) * tokenPrice) / 1000) *
                  shardsRate *
                  shardsMultiplier,
              ).toString(),
              staked_amount: stakedAmount,
              staked_amount_raw: pos.assets,
              lock_duration: `${lockDuration} days`,
              shards_multiplier: shardsMultiplier.toFixed(2),
              isLocked: true,
              deposit_date: new Date(pos.timestamp * 1000).toISOString(),
              unlock_date: new Date(
                (pos.timestamp + lockDuration * 24 * 60 * 60) * 1000,
              ).toISOString(),
            };
          }),
        );

        // Format TVL
        const tvl = parseFloat(formatUnits(vault.totalAssets || '0', decimals));
        const tvlUsd = tvl * tokenPrice;

        const vaultId = `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;

        return {
          vault_id: vaultId,
          vault_name: vault.tokenConfig.symbol,
          underlying_asset_ticker: vault.tokenConfig.symbol,
          vault_address: vault.address,
          underlying_asset_address: vault.asset,
          chain: vault.chain,
          token_icons: tokenIcons,
          tvl: `$${this.formatNumber(tvlUsd)}`,
          tvl_raw: tvlUsd.toFixed(2),
          vault_size: formatUnits(vault.totalSupply || '0', decimals),
          token_price: tokenPrice.toFixed(2),
          '24h_change':
            price24hChange > 0
              ? `+${price24hChange.toFixed(1)}%`
              : `${price24hChange.toFixed(1)}%`,
          shards_rate: shardsRate.toString(),
          userHasStake: hasPositions,
          user_total_staked: formattedTotalStaked,
          user_total_staked_raw: totalStaked.toString(),
          user_active_positions_count: vaultPositions.length,
          user_total_earned_shards: Math.floor(totalEarnedShards).toString(),
          underlying_asset_balance_in_wallet: walletBalance,
          underlying_asset_balance_in_wallet_raw: '0',
          positions: formattedPositions,
        };
      }),
    );

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedVaults = enrichedVaults.slice(offset, offset + limit);

    // Calculate user summary
    const userSummary = this.calculateUserSummary(enrichedVaults);

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

  private calculateLockDuration(_depositTimestamp: number): number {
    // For now, return default 365 days
    // TODO: Get actual lock duration from contract
    return 365;
  }

  private calculateShardsMultiplier(lockDays: number): number {
    // Linear multiplier: 1x at 30 days, 2x at 365 days
    if (lockDays <= 30) return 1;
    if (lockDays >= 365) return 2;
    return 1 + (lockDays - 30) / 335;
  }

  private calculateUserSummary(vaults: any[]): any {
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

    const totalEarnedShards = vaults.reduce(
      (sum, vault) => sum + parseInt(vault.user_total_earned_shards),
      0,
    );

    const totalPortfolioValue = vaults.reduce((sum, vault) => {
      const staked = parseFloat(vault.user_total_staked);
      const price = parseFloat(vault.token_price);
      return sum + staked * price;
    }, 0);

    return {
      total_portfolio_value_usd: totalPortfolioValue.toFixed(2),
      total_user_positions: totalPositions,
      total_vaults_with_stakes: vaultsWithStakes,
      total_user_staked_ilv: totalIlvStaked.toFixed(2),
      total_user_staked_ilv_eth: totalIlvEthStaked.toFixed(2),
      total_user_earned_shards: totalEarnedShards.toString(),
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
