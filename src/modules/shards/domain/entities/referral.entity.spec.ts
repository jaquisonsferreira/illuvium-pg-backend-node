import { ReferralEntity } from './referral.entity';

describe('ReferralEntity', () => {
  const referrerWallet = '0x1234567890abcdef1234567890abcdef12345678';
  const refereeWallet = '0x9876543210fedcba9876543210fedcba98765432';

  describe('create', () => {
    it('should create a new pending referral', () => {
      const params = {
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      };

      const referral = ReferralEntity.create(params);

      expect(referral.id).toBeDefined();
      expect(referral.referrerAddress).toBe(referrerWallet.toLowerCase());
      expect(referral.refereeAddress).toBe(refereeWallet.toLowerCase());
      expect(referral.seasonId).toBe(1);
      expect(referral.status).toBe('pending');
      expect(referral.activationDate).toBeNull();
      expect(referral.refereeMultiplierExpires).toBeNull();
      expect(referral.totalShardsEarned).toBe(0);
      expect(referral.createdAt).toBeInstanceOf(Date);
      expect(referral.updatedAt).toBeInstanceOf(Date);
    });

    it('should convert wallet addresses to lowercase', () => {
      const params = {
        referrerAddress: referrerWallet.toUpperCase(),
        refereeAddress: refereeWallet.toUpperCase(),
        seasonId: 1,
      };

      const referral = ReferralEntity.create(params);

      expect(referral.referrerAddress).toBe(referrerWallet.toLowerCase());
      expect(referral.refereeAddress).toBe(refereeWallet.toLowerCase());
    });

    it('should throw error when referring yourself', () => {
      const params = {
        referrerAddress: referrerWallet,
        refereeAddress: referrerWallet,
        seasonId: 1,
      };

      expect(() => ReferralEntity.create(params)).toThrow(
        'Cannot refer yourself',
      );
    });

    it('should throw error when referring yourself with different case', () => {
      const params = {
        referrerAddress: referrerWallet.toLowerCase(),
        refereeAddress: referrerWallet.toUpperCase(),
        seasonId: 1,
      };

      expect(() => ReferralEntity.create(params)).toThrow(
        'Cannot refer yourself',
      );
    });
  });

  describe('activate', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should activate referral with sufficient referee shards', () => {
      const activated = referral.activate(100);

      expect(activated.status).toBe('active');
      expect(activated.activationDate).toBeInstanceOf(Date);
      expect(activated.refereeMultiplierExpires).toBeInstanceOf(Date);
      expect(activated.updatedAt).toBeInstanceOf(Date);
    });

    it('should set referee multiplier expiry 30 days from activation', () => {
      const activated = referral.activate(150);
      const expectedExpiry = new Date(activated.activationDate!);
      expectedExpiry.setDate(expectedExpiry.getDate() + 30);

      expect(activated.refereeMultiplierExpires?.getTime()).toBe(
        expectedExpiry.getTime(),
      );
    });

    it('should throw error when already activated', () => {
      const activated = referral.activate(100);

      expect(() => activated.activate(200)).toThrow(
        'Referral is already activated',
      );
    });

    it('should throw error when referee has insufficient shards', () => {
      expect(() => referral.activate(99)).toThrow(
        'Referee must earn at least 100 shards to activate referral',
      );
    });

    it('should throw error for expired referral', () => {
      const expired = referral.expire();

      expect(() => expired.activate(100)).toThrow(
        'Referral is already activated',
      );
    });
  });

  describe('expire', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should expire pending referral', () => {
      const expired = referral.expire();

      expect(expired.status).toBe('expired');
      expect(expired.updatedAt).toBeInstanceOf(Date);
    });

    it('should expire active referral', () => {
      const activated = referral.activate(100);
      const expired = activated.expire();

      expect(expired.status).toBe('expired');
      expect(expired.activationDate).toEqual(activated.activationDate);
      expect(expired.refereeMultiplierExpires).toEqual(
        activated.refereeMultiplierExpires,
      );
    });

    it('should return same instance if already expired', () => {
      const expired = referral.expire();
      const expiredAgain = expired.expire();

      expect(expiredAgain).toBe(expired);
    });
  });

  describe('status methods', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should correctly identify pending referral', () => {
      expect(referral.isPending()).toBe(true);
      expect(referral.isActive()).toBe(false);
      expect(referral.isExpired()).toBe(false);
    });

    it('should correctly identify active referral', () => {
      const activated = referral.activate(100);

      expect(activated.isPending()).toBe(false);
      expect(activated.isActive()).toBe(true);
      expect(activated.isExpired()).toBe(false);
    });

    it('should correctly identify expired referral', () => {
      const expired = referral.expire();

      expect(expired.isPending()).toBe(false);
      expect(expired.isActive()).toBe(false);
      expect(expired.isExpired()).toBe(true);
    });
  });

  describe('isWithinBonusPeriod', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should return false for pending referral', () => {
      expect(referral.isWithinBonusPeriod()).toBe(false);
    });

    it('should return true for recently activated referral', () => {
      const activated = referral.activate(100);

      expect(activated.isWithinBonusPeriod()).toBe(true);
    });

    it('should return false for expired bonus period', () => {
      // Create a referral with expired bonus period
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      const expiredBonusReferral = new ReferralEntity(
        'test-id',
        referrerWallet,
        refereeWallet,
        1,
        'active',
        new Date(),
        expiredDate,
        0,
        new Date(),
        new Date(),
      );

      expect(expiredBonusReferral.isWithinBonusPeriod()).toBe(false);
    });
  });

  describe('addEarnedShards', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should add earned shards', () => {
      const updated = referral.addEarnedShards(50);

      expect(updated.totalShardsEarned).toBe(50);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should accumulate earned shards', () => {
      const first = referral.addEarnedShards(50);
      const second = first.addEarnedShards(30);

      expect(second.totalShardsEarned).toBe(80);
    });

    it('should throw error for negative shards', () => {
      expect(() => referral.addEarnedShards(-10)).toThrow(
        'Cannot add negative shards',
      );
    });

    it('should handle zero shards', () => {
      const updated = referral.addEarnedShards(0);

      expect(updated.totalShardsEarned).toBe(0);
    });
  });

  describe('getReferrerBonusRate', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should return 0 for pending referral', () => {
      expect(referral.getReferrerBonusRate()).toBe(0);
    });

    it('should return 0.2 for active referral', () => {
      const activated = referral.activate(100);

      expect(activated.getReferrerBonusRate()).toBe(0.2);
    });

    it('should return 0 for expired referral', () => {
      const expired = referral.expire();

      expect(expired.getReferrerBonusRate()).toBe(0);
    });
  });

  describe('getRefereeMultiplier', () => {
    let referral: ReferralEntity;

    beforeEach(() => {
      referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
    });

    it('should return 1 for pending referral', () => {
      expect(referral.getRefereeMultiplier()).toBe(1);
    });

    it('should return 1.2 within bonus period', () => {
      const activated = referral.activate(100);

      expect(activated.getRefereeMultiplier()).toBe(1.2);
    });

    it('should return 1 after bonus period', () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      const expiredBonusReferral = new ReferralEntity(
        'test-id',
        referrerWallet,
        refereeWallet,
        1,
        'active',
        new Date(),
        expiredDate,
        0,
        new Date(),
        new Date(),
      );

      expect(expiredBonusReferral.getRefereeMultiplier()).toBe(1);
    });
  });

  describe('toJSON', () => {
    it('should serialize pending referral correctly', () => {
      const referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });

      const json = referral.toJSON();

      expect(json).toMatchObject({
        id: referral.id,
        referrerAddress: referrerWallet.toLowerCase(),
        refereeAddress: refereeWallet.toLowerCase(),
        seasonId: 1,
        status: 'pending',
        activationDate: null,
        refereeMultiplierExpires: null,
        totalShardsEarned: 0,
        isWithinBonusPeriod: false,
        createdAt: referral.createdAt,
        updatedAt: referral.updatedAt,
      });
    });

    it('should serialize active referral correctly', () => {
      const referral = ReferralEntity.create({
        referrerAddress: referrerWallet,
        refereeAddress: refereeWallet,
        seasonId: 1,
      });
      const activated = referral.activate(100).addEarnedShards(50);

      const json = activated.toJSON();

      expect(json.status).toBe('active');
      expect(json.activationDate).toBeInstanceOf(Date);
      expect(json.refereeMultiplierExpires).toBeInstanceOf(Date);
      expect(json.totalShardsEarned).toBe(50);
      expect(json.isWithinBonusPeriod).toBe(true);
    });
  });
});
