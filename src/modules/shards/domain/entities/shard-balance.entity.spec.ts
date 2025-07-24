import { ShardBalanceEntity } from './shard-balance.entity';

describe('ShardBalanceEntity', () => {
  const validWallet = '0x1234567890abcdef1234567890abcdef12345678';

  describe('create', () => {
    it('should create a new shard balance with zero values', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
      };

      const balance = ShardBalanceEntity.create(params);

      expect(balance.id).toBeDefined();
      expect(balance.walletAddress).toBe(validWallet.toLowerCase());
      expect(balance.seasonId).toBe(1);
      expect(balance.stakingShards).toBe(0);
      expect(balance.socialShards).toBe(0);
      expect(balance.developerShards).toBe(0);
      expect(balance.referralShards).toBe(0);
      expect(balance.totalShards).toBe(0);
      expect(balance.lastCalculatedAt).toBeInstanceOf(Date);
      expect(balance.createdAt).toBeInstanceOf(Date);
      expect(balance.updatedAt).toBeInstanceOf(Date);
    });

    it('should create with initial shard values', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
      };

      const balance = ShardBalanceEntity.create(params);

      expect(balance.stakingShards).toBe(100);
      expect(balance.socialShards).toBe(50);
      expect(balance.developerShards).toBe(75);
      expect(balance.referralShards).toBe(25);
      expect(balance.totalShards).toBe(250);
    });

    it('should convert wallet address to lowercase', () => {
      const params = {
        walletAddress: validWallet.toUpperCase(),
        seasonId: 1,
      };

      const balance = ShardBalanceEntity.create(params);

      expect(balance.walletAddress).toBe(validWallet.toLowerCase());
    });

    it('should calculate total shards correctly', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        stakingShards: 100,
        socialShards: 200,
        developerShards: 300,
        referralShards: 400,
      };

      const balance = ShardBalanceEntity.create(params);

      expect(balance.totalShards).toBe(1000);
    });
  });

  describe('addShards', () => {
    let balance: ShardBalanceEntity;

    beforeEach(() => {
      balance = ShardBalanceEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
      });
    });

    it('should add staking shards', () => {
      const updated = balance.addShards('staking', 50);

      expect(updated.stakingShards).toBe(150);
      expect(updated.totalShards).toBe(300);
      expect(updated.lastCalculatedAt).toBeInstanceOf(Date);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should add social shards', () => {
      const updated = balance.addShards('social', 30);

      expect(updated.socialShards).toBe(80);
      expect(updated.totalShards).toBe(280);
    });

    it('should add developer shards', () => {
      const updated = balance.addShards('developer', 25);

      expect(updated.developerShards).toBe(100);
      expect(updated.totalShards).toBe(275);
    });

    it('should add referral shards', () => {
      const updated = balance.addShards('referral', 15);

      expect(updated.referralShards).toBe(40);
      expect(updated.totalShards).toBe(265);
    });

    it('should preserve other values when adding shards', () => {
      const updated = balance.addShards('staking', 50);

      expect(updated.id).toBe(balance.id);
      expect(updated.walletAddress).toBe(balance.walletAddress);
      expect(updated.seasonId).toBe(balance.seasonId);
      expect(updated.socialShards).toBe(balance.socialShards);
      expect(updated.developerShards).toBe(balance.developerShards);
      expect(updated.referralShards).toBe(balance.referralShards);
      expect(updated.createdAt).toEqual(balance.createdAt);
    });

    it('should handle adding zero shards', () => {
      const updated = balance.addShards('staking', 0);

      expect(updated.stakingShards).toBe(100);
      expect(updated.totalShards).toBe(250);
    });

    it('should handle negative values (deduction)', () => {
      const updated = balance.addShards('staking', -50);

      expect(updated.stakingShards).toBe(50);
      expect(updated.totalShards).toBe(200);
    });
  });

  describe('recalculateTotal', () => {
    it('should recalculate total from all categories', () => {
      const balance = new ShardBalanceEntity(
        'test-id',
        validWallet,
        1,
        100,
        200,
        300,
        400,
        500, // Wrong total
        new Date(),
        new Date(),
        new Date(),
      );

      const recalculated = balance.recalculateTotal();

      expect(recalculated.totalShards).toBe(1000);
      expect(recalculated.lastCalculatedAt).toBeInstanceOf(Date);
      expect(recalculated.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle zero values', () => {
      const balance = ShardBalanceEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
      });

      const recalculated = balance.recalculateTotal();

      expect(recalculated.totalShards).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize shard balance correctly', () => {
      const balance = new ShardBalanceEntity(
        'test-id',
        validWallet.toLowerCase(),
        1,
        100,
        50,
        75,
        25,
        250,
        new Date('2024-01-15T10:00:00Z'),
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-15T10:00:00Z'),
      );

      const json = balance.toJSON();

      expect(json).toEqual({
        id: 'test-id',
        walletAddress: validWallet.toLowerCase(),
        seasonId: 1,
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
        totalShards: 250,
        lastCalculatedAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle large shard values', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        stakingShards: 1000000000,
        socialShards: 2000000000,
        developerShards: 3000000000,
        referralShards: 4000000000,
      };

      const balance = ShardBalanceEntity.create(params);

      expect(balance.totalShards).toBe(10000000000);
    });

    it('should maintain immutability', () => {
      const balance = ShardBalanceEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        stakingShards: 100,
      });

      const updated = balance.addShards('staking', 50);

      expect(balance.stakingShards).toBe(100);
      expect(balance.totalShards).toBe(100);
      expect(updated.stakingShards).toBe(150);
      expect(updated.totalShards).toBe(150);
      expect(balance).not.toBe(updated);
    });
  });
});
