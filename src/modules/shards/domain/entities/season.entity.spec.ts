import { SeasonEntity, SeasonConfig } from './season.entity';

describe('SeasonEntity', () => {
  const mockConfig: SeasonConfig = {
    vaultRates: { ETH: 100, USDC: 150, BTC: 200 },
    socialConversionRate: 100,
    vaultLocked: false,
    withdrawalEnabled: true,
    redeemPeriodDays: 30,
  };

  describe('create', () => {
    it('should create a new upcoming season', () => {
      const params = {
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      };

      const season = SeasonEntity.create(params);

      expect(season.id).toBe(1);
      expect(season.name).toBe('Season 1');
      expect(season.chain).toBe('base');
      expect(season.startDate).toEqual(new Date('2024-01-01'));
      expect(season.endDate).toBeNull();
      expect(season.status).toBe('upcoming');
      expect(season.config).toEqual(mockConfig);
      expect(season.totalParticipants).toBe(0);
      expect(season.totalShardsIssued).toBe(0);
      expect(season.createdAt).toBeInstanceOf(Date);
      expect(season.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('status methods', () => {
    it('should correctly identify upcoming season', () => {
      const season = SeasonEntity.create({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      });

      expect(season.isUpcoming()).toBe(true);
      expect(season.isActive()).toBe(false);
      expect(season.isCompleted()).toBe(false);
    });

    it('should correctly identify active season', () => {
      const season = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        null,
        'active',
        mockConfig,
        100,
        5000,
        new Date(),
        new Date(),
      );

      expect(season.isUpcoming()).toBe(false);
      expect(season.isActive()).toBe(true);
      expect(season.isCompleted()).toBe(false);
    });

    it('should correctly identify completed season', () => {
      const season = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        new Date('2024-03-31'),
        'completed',
        mockConfig,
        100,
        5000,
        new Date(),
        new Date(),
      );

      expect(season.isUpcoming()).toBe(false);
      expect(season.isActive()).toBe(false);
      expect(season.isCompleted()).toBe(true);
    });
  });

  describe('config getters', () => {
    let season: SeasonEntity;

    beforeEach(() => {
      season = SeasonEntity.create({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      });
    });

    it('should get vault rates', () => {
      expect(season.getVaultRates()).toEqual({
        ETH: 100,
        USDC: 150,
        BTC: 200,
      });
    });

    it('should get specific vault rate', () => {
      expect(season.getVaultRate('ETH')).toBe(100);
      expect(season.getVaultRate('USDC')).toBe(150);
      expect(season.getVaultRate('BTC')).toBe(200);
    });

    it('should return default rate for unknown asset', () => {
      expect(season.getVaultRate('UNKNOWN')).toBe(100);
    });

    it('should get social conversion rate', () => {
      expect(season.getSocialConversionRate()).toBe(100);
    });

    it('should get vault locked status', () => {
      expect(season.isVaultLocked()).toBe(false);
    });

    it('should get withdrawal enabled status', () => {
      expect(season.isWithdrawalEnabled()).toBe(true);
    });

    it('should get redeem period days', () => {
      expect(season.getRedeemPeriodDays()).toBe(30);
    });

    it('should handle missing redeem period days', () => {
      const configWithoutRedeem: SeasonConfig = {
        ...mockConfig,
        redeemPeriodDays: undefined,
      };
      const seasonWithoutRedeem = SeasonEntity.create({
        id: 2,
        name: 'Season 2',
        chain: 'base',
        startDate: new Date('2024-04-01'),
        config: configWithoutRedeem,
      });

      expect(seasonWithoutRedeem.getRedeemPeriodDays()).toBeUndefined();
    });

    it('should return default social conversion rate', () => {
      const configWithoutSocialRate: SeasonConfig = {
        ...mockConfig,
        socialConversionRate: 0,
      };
      const seasonWithoutSocialRate = SeasonEntity.create({
        id: 2,
        name: 'Season 2',
        chain: 'base',
        startDate: new Date('2024-04-01'),
        config: configWithoutSocialRate,
      });

      expect(seasonWithoutSocialRate.getSocialConversionRate()).toBe(100);
    });
  });

  describe('activate', () => {
    it('should activate upcoming season', () => {
      const season = SeasonEntity.create({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      });

      const activated = season.activate();

      expect(activated.status).toBe('active');
      expect(activated.updatedAt).toBeInstanceOf(Date);
      expect(activated.id).toBe(season.id);
      expect(activated.config).toEqual(season.config);
    });

    it('should throw error when not upcoming', () => {
      const activeSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        null,
        'active',
        mockConfig,
        0,
        0,
        new Date(),
        new Date(),
      );

      expect(() => activeSeason.activate()).toThrow(
        'Only upcoming seasons can be activated',
      );
    });
  });

  describe('complete', () => {
    it('should complete active season', () => {
      const activeSeason = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        null,
        'active',
        mockConfig,
        100,
        5000,
        new Date(),
        new Date(),
      );

      const endDate = new Date('2024-03-31');
      const completed = activeSeason.complete(endDate);

      expect(completed.status).toBe('completed');
      expect(completed.endDate).toEqual(endDate);
      expect(completed.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when not active', () => {
      const upcomingSeason = SeasonEntity.create({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      });

      expect(() => upcomingSeason.complete(new Date())).toThrow(
        'Only active seasons can be completed',
      );
    });
  });

  describe('updateStats', () => {
    it('should update season statistics', () => {
      const season = SeasonEntity.create({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      });

      const updated = season.updateStats(150, 7500);

      expect(updated.totalParticipants).toBe(150);
      expect(updated.totalShardsIssued).toBe(7500);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    let season: SeasonEntity;

    beforeEach(() => {
      season = SeasonEntity.create({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        config: mockConfig,
      });
    });

    it('should update name', () => {
      const updated = season.update({ name: 'Season 1 - Updated' });

      expect(updated.name).toBe('Season 1 - Updated');
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should update end date', () => {
      const endDate = new Date('2024-03-31');
      const updated = season.update({ endDate });

      expect(updated.endDate).toEqual(endDate);
    });

    it('should update status', () => {
      const updated = season.update({ status: 'active' });

      expect(updated.status).toBe('active');
    });

    it('should update config', () => {
      const newConfig: SeasonConfig = {
        ...mockConfig,
        vaultRates: { ETH: 120, USDC: 180 },
      };
      const updated = season.update({ config: newConfig });

      expect(updated.config).toEqual(newConfig);
    });

    it('should update multiple fields', () => {
      const endDate = new Date('2024-03-31');
      const updated = season.update({
        name: 'Season 1 - Final',
        endDate,
        status: 'completed',
      });

      expect(updated.name).toBe('Season 1 - Final');
      expect(updated.endDate).toEqual(endDate);
      expect(updated.status).toBe('completed');
    });

    it('should preserve unchanged fields', () => {
      const updated = season.update({ name: 'New Name' });

      expect(updated.id).toBe(season.id);
      expect(updated.chain).toBe(season.chain);
      expect(updated.startDate).toEqual(season.startDate);
      expect(updated.config).toEqual(season.config);
    });
  });

  describe('toJSON', () => {
    it('should serialize season correctly', () => {
      const season = new SeasonEntity(
        1,
        'Season 1',
        'base',
        new Date('2024-01-01'),
        new Date('2024-03-31'),
        'completed',
        mockConfig,
        150,
        7500,
        new Date('2024-01-01'),
        new Date('2024-04-01'),
      );

      const json = season.toJSON();

      expect(json).toEqual({
        id: 1,
        name: 'Season 1',
        chain: 'base',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        status: 'completed',
        config: mockConfig,
        totalParticipants: 150,
        totalShardsIssued: 7500,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-04-01'),
      });
    });
  });
});
