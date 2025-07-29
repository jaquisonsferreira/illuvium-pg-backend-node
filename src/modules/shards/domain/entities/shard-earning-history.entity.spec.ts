import {
  ShardEarningHistoryEntity,
  VaultBreakdown,
} from './shard-earning-history.entity';

describe('ShardEarningHistoryEntity', () => {
  const validWallet = '0x1234567890abcdef1234567890abcdef12345678';
  const mockVaultBreakdown: VaultBreakdown[] = [
    {
      vaultId: 'vault-1',
      asset: 'ETH',
      chain: 'ethereum',
      shardsEarned: 50,
      usdValue: 1500,
    },
    {
      vaultId: 'vault-2',
      asset: 'USDC',
      chain: 'ethereum',
      shardsEarned: 30,
      usdValue: 300,
    },
  ];

  describe('create', () => {
    it('should create earning history with zero values', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15T12:30:00Z'),
      };

      const history = ShardEarningHistoryEntity.create(params);

      expect(history.id).toBeDefined();
      expect(history.walletAddress).toBe(validWallet.toLowerCase());
      expect(history.seasonId).toBe(1);
      expect(history.stakingShards).toBe(0);
      expect(history.socialShards).toBe(0);
      expect(history.developerShards).toBe(0);
      expect(history.referralShards).toBe(0);
      expect(history.dailyTotal).toBe(0);
      expect(history.vaultBreakdown).toEqual([]);
      expect(history.metadata).toEqual({});
      expect(history.createdAt).toBeInstanceOf(Date);
    });

    it('should normalize date to start of day UTC', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15T15:45:30Z'),
      };

      const history = ShardEarningHistoryEntity.create(params);

      expect(history.date.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should create with shard values', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
      };

      const history = ShardEarningHistoryEntity.create(params);

      expect(history.stakingShards).toBe(100);
      expect(history.socialShards).toBe(50);
      expect(history.developerShards).toBe(75);
      expect(history.referralShards).toBe(25);
      expect(history.dailyTotal).toBe(250);
    });

    it('should create with vault breakdown', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        stakingShards: 80,
        vaultBreakdown: mockVaultBreakdown,
      };

      const history = ShardEarningHistoryEntity.create(params);

      expect(history.vaultBreakdown).toEqual(mockVaultBreakdown);
      expect(history.stakingShards).toBe(80);
    });

    it('should create with metadata', () => {
      const metadata = {
        processed: true,
        source: 'daily-job',
        version: 1,
      };

      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        metadata,
      };

      const history = ShardEarningHistoryEntity.create(params);

      expect(history.metadata).toEqual(metadata);
    });

    it('should convert wallet address to lowercase', () => {
      const params = {
        walletAddress: validWallet.toUpperCase(),
        seasonId: 1,
        date: new Date('2024-01-15'),
      };

      const history = ShardEarningHistoryEntity.create(params);

      expect(history.walletAddress).toBe(validWallet.toLowerCase());
    });
  });

  describe('hasEarnings', () => {
    it('should return false for zero earnings', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
      });

      expect(history.hasEarnings()).toBe(false);
    });

    it('should return true for positive earnings', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        stakingShards: 10,
      });

      expect(history.hasEarnings()).toBe(true);
    });
  });

  describe('getDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15T15:30:00Z'),
      });

      expect(history.getDateString()).toBe('2024-01-15');
    });
  });

  describe('getVaultBreakdownByAsset', () => {
    let history: ShardEarningHistoryEntity;

    beforeEach(() => {
      history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        vaultBreakdown: mockVaultBreakdown,
      });
    });

    it('should return vault breakdown for existing asset', () => {
      const ethVault = history.getVaultBreakdownByAsset('ETH');

      expect(ethVault).toEqual({
        vaultId: 'vault-1',
        asset: 'ETH',
        chain: 'ethereum',
        shardsEarned: 50,
        usdValue: 1500,
      });
    });

    it('should return undefined for non-existing asset', () => {
      const btcVault = history.getVaultBreakdownByAsset('BTC');

      expect(btcVault).toBeUndefined();
    });
  });

  describe('getTotalVaultShards', () => {
    it('should return sum of vault shards', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        vaultBreakdown: mockVaultBreakdown,
      });

      expect(history.getTotalVaultShards()).toBe(80); // 50 + 30
    });

    it('should return zero for empty vault breakdown', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
      });

      expect(history.getTotalVaultShards()).toBe(0);
    });
  });

  describe('getTotalUsdValue', () => {
    it('should return sum of USD values', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        vaultBreakdown: mockVaultBreakdown,
      });

      expect(history.getTotalUsdValue()).toBe(1800); // 1500 + 300
    });

    it('should return zero for empty vault breakdown', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
      });

      expect(history.getTotalUsdValue()).toBe(0);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should return category breakdown', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
      });

      const breakdown = history.getCategoryBreakdown();

      expect(breakdown).toEqual({
        staking: 100,
        social: 50,
        developer: 75,
        referral: 25,
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize earning history correctly', () => {
      const history = new ShardEarningHistoryEntity(
        'test-id',
        validWallet.toLowerCase(),
        1,
        new Date('2024-01-15T00:00:00.000Z'),
        100,
        50,
        75,
        25,
        250,
        mockVaultBreakdown,
        { processed: true },
        new Date('2024-01-15T10:00:00Z'),
      );

      const json = history.toJSON();

      expect(json).toEqual({
        id: 'test-id',
        walletAddress: validWallet.toLowerCase(),
        seasonId: 1,
        date: '2024-01-15',
        stakingShards: 100,
        socialShards: 50,
        developerShards: 75,
        referralShards: 25,
        dailyTotal: 250,
        vaultBreakdown: mockVaultBreakdown,
        metadata: { processed: true },
        createdAt: new Date('2024-01-15T10:00:00Z'),
      });
    });

    it('should handle empty vault breakdown in JSON', () => {
      const history = ShardEarningHistoryEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        date: new Date('2024-01-15'),
        stakingShards: 100,
      });

      const json = history.toJSON();

      expect(json.vaultBreakdown).toEqual([]);
      expect(json.dailyTotal).toBe(100);
    });
  });
});
