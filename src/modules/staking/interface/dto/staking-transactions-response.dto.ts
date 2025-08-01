import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from './common.dto';

export class TransactionDto {
  @ApiProperty({
    description: 'Unique transaction hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  transaction_hash: string;

  @ApiProperty({
    description: 'Type of transaction',
    example: 'deposit',
    enum: ['deposit', 'withdrawal'],
  })
  type: 'deposit' | 'withdrawal';

  @ApiProperty({
    description: 'Vault ID where transaction occurred',
    example: 'ilv_vault',
  })
  vault_id: string;

  @ApiProperty({
    description: 'Vault name',
    example: 'ILV',
  })
  vault_name: string;

  @ApiProperty({
    description: 'Underlying asset name',
    example: 'Illuvium',
  })
  underlying_asset: string;

  @ApiProperty({
    description: 'Underlying asset ticker symbol',
    example: 'ILV',
  })
  underlying_asset_ticker: string;

  @ApiProperty({
    description: 'Token icons for the asset',
    example: {
      primary:
        'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
      secondary: null,
    },
  })
  token_icons: {
    primary: string;
    secondary: string | null;
  };

  @ApiProperty({
    description: 'Transaction amount formatted',
    example: '100.50',
  })
  amount: string;

  @ApiProperty({
    description: 'Raw transaction amount',
    example: '100500000000000000000',
  })
  amount_raw: string;

  @ApiProperty({
    description: 'USD value at time of transaction',
    example: '1523.45',
  })
  usd_value: string;

  @ApiProperty({
    description: 'Token price at time of transaction',
    example: '15.15',
  })
  token_price: string;

  @ApiProperty({
    description: 'Gas fee in ETH',
    example: '0.0025',
  })
  gas_fee_eth: string;

  @ApiProperty({
    description: 'Gas fee in USD',
    example: '6.25',
  })
  gas_fee_usd: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'confirmed',
    enum: ['pending', 'confirmed', 'failed'],
  })
  status: 'pending' | 'confirmed' | 'failed';

  @ApiProperty({
    description: 'Block number where transaction was included',
    example: 12345678,
  })
  block_number: number;

  @ApiProperty({
    description: 'Transaction timestamp (ISO 8601)',
    example: '2025-03-15T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'From address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  from_address: string;

  @ApiProperty({
    description: 'To address',
    example: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
  })
  to_address: string;

  @ApiProperty({
    description: 'Number of confirmations',
    example: 150,
  })
  confirmations: number;

  @ApiProperty({
    description: 'Lock duration in days (for deposits)',
    example: 365,
    required: false,
  })
  lock_duration?: number;

  @ApiProperty({
    description: 'Earned shards from this transaction',
    example: '3200',
    required: false,
  })
  earned_shards?: string;

  @ApiProperty({
    description: 'Share amount (vault shares)',
    example: '100.50',
    required: false,
  })
  shares_amount?: string;

  @ApiProperty({
    description: 'Raw share amount',
    example: '100500000000000000000',
    required: false,
  })
  shares_amount_raw?: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'base',
  })
  chain: string;

  @ApiProperty({
    description: 'Vault APR at time of transaction',
    example: '12.5',
    required: false,
  })
  vault_apr?: string;

  @ApiProperty({
    description: 'Position ID this transaction relates to',
    example: 'ILV #1',
    required: false,
  })
  position_id?: string;

  @ApiProperty({
    description: 'Running balance after this transaction',
    example: '500.75',
    required: false,
  })
  balance_after?: string;

  @ApiProperty({
    description: 'Gas price in Gwei',
    example: '25.5',
  })
  gas_price_gwei: string;

  @ApiProperty({
    description: 'Transaction method name',
    example: 'deposit',
    required: false,
  })
  method_name?: string;
}

export class TransactionSummaryDto {
  @ApiProperty({
    description: 'Total number of transactions',
    example: 25,
  })
  total_transactions: number;

  @ApiProperty({
    description: 'Total deposits count',
    example: 15,
  })
  total_deposits: number;

  @ApiProperty({
    description: 'Total withdrawals count',
    example: 10,
  })
  total_withdrawals: number;

  @ApiProperty({
    description: 'Total deposited amount in USD',
    example: '25000.00',
  })
  total_deposited_usd: string;

  @ApiProperty({
    description: 'Total withdrawn amount in USD',
    example: '10000.00',
  })
  total_withdrawn_usd: string;

  @ApiProperty({
    description: 'Total gas fees spent in USD',
    example: '156.25',
  })
  total_gas_fees_usd: string;

  @ApiProperty({
    description: 'Average transaction value in USD',
    example: '1400.00',
  })
  average_transaction_usd: string;

  @ApiProperty({
    description: 'Date of first transaction',
    example: '2024-01-15T08:30:00Z',
  })
  first_transaction_date: string;

  @ApiProperty({
    description: 'Date of last transaction',
    example: '2025-03-20T14:45:00Z',
  })
  last_transaction_date: string;
}

export class StakingTransactionsResponseDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  wallet: string;

  @ApiProperty({
    description: 'List of transactions',
    type: [TransactionDto],
  })
  data: TransactionDto[];

  @ApiProperty({
    description: 'Transaction summary statistics',
    type: TransactionSummaryDto,
  })
  summary: TransactionSummaryDto;

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Timestamp of last data update',
    example: '2025-03-20T15:30:00Z',
  })
  last_updated: string;
}
