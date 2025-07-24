import { ShardCalculationDomainService } from './shard-calculation.domain-service';
import { SeasonEntity } from '../entities/season.entity';
import { ReferralEntity } from '../entities/referral.entity';
import { DeveloperActionType } from '../entities/developer-contribution.entity';
import {
  REFERRAL_CONFIG,
  KAITO_CONFIG,
  DEVELOPER_REWARDS,
} from '../../constants';

describe('ShardCalculationDomainService', () => {
  let service: ShardCalculationDomainService;
  let mockSeason: SeasonEntity;

  beforeEach(() => {
    service = new ShardCalculationDomainService();
    mockSeason = new SeasonEntity(
      1,
      'Season 1',
      'base',
      new Date('2024-01-01'),
      new Date('2024-12-31'),
      'active',
      {
        vaultRates: { usdc: 1, eth: 2, weth: 2 },
        socialConversionRate: 100,
        vaultLocked: false,
        withdrawalEnabled: true,
      },
      10,
      1000,
      new Date(),
      new Date(),
    );
  });

  describe('calculateStakingShards', () => {
    it('should calculate shards correctly for USDC with default lock', () => {
      const result = service.calculateStakingShards('usdc', 1000, mockSeason);
      expect(result).toBe(1); // 1x multiplier at 4 weeks
    });

    it('should calculate shards correctly for ETH with default lock', () => {
      const result = service.calculateStakingShards('eth', 1000, mockSeason);
      expect(result).toBe(2); // 2x rate, 1x multiplier
    });

    it('should apply lock multiplier correctly for 48 weeks', () => {
      const result = service.calculateStakingShards(
        'usdc',
        1000,
        mockSeason,
        48,
      );
      expect(result).toBe(2); // 1 base * 2x multiplier
    });

    it('should apply linear lock multiplier for 26 weeks', () => {
      const result = service.calculateStakingShards(
        'usdc',
        1000,
        mockSeason,
        26,
      );
      expect(result).toBe(1.5); // 1 base * 1.5x multiplier
    });

    it('should use minimum multiplier for lock < 4 weeks', () => {
      const result = service.calculateStakingShards(
        'usdc',
        1000,
        mockSeason,
        2,
      );
      expect(result).toBe(1); // 1x multiplier
    });

    it('should cap multiplier at 2x for lock > 48 weeks', () => {
      const result = service.calculateStakingShards(
        'usdc',
        1000,
        mockSeason,
        52,
      );
      expect(result).toBe(2); // Max 2x multiplier
    });

    it('should use default rate for unknown token', () => {
      const result = service.calculateStakingShards(
        'unknown',
        1000,
        mockSeason,
      );
      expect(result).toBe(100);
    });

    it('should return 0 for zero USD value', () => {
      const result = service.calculateStakingShards('usdc', 0, mockSeason);
      expect(result).toBe(0);
    });

    it('should return 0 for negative USD value', () => {
      const result = service.calculateStakingShards('usdc', -1000, mockSeason);
      expect(result).toBe(0);
    });

    it('should handle fractional shards with lock multiplier', () => {
      const result = service.calculateStakingShards(
        'usdc',
        500,
        mockSeason,
        48,
      );
      expect(result).toBe(1); // 0.5 base * 2x multiplier
    });

    it('should handle large USD values with lock multiplier', () => {
      const result = service.calculateStakingShards(
        'eth',
        1000000,
        mockSeason,
        48,
      );
      expect(result).toBe(4000); // 2000 base * 2x multiplier
    });
  });

  describe('calculateSocialShards', () => {
    it('should calculate social shards based on YAP points', () => {
      const result = service.calculateSocialShards(100, mockSeason);
      expect(result).toBe(100 / KAITO_CONFIG.YAP_TO_SHARD_RATE);
    });

    it('should handle zero YAP points', () => {
      const result = service.calculateSocialShards(0, mockSeason);
      expect(result).toBe(0);
    });

    it('should handle negative YAP points', () => {
      const result = service.calculateSocialShards(-100, mockSeason);
      expect(result).toBe(0);
    });

    it('should use custom conversion rate from season if available', () => {
      const customSeason = {
        ...mockSeason,
        getSocialConversionRate: () => 50,
      } as SeasonEntity;
      const result = service.calculateSocialShards(100, customSeason);
      expect(result).toBe(2);
    });

    it('should calculate fractional shards', () => {
      const result = service.calculateSocialShards(50, mockSeason);
      expect(result).toBe(50 / KAITO_CONFIG.YAP_TO_SHARD_RATE);
    });
  });

  describe('calculateDeveloperShards', () => {
    it('should return correct shards for SMART_CONTRACT_DEPLOY', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
      );
      expect(result).toBe(100);
    });

    it('should return correct shards for VERIFIED_CONTRACT', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.VERIFIED_CONTRACT,
      );
      expect(result).toBe(200);
    });

    it('should return correct shards for GITHUB_CONTRIBUTION', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.GITHUB_CONTRIBUTION,
      );
      expect(result).toBe(50);
    });

    it('should return correct shards for BUG_REPORT', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.BUG_REPORT,
      );
      expect(result).toBe(150);
    });

    it('should return correct shards for DOCUMENTATION', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.DOCUMENTATION,
      );
      expect(result).toBe(75);
    });

    it('should return correct shards for TOOL_DEVELOPMENT', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.TOOL_DEVELOPMENT,
      );
      expect(result).toBe(300);
    });

    it('should return correct shards for COMMUNITY_SUPPORT', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.COMMUNITY_SUPPORT,
      );
      expect(result).toBe(25);
    });

    it('should use DEVELOPER_REWARDS constants for new action types', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.DEPLOY_CONTRACT,
      );
      expect(result).toBe(DEVELOPER_REWARDS.DEPLOY_CONTRACT);
    });

    it('should use custom amount when provided', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.OTHER,
        500,
      );
      expect(result).toBe(500);
    });

    it('should return 0 for OTHER type without custom amount', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.OTHER,
      );
      expect(result).toBe(0);
    });

    it('should handle negative custom amount as 0', () => {
      const result = service.calculateDeveloperShards(
        DeveloperActionType.OTHER,
        -100,
      );
      expect(result).toBe(0);
    });
  });

  describe('calculateReferralBonus', () => {
    let mockReferral: ReferralEntity;

    beforeEach(() => {
      mockReferral = {
        isActive: jest.fn().mockReturnValue(true),
        isWithinBonusPeriod: jest.fn().mockReturnValue(true),
      } as any;
    });

    it('should calculate referrer bonus correctly', () => {
      const refereeShards = 1000;
      const result = service.calculateReferralBonus(
        refereeShards,
        mockReferral,
      );

      const expectedBonus = refereeShards * REFERRAL_CONFIG.REFERRER_BONUS_RATE;
      expect(result.referrerBonus).toBe(
        Math.min(
          expectedBonus,
          REFERRAL_CONFIG.MAX_REFERRER_BONUS_PER_REFERRAL,
        ),
      );
    });

    it('should apply referee multiplier within bonus period', () => {
      const result = service.calculateReferralBonus(1000, mockReferral);
      expect(result.refereeMultiplier).toBe(REFERRAL_CONFIG.REFEREE_MULTIPLIER);
    });

    it('should not apply referee multiplier outside bonus period', () => {
      (mockReferral.isWithinBonusPeriod as jest.Mock).mockReturnValue(false);
      const result = service.calculateReferralBonus(1000, mockReferral);
      expect(result.refereeMultiplier).toBe(1);
    });

    it('should return zero bonus for inactive referral', () => {
      (mockReferral.isActive as jest.Mock).mockReturnValue(false);
      const result = service.calculateReferralBonus(1000, mockReferral);
      expect(result.referrerBonus).toBe(0);
      expect(result.refereeMultiplier).toBe(1);
    });

    it('should cap referrer bonus at maximum', () => {
      const refereeShards = 1000000;
      const result = service.calculateReferralBonus(
        refereeShards,
        mockReferral,
      );
      expect(result.referrerBonus).toBe(
        REFERRAL_CONFIG.MAX_REFERRER_BONUS_PER_REFERRAL,
      );
    });

    it('should handle zero referee shards', () => {
      const result = service.calculateReferralBonus(0, mockReferral);
      expect(result.referrerBonus).toBe(0);
    });
  });

  describe('applyRefereeMultiplier', () => {
    it('should apply multiplier correctly', () => {
      const result = service.applyRefereeMultiplier(100, 2);
      expect(result).toBe(200);
    });

    it('should handle 1x multiplier', () => {
      const result = service.applyRefereeMultiplier(100, 1);
      expect(result).toBe(100);
    });

    it('should handle fractional multipliers', () => {
      const result = service.applyRefereeMultiplier(100, 1.5);
      expect(result).toBe(150);
    });

    it('should handle zero base amount', () => {
      const result = service.applyRefereeMultiplier(0, 2);
      expect(result).toBe(0);
    });
  });

  describe('calculateLockMultiplier', () => {
    it('should return 1x for 4 weeks lock', () => {
      const result = service.calculateLockMultiplier(4);
      expect(result).toBe(1);
    });

    it('should return 2x for 48 weeks lock', () => {
      const result = service.calculateLockMultiplier(48);
      expect(result).toBe(2);
    });

    it('should return 1.5x for 26 weeks lock', () => {
      const result = service.calculateLockMultiplier(26);
      expect(result).toBe(1.5);
    });

    it('should return 1x for lock < 4 weeks', () => {
      const result = service.calculateLockMultiplier(2);
      expect(result).toBe(1);
    });

    it('should return 2x for lock > 48 weeks', () => {
      const result = service.calculateLockMultiplier(52);
      expect(result).toBe(2);
    });

    it('should calculate linear interpolation correctly', () => {
      const result = service.calculateLockMultiplier(15);
      expect(result).toBeCloseTo(1.25, 2);
    });
  });

  describe('calculateTotalDailyShards', () => {
    it('should calculate total shards correctly without multiplier', () => {
      const params = {
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralBonus: 25,
      };

      const result = service.calculateTotalDailyShards(params);

      expect(result.stakingShards).toBe(100);
      expect(result.socialShards).toBe(50);
      expect(result.developerShards).toBe(75);
      expect(result.referralShards).toBe(25);
      expect(result.totalShards).toBe(250);
    });

    it('should apply referee multiplier to all categories except referral bonus', () => {
      const params = {
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralBonus: 25,
        refereeMultiplier: 2,
      };

      const result = service.calculateTotalDailyShards(params);

      expect(result.stakingShards).toBe(200);
      expect(result.socialShards).toBe(100);
      expect(result.developerShards).toBe(150);
      expect(result.referralShards).toBe(25);
      expect(result.totalShards).toBe(475);
    });

    it('should handle zero values', () => {
      const params = {
        stakingShards: 0,
        socialShards: 0,
        developerShards: 0,
        referralBonus: 0,
      };

      const result = service.calculateTotalDailyShards(params);

      expect(result.totalShards).toBe(0);
    });

    it('should handle fractional multiplier', () => {
      const params = {
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralBonus: 25,
        refereeMultiplier: 1.5,
      };

      const result = service.calculateTotalDailyShards(params);

      expect(result.stakingShards).toBe(150);
      expect(result.socialShards).toBe(75);
      expect(result.developerShards).toBe(112.5);
      expect(result.referralShards).toBe(25);
      expect(result.totalShards).toBe(362.5);
    });
  });

  describe('validateShardAmount', () => {
    it('should validate positive amounts within reasonable limits', () => {
      expect(service.validateShardAmount(100, 'staking')).toBe(true);
      expect(service.validateShardAmount(50, 'social')).toBe(true);
      expect(service.validateShardAmount(200, 'developer')).toBe(true);
      expect(service.validateShardAmount(100, 'referral')).toBe(true);
    });

    it('should reject negative amounts', () => {
      expect(service.validateShardAmount(-100, 'staking')).toBe(false);
      expect(service.validateShardAmount(-50, 'social')).toBe(false);
    });

    it('should reject amounts exceeding category limits', () => {
      expect(service.validateShardAmount(100001, 'staking')).toBe(false);
      expect(service.validateShardAmount(10001, 'social')).toBe(false);
      expect(service.validateShardAmount(5001, 'developer')).toBe(false);
      expect(service.validateShardAmount(501, 'referral')).toBe(false);
    });

    it('should handle unknown categories', () => {
      expect(service.validateShardAmount(100, 'unknown')).toBe(true);
    });
  });

  describe('roundShards', () => {
    it('should round to 2 decimal places', () => {
      expect(service.roundShards(10.123456)).toBe(10.12);
      expect(service.roundShards(10.126456)).toBe(10.13);
    });

    it('should handle whole numbers', () => {
      expect(service.roundShards(10)).toBe(10);
    });

    it('should handle numbers with 1 decimal place', () => {
      expect(service.roundShards(10.1)).toBe(10.1);
    });

    it('should handle very small numbers', () => {
      expect(service.roundShards(0.001)).toBe(0);
      expect(service.roundShards(0.005)).toBe(0.01);
    });

    it('should handle negative numbers', () => {
      expect(service.roundShards(-10.126)).toBe(-10.13);
    });
  });
});
