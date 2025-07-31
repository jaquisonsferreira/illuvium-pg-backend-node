import { Test, TestingModule } from '@nestjs/testing';
import { StakingTransactionsController } from './staking-transactions.controller';
import { GetUserStakingTransactionsUseCase } from '../../application/use-cases/get-user-staking-transactions.use-case';
import { BadRequestException } from '@nestjs/common';
import {
  TransactionType,
  TransactionSortBy,
  TransactionSortOrder,
} from '../dto/get-transactions-query.dto';

describe('StakingTransactionsController', () => {
  let controller: StakingTransactionsController;
  let getUserStakingTransactionsUseCase: jest.Mocked<GetUserStakingTransactionsUseCase>;

  const mockWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const checksumAddress = '0x1234567890AbcdEF1234567890aBcdef12345678';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StakingTransactionsController],
      providers: [
        {
          provide: GetUserStakingTransactionsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StakingTransactionsController>(
      StakingTransactionsController,
    );
    getUserStakingTransactionsUseCase = module.get(
      GetUserStakingTransactionsUseCase,
    );
  });

  describe('GET /api/staking/:walletAddress/transactions', () => {
    it('should return user transactions with default pagination', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        data: [
          {
            transaction_hash: '0xabc123',
            type: 'deposit' as const,
            vault_id: 'ilv_vault',
            vault_name: 'ILV',
            underlying_asset: 'Illuvium',
            underlying_asset_ticker: 'ILV',
            token_icons: {
              primary:
                'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
              secondary: null,
            },
            amount: '100.50',
            amount_raw: '100500000000000000000',
            usd_value: '1523.58',
            token_price: '15.16',
            gas_fee_eth: '0.0025',
            gas_fee_usd: '7.50',
            gas_price_gwei: '25.5',
            status: 'confirmed' as const,
            block_number: 12345678,
            timestamp: '2025-03-15T10:30:00Z',
            from_address: mockWalletAddress,
            to_address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
            confirmations: 150,
            lock_duration: 365,
            earned_shards: '1219',
            chain: 'mainnet',
          },
        ],
        summary: {
          total_transactions: 15,
          total_deposits: 10,
          total_withdrawals: 5,
          total_deposited_usd: '15235.80',
          total_withdrawn_usd: '7500.00',
          total_gas_fees_usd: '112.50',
          average_transaction_usd: '1516.05',
          first_transaction_date: '2024-01-15T08:30:00Z',
          last_transaction_date: '2025-03-15T10:30:00Z',
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 15,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingTransactionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserTransactions(
        mockWalletAddress,
        {},
      );

      expect(result).toEqual(mockResponse);
      expect(getUserStakingTransactionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        type: undefined,
        page: 1,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });

    it('should filter transactions by vault_id', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        data: [],
        summary: {
          total_transactions: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_deposited_usd: '0.00',
          total_withdrawn_usd: '0.00',
          total_gas_fees_usd: '0.00',
          average_transaction_usd: '0.00',
          first_transaction_date: '',
          last_transaction_date: '',
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingTransactionsUseCase.execute.mockResolvedValue(mockResponse);

      await controller.getUserTransactions(mockWalletAddress, {
        vault_id: 'ilv_vault',
      });

      expect(getUserStakingTransactionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: 'ilv_vault',
        type: undefined,
        page: 1,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });

    it('should filter transactions by type', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        data: [],
        summary: {
          total_transactions: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_deposited_usd: '0.00',
          total_withdrawn_usd: '0.00',
          total_gas_fees_usd: '0.00',
          average_transaction_usd: '0.00',
          first_transaction_date: '',
          last_transaction_date: '',
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingTransactionsUseCase.execute.mockResolvedValue(mockResponse);

      await controller.getUserTransactions(mockWalletAddress, {
        type: TransactionType.DEPOSIT,
      });

      expect(getUserStakingTransactionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        type: TransactionType.DEPOSIT,
        page: 1,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });

    it('should handle date range filtering', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        data: [],
        summary: {
          total_transactions: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_deposited_usd: '0.00',
          total_withdrawn_usd: '0.00',
          total_gas_fees_usd: '0.00',
          average_transaction_usd: '0.00',
          first_transaction_date: '',
          last_transaction_date: '',
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingTransactionsUseCase.execute.mockResolvedValue(mockResponse);

      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-03-31T23:59:59.999Z';

      await controller.getUserTransactions(mockWalletAddress, {
        start_date: startDate,
        end_date: endDate,
      });

      expect(getUserStakingTransactionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        type: undefined,
        page: 1,
        limit: 20,
        startDate: startDate,
        endDate: endDate,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });

    it('should handle sorting parameters', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        data: [],
        summary: {
          total_transactions: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_deposited_usd: '0.00',
          total_withdrawn_usd: '0.00',
          total_gas_fees_usd: '0.00',
          average_transaction_usd: '0.00',
          first_transaction_date: '',
          last_transaction_date: '',
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingTransactionsUseCase.execute.mockResolvedValue(mockResponse);

      await controller.getUserTransactions(mockWalletAddress, {
        sort_by: TransactionSortBy.AMOUNT,
        sort_order: TransactionSortOrder.ASC,
      });

      expect(getUserStakingTransactionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        type: undefined,
        page: 1,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
        sortBy: TransactionSortBy.AMOUNT,
        sortOrder: TransactionSortOrder.ASC,
      });
    });

    it('should validate wallet address format', async () => {
      const invalidAddress = '0xinvalid';

      await expect(
        controller.getUserTransactions(invalidAddress, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate start_date format', async () => {
      await expect(
        controller.getUserTransactions(mockWalletAddress, {
          start_date: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate end_date format', async () => {
      await expect(
        controller.getUserTransactions(mockWalletAddress, {
          end_date: '2025-03-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate date range (start_date cannot be after end_date)', async () => {
      await expect(
        controller.getUserTransactions(mockWalletAddress, {
          start_date: '2025-12-31T00:00:00.000Z',
          end_date: '2025-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        data: [],
        summary: {
          total_transactions: 100,
          total_deposits: 60,
          total_withdrawals: 40,
          total_deposited_usd: '152358.00',
          total_withdrawn_usd: '75000.00',
          total_gas_fees_usd: '425.00',
          average_transaction_usd: '2273.58',
          first_transaction_date: '2024-01-15T08:30:00Z',
          last_transaction_date: '2025-03-20T14:45:00Z',
        },
        pagination: {
          page: 3,
          limit: 25,
          total: 100,
          total_pages: 4,
          has_next: true,
          has_previous: true,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingTransactionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserTransactions(mockWalletAddress, {
        page: 3,
        limit: 25,
      });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(25);
      expect(getUserStakingTransactionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        type: undefined,
        page: 3,
        limit: 25,
        startDate: undefined,
        endDate: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });

    it('should handle use case errors appropriately', async () => {
      getUserStakingTransactionsUseCase.execute.mockRejectedValue(
        new Error('Subgraph unavailable'),
      );

      await expect(
        controller.getUserTransactions(mockWalletAddress, {}),
      ).rejects.toThrow('Subgraph unavailable');
    });
  });
});
