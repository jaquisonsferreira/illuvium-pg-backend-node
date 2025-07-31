import { Test, TestingModule } from '@nestjs/testing';
import { StakingPositionsController } from './staking-positions.controller';
import { GetUserStakingPositionsUseCase } from '../../application/use-cases/get-user-staking-positions.use-case';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChainType } from '../../domain/types/staking-types';

describe('StakingPositionsController', () => {
  let controller: StakingPositionsController;
  let getUserStakingPositionsUseCase: jest.Mocked<GetUserStakingPositionsUseCase>;

  const mockWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const checksumAddress = '0x1234567890AbcdEF1234567890aBcdef12345678';
  const mockVaultId = 'ilv_vault';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StakingPositionsController],
      providers: [
        {
          provide: GetUserStakingPositionsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StakingPositionsController>(
      StakingPositionsController,
    );
    getUserStakingPositionsUseCase = module.get(GetUserStakingPositionsUseCase);
  });

  describe('GET /api/staking/:walletAddress/positions', () => {
    it('should return user positions with default pagination', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          chain: 'base',
        },
        vaults: [
          {
            vault_id: 'ilv_vault',
            vault_name: 'ILV',
            underlying_asset_ticker: 'ILV',
            vault_address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
            underlying_asset_address:
              '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            chain: 'base',
            token_icons: {
              primary:
                'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
              secondary: null,
            },
            tvl: '$100.00M',
            tvl_raw: '100000000.00',
            vault_size: '2200.00',
            token_price: '9.56',
            '24h_change': '+2.4%',
            shards_rate: '80',
            userHasStake: true,
            user_total_staked: '200.50',
            user_total_staked_raw: '200500000000000000000',
            user_active_positions_count: 1,
            user_total_earned_shards: '6400',
            underlying_asset_balance_in_wallet: '50.25',
            underlying_asset_balance_in_wallet_raw: '50250000000000000000',
            positions: [
              {
                position_id: 'ILV #1',
                vault_id: 'ilv_vault',
                underlying_asset_ticker: 'ILV',
                earned_shards: '3200',
                staked_amount: '125.50',
                staked_amount_raw: '125500000000000000000',
                lock_duration: '365 days',
                shards_multiplier: '2.00',
                isLocked: true,
                deposit_date: '2025-03-15T10:30:00Z',
                unlock_date: '2025-09-15T10:30:00Z',
              },
            ],
          },
        ],
        user_summary: {
          total_portfolio_value_usd: '9075.00',
          total_user_positions: 1,
          total_vaults_with_stakes: 1,
          total_user_staked_ilv: '200.50',
          total_user_staked_ilv_eth: '0',
          total_user_earned_shards: '6400',
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingPositionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserPositions(mockWalletAddress, {});

      expect(result).toEqual(mockResponse);
      expect(getUserStakingPositionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        page: 1,
        limit: 10,
        search: undefined,
      });
    });

    it('should return positions filtered by vault_id', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          chain: 'base',
        },
        vaults: [
          {
            vault_id: 'ilv_vault',
            vault_name: 'ILV',
            underlying_asset_ticker: 'ILV',
            vault_address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
            underlying_asset_address:
              '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            chain: 'base',
            token_icons: {
              primary:
                'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
              secondary: null,
            },
            tvl: '$100.00M',
            tvl_raw: '100000000.00',
            vault_size: '2200.00',
            token_price: '9.56',
            '24h_change': '+2.4%',
            shards_rate: '80',
            userHasStake: true,
            user_total_staked: '200.50',
            user_total_staked_raw: '200500000000000000000',
            user_active_positions_count: 0,
            user_total_earned_shards: '0',
            underlying_asset_balance_in_wallet: '0',
            underlying_asset_balance_in_wallet_raw: '0',
            positions: [],
          },
        ],
        user_summary: {
          total_portfolio_value_usd: '0',
          total_user_positions: 0,
          total_vaults_with_stakes: 1,
          total_user_staked_ilv: '200.50',
          total_user_staked_ilv_eth: '0',
          total_user_earned_shards: '0',
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingPositionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserPositions(mockWalletAddress, {
        vault_id: mockVaultId,
      });

      expect(result).toEqual(mockResponse);
      expect(getUserStakingPositionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: mockVaultId,
        page: 1,
        limit: 10,
        search: undefined,
      });
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          chain: 'base',
        },
        vaults: [],
        user_summary: {
          total_portfolio_value_usd: '0',
          total_user_positions: 0,
          total_vaults_with_stakes: 0,
          total_user_staked_ilv: '0',
          total_user_staked_ilv_eth: '0',
          total_user_earned_shards: '0',
        },
        pagination: {
          page: 2,
          limit: 20,
          total: 50,
          total_pages: 3,
          has_next: true,
          has_previous: true,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingPositionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserPositions(mockWalletAddress, {
        page: 2,
        limit: 20,
      });

      expect(result).toEqual(mockResponse);
      expect(getUserStakingPositionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        page: 2,
        limit: 20,
        search: undefined,
      });
    });

    it('should handle search parameter', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          chain: 'base',
        },
        vaults: [],
        user_summary: {
          total_portfolio_value_usd: '0',
          total_user_positions: 0,
          total_vaults_with_stakes: 0,
          total_user_staked_ilv: '0',
          total_user_staked_ilv_eth: '0',
          total_user_earned_shards: '0',
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };
      getUserStakingPositionsUseCase.execute.mockResolvedValue(mockResponse);

      await controller.getUserPositions(mockWalletAddress, {
        search: 'ILV',
      });

      expect(getUserStakingPositionsUseCase.execute).toHaveBeenCalledWith({
        walletAddress: checksumAddress,
        vaultId: undefined,
        page: 1,
        limit: 10,
        search: 'ILV',
      });
    });

    it('should validate wallet address format', async () => {
      const invalidAddress = '0xinvalid';

      await expect(
        controller.getUserPositions(invalidAddress, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty positions gracefully', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          chain: 'base',
        },
        vaults: [],
        user_summary: {
          total_portfolio_value_usd: '0',
          total_user_positions: 0,
          total_vaults_with_stakes: 0,
          total_user_staked_ilv: '0',
          total_user_staked_ilv_eth: '0',
          total_user_earned_shards: '0',
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingPositionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserPositions(mockWalletAddress, {});

      expect(result).toEqual(mockResponse);
      expect(result.vaults).toEqual([]);
      expect(result.user_summary.total_user_positions).toBe(0);
    });

    it('should handle LP token vaults correctly', async () => {
      const mockResponse = {
        wallet: mockWalletAddress,
        current_season: {
          season_id: 1,
          season_name: 'Season 1',
          chain: 'base',
        },
        vaults: [
          {
            vault_id: 'ilv_eth_vault',
            vault_name: 'ILV/ETH',
            underlying_asset_ticker: 'ILV/ETH LP Token',
            vault_address: '0x853e4A8C1C7B9A4F5D6E9C8B7A5F2E1D0C9B8A7E',
            underlying_asset_address:
              '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
            chain: 'base',
            token_icons: {
              primary:
                'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
              secondary:
                'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
            },
            tvl: '$85.00M',
            tvl_raw: '85000000.00',
            vault_size: '1000.00',
            token_price: '1500.00',
            '24h_change': '+1.8%',
            shards_rate: '20',
            userHasStake: true,
            user_total_staked: '179.50',
            user_total_staked_raw: '179500000000000000000',
            user_active_positions_count: 0,
            user_total_earned_shards: '0',
            underlying_asset_balance_in_wallet: '0',
            underlying_asset_balance_in_wallet_raw: '0',
            positions: [],
          },
        ],
        user_summary: {
          total_portfolio_value_usd: '0',
          total_user_positions: 0,
          total_vaults_with_stakes: 1,
          total_user_staked_ilv: '0',
          total_user_staked_ilv_eth: '179.50',
          total_user_earned_shards: '0',
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
        last_updated: new Date().toISOString(),
      };

      getUserStakingPositionsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getUserPositions(mockWalletAddress, {});

      expect(result.vaults[0].token_icons.secondary).toBeTruthy();
      expect(result.vaults[0].underlying_asset_ticker).toContain('LP Token');
    });

    it('should handle use case errors appropriately', async () => {
      getUserStakingPositionsUseCase.execute.mockRejectedValue(
        new Error('Subgraph unavailable'),
      );

      await expect(
        controller.getUserPositions(mockWalletAddress, {}),
      ).rejects.toThrow('Subgraph unavailable');
    });

    it('should enforce maximum limit constraint', async () => {
      await expect(
        controller.getUserPositions(mockWalletAddress, { limit: 101 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce minimum page constraint', async () => {
      await expect(
        controller.getUserPositions(mockWalletAddress, { page: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
