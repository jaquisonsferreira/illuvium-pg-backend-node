import { Injectable, Inject, Logger } from '@nestjs/common';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { IPriceFeedRepository } from '../../domain/repositories/price-feed.repository.interface';
import { VaultConfigService } from '../../infrastructure/config/vault-config.service';
import { TokenDecimalsService } from '../../infrastructure/services/token-decimals.service';
import { StakingTransactionsResponseDto } from '../../interface/dto/staking-transactions-response.dto';
import {
  TransactionType,
  TransactionSortBy,
  TransactionSortOrder,
} from '../../interface/dto/get-transactions-query.dto';
import {
  StakingTransaction,
  VaultType,
} from '../../domain/types/staking-types';
import { formatUnits } from 'ethers';

interface ExecuteParams {
  walletAddress: string;
  vaultId?: string;
  type?: TransactionType;
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
  sortBy?: TransactionSortBy;
  sortOrder?: TransactionSortOrder;
}

@Injectable()
export class GetUserStakingTransactionsUseCase {
  private readonly logger = new Logger(GetUserStakingTransactionsUseCase.name);

  constructor(
    @Inject('IStakingSubgraphRepository')
    private readonly stakingSubgraphRepository: IStakingSubgraphRepository,
    @Inject('IPriceFeedRepository')
    private readonly priceFeedRepository: IPriceFeedRepository,
    private readonly vaultConfigService: VaultConfigService,
    private readonly tokenDecimalsService: TokenDecimalsService,
  ) {}

  async execute(
    params: ExecuteParams,
  ): Promise<StakingTransactionsResponseDto> {
    const {
      walletAddress,
      vaultId,
      type,
      page,
      limit,
      startDate,
      endDate,
      sortBy = TransactionSortBy.DATE,
      sortOrder = TransactionSortOrder.DESC,
    } = params;

    this.logger.log(`Fetching transactions for wallet: ${walletAddress}`);

    // Get current season info
    const currentSeasonConfig = this.vaultConfigService.getCurrentSeason();
    if (!currentSeasonConfig) {
      throw new Error('No active season found');
    }

    // Get all transactions from subgraph
    const transactionsResponse =
      await this.stakingSubgraphRepository.getUserTransactions({
        userAddress: walletAddress,
        chain: currentSeasonConfig.primaryChain,
      });

    let transactions = transactionsResponse.data || [];

    // Filter by vault if specified
    if (vaultId) {
      const vaultAddresses = this.getVaultAddressesByVaultId(vaultId);
      transactions = transactions.filter((tx) =>
        vaultAddresses.includes(tx.vault.toLowerCase()),
      );
    }

    // Filter by transaction type
    if (type && type !== TransactionType.ALL) {
      transactions = transactions.filter((tx) => tx.type === type);
    }

    // Filter by date range
    if (startDate) {
      const startTimestamp = new Date(startDate).getTime() / 1000;
      transactions = transactions.filter(
        (tx) => tx.timestamp >= startTimestamp,
      );
    }
    if (endDate) {
      const endTimestamp = new Date(endDate).getTime() / 1000;
      transactions = transactions.filter((tx) => tx.timestamp <= endTimestamp);
    }

    // Sort transactions
    transactions = this.sortTransactions(transactions, sortBy, sortOrder);

    // Process and enrich transactions
    const enrichedTransactions = await this.enrichTransactions(transactions);

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedTransactions = enrichedTransactions.slice(
      offset,
      offset + limit,
    );

    // Calculate summary
    const summary = this.calculateTransactionSummary(enrichedTransactions);

    return {
      wallet: walletAddress,
      data: paginatedTransactions,
      summary,
      pagination: {
        page,
        limit,
        total: enrichedTransactions.length,
        total_pages: Math.ceil(enrichedTransactions.length / limit),
        has_next: offset + limit < enrichedTransactions.length,
        has_previous: page > 1,
      },
      last_updated: new Date().toISOString(),
    };
  }

