import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { VaultsController } from './vaults.controller';
import { GetVaultsUseCase } from '../../application/use-cases/get-vaults.use-case';
import { GetVaultDetailsUseCase } from '../../application/use-cases/get-vault-details.use-case';
import { GetStakingStatsUseCase } from '../../application/use-cases/get-staking-stats.use-case';
import { GetVaultsQueryDto, VaultSortBy, SortOrder, VaultStatus } from '../dto/get-vaults-query.dto';
import { VaultListResponseDto } from '../dto/vault-list-response.dto';

describe('VaultsController', () => {
  let controller: VaultsController;
  let getVaultsUseCase: jest.Mocked<GetVaultsUseCase>;
  let getVaultDetailsUseCase: jest.Mocked<GetVaultDetailsUseCase>;
  let getStakingStatsUseCase: jest.Mocked<GetStakingStatsUseCase>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaultsController],
      providers: [
        {
          provide: GetVaultsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: GetVaultDetailsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: GetStakingStatsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VaultsController>(VaultsController);
    getVaultsUseCase = module.get(GetVaultsUseCase);
    getVaultDetailsUseCase = module.get(GetVaultDetailsUseCase);
    getStakingStatsUseCase = module.get(GetStakingStatsUseCase);
  });

  describe('getVaults', () => {
    it('should return vault list with default parameters', async () => {
      const mockResponse: VaultListResponseDto = {
        vaults: [
          {
            vault_id: 'ILV_vault_base',
            vault_address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
            name: 'Illuvium',
            underlying_asset: 'Illuvium',
            underlying_asset_ticker: 'ILV',
            underlying_asset_address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
            token_icons: {
              primary: 'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
              secondary: null,
            },
            chain: 'base',
            season_id: 1,
            status: 'active',
            staking_rewards: '250 Shards / $1,000',
            tvl: '125.00M',
            tvl_raw: '125000000.00',
            vault_size: '2,234.28 ILV',
            mechanics: {
              locked_until_mainnet: true,
              withdrawal_enabled: false,
              redeem_delay_days: null,
              minimum_deposit: '10.00',
              maximum_deposit: null,
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
        season_summary: {
          season_id: 1,
          chain: 'base',
          tvl: '125.00M',
          tvl_raw: '125000000.00',
          active_vaults: 1,
          volume_24h: '2.5M',
        },
      };

      getVaultsUseCase.execute.mockResolvedValue(mockResponse);

      const query: GetVaultsQueryDto = {};
      const result = await controller.getVaults(query);

      expect(result).toEqual(mockResponse);
      expect(getVaultsUseCase.execute).toHaveBeenCalledWith(query);
    });

    it('should handle query parameters correctly', async () => {
      const query: GetVaultsQueryDto = {
        asset: 'ILV',
        status: VaultStatus.ACTIVE,
        search: 'Illuvium',
        sort_by: VaultSortBy.TVL,
        sort_order: SortOrder.DESC,
        page: 2,
        limit: 20,
      };

      const mockResponse: VaultListResponseDto = {
        vaults: [],
        pagination: {
          page: 2,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: true,
        },
        season_summary: {
          season_id: 1,
          chain: 'base',
          tvl: '0',
          tvl_raw: '0',
          active_vaults: 0,
          volume_24h: '0',
        },
      };

      getVaultsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getVaults(query);

      expect(result).toEqual(mockResponse);
      expect(getVaultsUseCase.execute).toHaveBeenCalledWith(query);
    });
  });

  describe('getVaultDetails', () => {
    it('should return vault details without wallet address', async () => {
      const vaultId = 'ILV_vault_base';
      const mockResponse = {
        vault_id: vaultId,
        vault_address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        name: 'Illuvium Vault',
        user_position: null,
      };

      getVaultDetailsUseCase.execute.mockResolvedValue(mockResponse as any);

      const result = await controller.getVaultDetails(vaultId, undefined, '30d');

      expect(result).toEqual(mockResponse);
      expect(getVaultDetailsUseCase.execute).toHaveBeenCalledWith({
        vaultId,
        walletAddress: undefined,
        timeframe: '30d',
      });
    });

    it('should validate wallet address format', async () => {
      const vaultId = 'ILV_vault_base';
      const invalidWallet = 'invalid-address';

      await expect(
        controller.getVaultDetails(vaultId, invalidWallet, '30d'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate timeframe parameter', async () => {
      const vaultId = 'ILV_vault_base';
      const invalidTimeframe = 'invalid';

      await expect(
        controller.getVaultDetails(vaultId, undefined, invalidTimeframe),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle valid wallet address and return user position', async () => {
      const vaultId = 'ILV_vault_base';
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const mockResponse = {
        vault_id: vaultId,
        vault_address: '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
        name: 'Illuvium Vault',
        user_position: {
          wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
          underlying_asset_staked_balance: '100',
          underlying_asset_staked_balance_raw: '100000000000000000000',
          underlying_asset_balance_in_wallet: '50',
          underlying_asset_balance_in_wallet_raw: '50000000000000000000',
          underlying_balance_usd: '150000.00',
          pending_shards: '500',
          earned_shards: '2000',
          is_unstake_enabled: false,
        },
      };

      getVaultDetailsUseCase.execute.mockResolvedValue(mockResponse as any);

      const result = await controller.getVaultDetails(vaultId, walletAddress, '7d');

      expect(result).toEqual(mockResponse);
      expect(getVaultDetailsUseCase.execute).toHaveBeenCalledWith({
        vaultId,
        walletAddress: '0x1234567890AbcdEF1234567890aBcdef12345678', // checksummed
        timeframe: '7d',
      });
    });
  });

  describe('getStakingStats', () => {
    it('should return staking stats with default timeframe', async () => {
      const mockResponse = {
        season_id: 1,
        chain: 'base',
        tvl: '210.00M',
        tvl_raw: '210000000.00',
        volume_24h: '2.5M',
        active_vaults: 2,
        last_updated: '2025-01-15T12:00:00Z',
      };

      getStakingStatsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getStakingStats(undefined);

      expect(result).toEqual(mockResponse);
      expect(getStakingStatsUseCase.execute).toHaveBeenCalledWith({
        timeframe: '24h',
      });
    });

    it('should validate timeframe parameter', async () => {
      await expect(controller.getStakingStats('invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle 7d timeframe', async () => {
      const mockResponse = {
        season_id: 1,
        chain: 'base',
        tvl: '210.00M',
        tvl_raw: '210000000.00',
        volume_24h: '2.5M',
        volume_7d: '18.2M',
        active_vaults: 2,
        last_updated: '2025-01-15T12:00:00Z',
      };

      getStakingStatsUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.getStakingStats('7d');

      expect(result).toEqual(mockResponse);
      expect(getStakingStatsUseCase.execute).toHaveBeenCalledWith({
        timeframe: '7d',
      });
    });
  });
});