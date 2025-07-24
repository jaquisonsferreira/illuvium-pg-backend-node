import { Test, TestingModule } from '@nestjs/testing';
import { ManageReferralUseCase } from './manage-referral.use-case';
import { IReferralRepository } from '../../domain/repositories/referral.repository.interface';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { ReferralEntity } from '../../domain/entities/referral.entity';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';
import { REFERRAL_CONFIG } from '../../constants';

describe('ManageReferralUseCase', () => {
  let useCase: ManageReferralUseCase;
  let referralRepository: jest.Mocked<IReferralRepository>;
  let shardBalanceRepository: jest.Mocked<IShardBalanceRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManageReferralUseCase,
        {
          provide: 'IReferralRepository',
          useValue: {
            findByReferrerAndSeason: jest.fn(),
            findByRefereeAndSeason: jest.fn(),
            findActiveByReferrer: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            countByReferrerAndSeason: jest.fn(),
            getTotalReferralShardsByReferrer: jest.fn(),
          },
        },
        {
          provide: 'IShardBalanceRepository',
          useValue: {
            findByWalletAndSeason: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<ManageReferralUseCase>(ManageReferralUseCase);
    referralRepository = module.get('IReferralRepository');
    shardBalanceRepository = module.get('IShardBalanceRepository');
  });

  describe('createReferral', () => {
    const referrerAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const refereeAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
    const seasonId = 1;

    it('should create a new referral successfully', async () => {
      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);
      referralRepository.countByReferrerAndSeason.mockResolvedValue(0);
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(null);
      referralRepository.create.mockImplementation(
        async (referral) => referral,
      );

      const result = await useCase.createReferral({
        referrerAddress,
        refereeAddress,
        seasonId,
      });

      expect(result).toMatchObject({
        referrerAddress: referrerAddress.toLowerCase(),
        refereeAddress: refereeAddress.toLowerCase(),
        seasonId,
        status: 'pending',
        totalShardsEarned: 0,
      });

      expect(referralRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referrerAddress: referrerAddress.toLowerCase(),
          refereeAddress: refereeAddress.toLowerCase(),
          seasonId,
          status: 'pending',
        }),
      );
    });

    it('should throw error if referee already has a referral', async () => {
      const existingReferral = ReferralEntity.create({
        referrerAddress: '0xother',
        refereeAddress,
        seasonId,
      });

      referralRepository.findByRefereeAndSeason.mockResolvedValue(
        existingReferral,
      );

      await expect(
        useCase.createReferral({
          referrerAddress,
          refereeAddress,
          seasonId,
        }),
      ).rejects.toThrow('Referee already has a referral for this season');
    });

    it('should throw error if referrer has reached limit', async () => {
      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);
      referralRepository.countByReferrerAndSeason.mockResolvedValue(
        REFERRAL_CONFIG.MAX_REFERRALS_PER_WALLET,
      );

      await expect(
        useCase.createReferral({
          referrerAddress,
          refereeAddress,
          seasonId,
        }),
      ).rejects.toThrow(
        `Referrer has reached the maximum referral limit of ${REFERRAL_CONFIG.MAX_REFERRALS_PER_WALLET}`,
      );
    });

    it('should throw error if referee already has shard earnings', async () => {
      const existingBalance = new ShardBalanceEntity(
        '1',
        refereeAddress,
        seasonId,
        10,
        20,
        30,
        40,
        100,
        new Date(),
        new Date(),
        new Date(),
      );

      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);
      referralRepository.countByReferrerAndSeason.mockResolvedValue(0);
      shardBalanceRepository.findByWalletAndSeason.mockResolvedValue(
        existingBalance,
      );

      await expect(
        useCase.createReferral({
          referrerAddress,
          refereeAddress,
          seasonId,
        }),
      ).rejects.toThrow(
        'Referee already has shard earnings and cannot be referred',
      );
    });

    it('should throw error if referrer tries to self-refer', async () => {
      await expect(
        useCase.createReferral({
          referrerAddress,
          refereeAddress: referrerAddress,
          seasonId,
        }),
      ).rejects.toThrow('Cannot refer yourself');
    });
  });

  describe('getReferralInfo', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const seasonId = 1;

    it('should return referral info with active referee bonus', async () => {
      const activationDate = new Date();
      activationDate.setDate(activationDate.getDate() - 10); // 10 days ago

      const refereeReferral = ReferralEntity.create({
        referrerAddress: '0xreferrer',
        refereeAddress: walletAddress,
        seasonId,
      }).activate(100);

      // Mock the referral to have proper activation date
      Object.defineProperty(refereeReferral, 'activationDate', {
        value: activationDate,
        writable: false,
      });

      referralRepository.countByReferrerAndSeason.mockResolvedValue(5);
      referralRepository.getTotalReferralShardsByReferrer.mockResolvedValue(
        500,
      );
      referralRepository.findByRefereeAndSeason.mockResolvedValue(
        refereeReferral,
      );

      const result = await useCase.getReferralInfo({ walletAddress, seasonId });

      expect(result.referralsMade).toBe(5);
      expect(result.totalReferralShards).toBe(500);
      expect(result.referredBy).toBe('0xreferrer');
      expect(result.refereeBonusActive).toBe(true);
      expect(result.refereeBonusExpires).toBeDefined();
    });

    it('should return info with no referee bonus', async () => {
      referralRepository.countByReferrerAndSeason.mockResolvedValue(3);
      referralRepository.getTotalReferralShardsByReferrer.mockResolvedValue(
        300,
      );
      referralRepository.findByRefereeAndSeason.mockResolvedValue(null);

      const result = await useCase.getReferralInfo({ walletAddress, seasonId });

      expect(result.referralsMade).toBe(3);
      expect(result.totalReferralShards).toBe(300);
      expect(result.referredBy).toBeNull();
      expect(result.refereeBonusActive).toBe(false);
      expect(result.refereeBonusExpires).toBeNull();
    });

    it('should show expired referee bonus', async () => {
      const activationDate = new Date();
      activationDate.setDate(activationDate.getDate() - 40); // 40 days ago

      const refereeReferral = ReferralEntity.create({
        referrerAddress: '0xreferrer',
        refereeAddress: walletAddress,
        seasonId,
      }).activate(100);

      // Mock the referral to have old activation date
      Object.defineProperty(refereeReferral, 'activationDate', {
        value: activationDate,
        writable: false,
      });
      Object.defineProperty(refereeReferral, 'refereeMultiplierExpires', {
        value: new Date(activationDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        writable: false,
      });

      referralRepository.countByReferrerAndSeason.mockResolvedValue(0);
      referralRepository.getTotalReferralShardsByReferrer.mockResolvedValue(0);
      referralRepository.findByRefereeAndSeason.mockResolvedValue(
        refereeReferral,
      );

      const result = await useCase.getReferralInfo({ walletAddress, seasonId });

      expect(result.refereeBonusActive).toBe(false);
      expect(result.refereeBonusExpires).toBeDefined();
    });
  });

  describe('getActiveReferrals', () => {
    const referrerAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const seasonId = 1;

    it('should return active referrals with shard balances', async () => {
      const referrals = [
        ReferralEntity.create({
          referrerAddress,
          refereeAddress: '0xref1',
          seasonId,
        }).activate(100),
        ReferralEntity.create({
          referrerAddress,
          refereeAddress: '0xref2',
          seasonId,
        }),
      ];

      const balance1 = new ShardBalanceEntity(
        '1',
        '0xref1',
        seasonId,
        50,
        20,
        30,
        0,
        100,
        new Date(),
        new Date(),
        new Date(),
      );

      referralRepository.findByReferrerAndSeason.mockResolvedValue(referrals);
      shardBalanceRepository.findByWalletAndSeason
        .mockResolvedValueOnce(balance1)
        .mockResolvedValueOnce(null);

      const result = await useCase.getActiveReferrals({
        referrerAddress,
        seasonId,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        wallet: '0xref1',
        status: 'active',
        shardsEarned: 0, // totalShardsEarned from the referral entity
      });
      expect(result[1]).toMatchObject({
        wallet: '0xref2',
        status: 'pending',
        shardsEarned: 0,
      });
    });

    it('should handle empty referrals', async () => {
      referralRepository.findByReferrerAndSeason.mockResolvedValue([]);

      const result = await useCase.getActiveReferrals({
        referrerAddress,
        seasonId,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('getReferralStats', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const seasonId = 1;

    it('should return detailed referral statistics', async () => {
      const referrals = [
        ReferralEntity.create({
          referrerAddress: walletAddress,
          refereeAddress: '0xref1',
          seasonId,
        })
          .activate(100)
          .addEarnedShards(50),
        ReferralEntity.create({
          referrerAddress: walletAddress,
          refereeAddress: '0xref2',
          seasonId,
        }),
      ];

      referralRepository.findByReferrerAndSeason.mockResolvedValue(referrals);

      // Mock the getTotalReferralShardsByReferrer to return the sum
      referralRepository.getTotalReferralShardsByReferrer.mockResolvedValue(50);

      const result = await useCase.getReferralStats({
        walletAddress,
        seasonId,
      });

      expect(result.totalReferrals).toBe(2);
      expect(result.activeReferrals).toBe(1);
      expect(result.totalShardsEarned).toBe(50);
      expect(result.referrals).toHaveLength(2);
      expect(result.referrals[0]).toMatchObject({
        refereeAddress: '0xref1',
        status: 'active',
        shardsContributed: 50,
        isWithinBonusPeriod: true,
      });
      expect(result.referrals[1]).toMatchObject({
        refereeAddress: '0xref2',
        status: 'pending',
        shardsContributed: 0,
        isWithinBonusPeriod: false,
      });
    });

    it('should handle no referrals', async () => {
      referralRepository.findByReferrerAndSeason.mockResolvedValue([]);
      referralRepository.getTotalReferralShardsByReferrer.mockResolvedValue(0);

      const result = await useCase.getReferralStats({
        walletAddress,
        seasonId,
      });

      expect(result.totalReferrals).toBe(0);
      expect(result.activeReferrals).toBe(0);
      expect(result.totalShardsEarned).toBe(0);
      expect(result.referrals).toHaveLength(0);
    });
  });
});