  private getVaultAddressesByVaultId(vaultId: string): string[] {
    const allVaults = this.vaultConfigService.getActiveVaults();

    // Find vaults that match the vault_id pattern
    const matchingVaults = allVaults.filter((vault) => {
      const generatedVaultId = `${vault.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;
      return generatedVaultId === vaultId.toLowerCase();
    });

    return matchingVaults.map((v) => v.address.toLowerCase());
  }

  private sortTransactions(
    transactions: StakingTransaction[],
    sortBy: TransactionSortBy,
    sortOrder: TransactionSortOrder,
  ): StakingTransaction[] {
    const sorted = [...transactions].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case TransactionSortBy.DATE:
          comparison = a.timestamp - b.timestamp;
          break;
        case TransactionSortBy.AMOUNT:
          comparison = BigInt(a.amount) > BigInt(b.amount) ? 1 : -1;
          break;
        case TransactionSortBy.TYPE:
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortOrder === TransactionSortOrder.ASC ? comparison : -comparison;
    });

    return sorted;
  }

  private async enrichTransactions(
    transactions: StakingTransaction[],
  ): Promise<any[]> {
    const enrichedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        try {
          // Get vault config
          const vaultConfig = this.vaultConfigService.getVaultConfig(tx.vault);
          if (!vaultConfig) {
            this.logger.warn(`Vault config not found for ${tx.vault}`);
            return null;
          }

          // Get decimals
          const decimals = await this.tokenDecimalsService.getDecimals(
            vaultConfig.asset,
            vaultConfig.chain,
          );

          const formattedAmount = formatUnits(tx.amount || '0', decimals);

          const priceData = await this.priceFeedRepository.getTokenPrice(
            vaultConfig.asset,
            vaultConfig.chain,
          );
          const tokenPrice = priceData.priceUsd || 0;
          const usdValue = parseFloat(formattedAmount) * tokenPrice;

          const gasPrice = BigInt(tx.gasPrice || '0');
          const gasUsed = BigInt(tx.gasUsed || '21000'); // Default gas for simple transfer
          const gasFeeWei = gasPrice * gasUsed;
          const gasFeeEth = formatUnits(gasFeeWei, 18);
          const gasPriceGwei = formatUnits(gasPrice, 9);

          let ethPrice = 0;
          try {
            const ethPriceData = await this.priceFeedRepository.getTokenPrice(
              '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH address
              vaultConfig.chain,
            );
            ethPrice = ethPriceData.priceUsd;
          } catch (error) {
            this.logger.warn(
              `Failed to fetch ETH price, using 0 for gas fee calculation: ${error.message}`,
            );
            // Continue with 0 ETH price for gas fee calculation
          }

          const gasFeeUsd = parseFloat(gasFeeEth) * ethPrice;

          const vaultId = `${vaultConfig.tokenConfig.symbol.toLowerCase().replace('/', '_').replace('-lp', '')}_vault`;

          // Calculate shards earned (for deposits)
          let earnedShards = '0';
          if (tx.type === 'deposit') {
            const shardsRate =
              vaultConfig.type === VaultType.LP_TOKEN ? 20 : 80;
            earnedShards = Math.floor(
              (usdValue / 1000) * shardsRate,
            ).toString();
          }

          const currentBlock = 20000000; // Should fetch from blockchain
          const confirmations = currentBlock - tx.blockNumber;

          let sharesAmount: string | undefined = undefined;
          let sharesAmountRaw: string | undefined = undefined;
          if (tx.shares) {
            sharesAmountRaw = tx.shares;
            sharesAmount = formatUnits(tx.shares, decimals);
          }

          const vaultApr = (vaultConfig.aprBase * 100).toFixed(1);

          const positionId = `${vaultConfig.tokenConfig.symbol} #${tx.blockNumber % 1000}`;

          let tokenIcons: { primary: string; secondary: string | null } = {
            primary: '',
            secondary: null,
          };

          if (vaultConfig.type === VaultType.LP_TOKEN) {
            tokenIcons = {
              primary:
                'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
              secondary:
                'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
            };
          } else {
            tokenIcons = {
              primary:
                vaultConfig.tokenConfig.coingeckoId === 'illuvium'
                  ? 'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png'
                  : '',
              secondary: null,
            };
          }

          return {
            transaction_hash: tx.hash,
            type: tx.type,
            vault_id: vaultId,
            vault_name: vaultConfig.tokenConfig.symbol,
            underlying_asset:
              vaultConfig.tokenConfig.name || vaultConfig.tokenConfig.symbol,
            underlying_asset_ticker: vaultConfig.tokenConfig.symbol,
            token_icons: tokenIcons,
            amount: formattedAmount,
            amount_raw: tx.amount,
            usd_value: usdValue.toFixed(2),
            token_price: tokenPrice.toFixed(2),
            gas_fee_eth: gasFeeEth,
            gas_fee_usd: gasFeeUsd.toFixed(2),
            gas_price_gwei: gasPriceGwei,
            status: 'confirmed',
            block_number: tx.blockNumber,
            timestamp: new Date(tx.timestamp * 1000).toISOString(),
            from_address: tx.from,
            to_address: tx.to,
            confirmations,
            lock_duration: tx.type === 'deposit' ? 365 : undefined,
            earned_shards: tx.type === 'deposit' ? earnedShards : undefined,
            shares_amount: sharesAmount,
            shares_amount_raw: sharesAmountRaw,
            chain: vaultConfig.chain,
            vault_apr: vaultApr,
            position_id: tx.type === 'deposit' ? positionId : undefined,
            balance_after: undefined,
            method_name: tx.type,
          };
        } catch (error) {
          this.logger.error(`Failed to enrich transaction ${tx.hash}:`, error);
          return null;
        }
      }),
    );

    return enrichedTransactions.filter((tx) => tx !== null);
  }

  private calculateTransactionSummary(transactions: any[]): any {
    if (transactions.length === 0) {
      return {
        total_transactions: 0,
        total_deposits: 0,
        total_withdrawals: 0,
        total_deposited_usd: '0.00',
        total_withdrawn_usd: '0.00',
        total_gas_fees_usd: '0.00',
        average_transaction_usd: '0.00',
        first_transaction_date: '',
        last_transaction_date: '',
      };
    }

    const deposits = transactions.filter((tx) => tx.type === 'deposit');
    const withdrawals = transactions.filter((tx) => tx.type === 'withdrawal');

    const totalDepositedUsd = deposits.reduce(
      (sum, tx) => sum + parseFloat(tx.usd_value),
      0,
    );
    const totalWithdrawnUsd = withdrawals.reduce(
      (sum, tx) => sum + parseFloat(tx.usd_value),
      0,
    );
    const totalGasFeesUsd = transactions.reduce(
      (sum, tx) => sum + parseFloat(tx.gas_fee_usd),
      0,
    );

    const totalValueUsd = totalDepositedUsd + totalWithdrawnUsd;
    const averageTransactionUsd = totalValueUsd / transactions.length;

    // Sort by timestamp to get first and last
    const sortedByDate = [...transactions].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return {
      total_transactions: transactions.length,
      total_deposits: deposits.length,
      total_withdrawals: withdrawals.length,
      total_deposited_usd: totalDepositedUsd.toFixed(2),
      total_withdrawn_usd: totalWithdrawnUsd.toFixed(2),
      total_gas_fees_usd: totalGasFeesUsd.toFixed(2),
      average_transaction_usd: averageTransactionUsd.toFixed(2),
      first_transaction_date: sortedByDate[0]?.timestamp || '',
      last_transaction_date:
        sortedByDate[sortedByDate.length - 1]?.timestamp || '',
    };
  }
}
