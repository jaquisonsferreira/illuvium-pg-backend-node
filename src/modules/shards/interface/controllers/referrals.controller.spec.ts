import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ManageReferralUseCase } from '../../application/use-cases/manage-referral.use-case';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';
import {
  SeasonEntity,
  SeasonConfig,
} from '../../domain/entities/season.entity';
import { ApiError } from '../dto';

describe('ReferralsController', () => {
  let controller: ReferralsController;
  let manageReferralUseCase: jest.Mocked<ManageReferralUseCase>;
  let manageSeasonUseCase: jest.Mocked<ManageSeasonUseCase>;

  const mockSeasonConfig: SeasonConfig = {
    vaultRates: { ETH: 100, USDC: 150 },
    socialConversionRate: 100,
    vaultLocked: false,
    withdrawalEnabled: true,
    redeemPeriodDays: 30,
  };

  const mockSeason = new SeasonEntity(
    1,
    'Season 1',
    'base',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    'active',
    mockSeasonConfig,
    1000,
    50000,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

  const mockReferralInfo = {
    referralsMade: 3,
    totalReferralShards: 150,
    referredBy: '0x9abcdef012345678abcdef012345678abcdef012',
    refereeBonusActive: true,
    refereeBonusExpires: '2024-02-15T00:00:00.000Z',
  };

  const mockActiveReferrals = [
    {
      wallet: '0x1111222233334444555566667777888899990000',
      referredDate: '2024-01-10T00:00:00.000Z',
      status: 'active',
      shardsEarned: 50,
    },
    {
      wallet: '0x2222333344445555666677778888999900001111',
      referredDate: '2024-01-15T00:00:00.000Z',
      status: 'active',
      shardsEarned: 100,
    },
  ];

  beforeEach(async () => {
    const mockManageReferralUseCase = {
      getReferralInfo: jest.fn(),
      getActiveReferrals: jest.fn(),
      createReferral: jest.fn(),
    };

    const mockManageSeasonUseCase = {
      getCurrentSeason: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralsController],
      providers: [
        {
          provide: ManageReferralUseCase,
          useValue: mockManageReferralUseCase,
        },
        {
          provide: ManageSeasonUseCase,
          useValue: mockManageSeasonUseCase,
        },
      ],
    }).compile();

    controller = module.get<ReferralsController>(ReferralsController);
    manageReferralUseCase = module.get(ManageReferralUseCase);
    manageSeasonUseCase = module.get(ManageSeasonUseCase);
  });

  describe('getReferrals', () => {
    const validWallet = '0x1234567890abcdef1234567890abcdef12345678';

    it('should return referral information successfully', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      manageReferralUseCase.getReferralInfo.mockResolvedValue(mockReferralInfo);
      manageReferralUseCase.getActiveReferrals.mockResolvedValue(
        mockActiveReferrals,
      );

      const result = await controller.getReferrals(validWallet, {});

      expect(manageReferralUseCase.getReferralInfo).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
      });
      expect(manageReferralUseCase.getActiveReferrals).toHaveBeenCalledWith({
        referrerAddress: validWallet,
        seasonId: 1,
      });
      expect(result).toEqual({
        wallet: validWallet,
        season_id: 1,
        referrals_made: 3,
        referrals_limit: expect.any(Number),
        total_referral_shards: 150,
        referred_by: '0x9abcdef012345678abcdef012345678abcdef012',
        referee_bonus_active: true,
        referee_bonus_expires: '2024-02-15T00:00:00.000Z',
        active_referrals: [
          {
            wallet: '0x1111222233334444555566667777888899990000',
            referred_date: '2024-01-10T00:00:00.000Z',
            status: 'active',
            shards_earned: 50,
          },
          {
            wallet: '0x2222333344445555666677778888999900001111',
            referred_date: '2024-01-15T00:00:00.000Z',
            status: 'active',
            shards_earned: 100,
          },
        ],
      });
    });

    it('should return referral info without referredBy and bonus expiry', async () => {
      const referralInfoWithoutRef = {
        referralsMade: 1,
        totalReferralShards: 50,
        referredBy: null,
        refereeBonusActive: false,
        refereeBonusExpires: null,
      };

      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      manageReferralUseCase.getReferralInfo.mockResolvedValue(
        referralInfoWithoutRef,
      );
      manageReferralUseCase.getActiveReferrals.mockResolvedValue([]);

      const result = await controller.getReferrals(validWallet, {});

      expect(result.referred_by).toBeUndefined();
      expect(result.referee_bonus_expires).toBeUndefined();
      expect(result.active_referrals).toEqual([]);
    });

    it('should use custom season from query', async () => {
      manageReferralUseCase.getReferralInfo.mockResolvedValue(mockReferralInfo);
      manageReferralUseCase.getActiveReferrals.mockResolvedValue([]);

      const query = { season: 2 };
      await controller.getReferrals(validWallet, query);

      expect(manageReferralUseCase.getReferralInfo).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 2,
      });
      expect(manageSeasonUseCase.getCurrentSeason).not.toHaveBeenCalled();
    });

    it('should validate season and chain combination', async () => {
      const query = { season: 1, chain: 'base' as any };
      manageReferralUseCase.getReferralInfo.mockResolvedValue(mockReferralInfo);
      manageReferralUseCase.getActiveReferrals.mockResolvedValue([]);

      await controller.getReferrals(validWallet, query);

      expect(manageReferralUseCase.getReferralInfo).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
      });
    });

    it('should throw error for invalid wallet address', async () => {
      const invalidWallet = 'invalid_wallet';

      await expect(controller.getReferrals(invalidWallet, {})).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error for invalid season-chain combination', async () => {
      const query = { season: 1, chain: 'arbitrum' as any };

      await expect(controller.getReferrals(validWallet, query)).rejects.toThrow(
        HttpException,
      );
    });

    it('should use default season when current season not found', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);
      manageReferralUseCase.getReferralInfo.mockResolvedValue(mockReferralInfo);
      manageReferralUseCase.getActiveReferrals.mockResolvedValue([]);

      await controller.getReferrals(validWallet, {});

      expect(manageReferralUseCase.getReferralInfo).toHaveBeenCalledWith({
        walletAddress: validWallet,
        seasonId: 1,
      });
    });

    it('should handle use case errors', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      manageReferralUseCase.getReferralInfo.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getReferrals(validWallet, {})).rejects.toThrow(
        'Database error',
      );
    });

    it('should transform ApiError to HttpException', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      const apiError = ApiError.invalidWalletAddress(validWallet);
      manageReferralUseCase.getReferralInfo.mockRejectedValue(apiError);

      await expect(controller.getReferrals(validWallet, {})).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createReferral', () => {
    const validReferee = '0x1234567890abcdef1234567890abcdef12345678';
    const validReferrer = '0x9abcdef012345678abcdef012345678abcdef012';

    it('should create referral successfully', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      manageReferralUseCase.createReferral.mockResolvedValue({
        id: '1',
        referrerAddress: validReferrer,
        refereeAddress: validReferee,
        seasonId: 1,
        isActive: true,
        activatedAt: new Date(),
        createdAt: new Date(),
      } as any);

      const body = { referral_code: validReferrer };
      const result = await controller.createReferral(validReferee, body);

      expect(manageReferralUseCase.createReferral).toHaveBeenCalledWith({
        referrerAddress: validReferrer,
        refereeAddress: validReferee,
        seasonId: 1,
      });
      expect(result).toEqual({
        success: true,
        message: 'Referral registered successfully',
        referee_bonus_expires: expect.any(String),
      });
      expect(new Date(result.referee_bonus_expires!)).toBeInstanceOf(Date);
    });

    it('should throw error for invalid referee wallet', async () => {
      const invalidWallet = 'invalid_wallet';
      const body = { referral_code: validReferrer };

      await expect(
        controller.createReferral(invalidWallet, body),
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for invalid referrer wallet', async () => {
      const body = { referral_code: 'invalid_referrer' };

      await expect(
        controller.createReferral(validReferee, body),
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for self-referral', async () => {
      const body = { referral_code: validReferee };

      await expect(
        controller.createReferral(validReferee, body),
      ).rejects.toThrow(ApiError);
    });

    it('should handle case-insensitive self-referral check', async () => {
      const body = { referral_code: validReferee.toUpperCase() };

      await expect(
        controller.createReferral(validReferee, body),
      ).rejects.toThrow(ApiError);
    });

    it('should handle use case errors', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);
      manageReferralUseCase.createReferral.mockRejectedValue(
        new Error('Referral already exists'),
      );

      const body = { referral_code: validReferrer };

      await expect(
        controller.createReferral(validReferee, body),
      ).rejects.toThrow(HttpException);
    });

    it('should re-throw ApiError without modification', async () => {
      const apiError = ApiError.invalidWalletAddress(validReferee);
      manageSeasonUseCase.getCurrentSeason.mockRejectedValue(apiError);

      const body = { referral_code: validReferrer };

      await expect(
        controller.createReferral(validReferee, body),
      ).rejects.toThrow(ApiError);
    });

    it('should re-throw HttpException without modification', async () => {
      const httpException = new HttpException('Test error', 400);
      manageSeasonUseCase.getCurrentSeason.mockRejectedValue(httpException);

      const body = { referral_code: validReferrer };

      await expect(
        controller.createReferral(validReferee, body),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('isValidWalletAddress', () => {
    it('should validate correct wallet addresses', () => {
      const validWallet = '0x1234567890abcdef1234567890abcdef12345678';
      const isValid = (controller as any).isValidWalletAddress(validWallet);
      expect(isValid).toBe(true);
    });

    it('should reject invalid wallet addresses', () => {
      const invalidWallets = [
        'invalid',
        '0x123',
        '1234567890abcdef1234567890abcdef12345678',
        '0x1234567890abcdef1234567890abcdef12345678x',
        '0xgggggggggggggggggggggggggggggggggggggggg',
      ];

      invalidWallets.forEach((wallet) => {
        const isValid = (controller as any).isValidWalletAddress(wallet);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('validateSeasonChain', () => {
    it('should allow valid season 1 chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(1, 'base'),
      ).not.toThrow();
      expect(() =>
        (controller as any).validateSeasonChain(1, 'ethereum'),
      ).not.toThrow();
    });

    it('should reject invalid season 1 chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(1, 'arbitrum'),
      ).toThrow();
      expect(() =>
        (controller as any).validateSeasonChain(1, 'optimism'),
      ).toThrow();
    });

    it('should validate season 2+ chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(2, 'o'),
      ).not.toThrow();
    });

    it('should reject invalid season 2+ chains', () => {
      expect(() =>
        (controller as any).validateSeasonChain(2, 'ethereum'),
      ).toThrow();
      expect(() =>
        (controller as any).validateSeasonChain(2, 'base'),
      ).toThrow();
    });
  });

  describe('getChainForSeason', () => {
    it('should return base for season 1', () => {
      const chain = (controller as any).getChainForSeason(1);
      expect(chain).toBe('base');
    });

    it('should return o for season 2+', () => {
      const chain = (controller as any).getChainForSeason(2);
      expect(chain).toBe('o');
    });
  });

  describe('getCurrentSeasonId', () => {
    it('should return current season id', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(mockSeason);

      const seasonId = await (controller as any).getCurrentSeasonId();

      expect(manageSeasonUseCase.getCurrentSeason).toHaveBeenCalledWith('base');
      expect(seasonId).toBe(1);
    });

    it('should return default season id when no current season', async () => {
      manageSeasonUseCase.getCurrentSeason.mockResolvedValue(null);

      const seasonId = await (controller as any).getCurrentSeasonId();

      expect(seasonId).toBe(1);
    });
  });
});
