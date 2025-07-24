import { randomUUID } from 'crypto';

export class ReferralEntity {
  constructor(
    public readonly id: string,
    public readonly referrerAddress: string,
    public readonly refereeAddress: string,
    public readonly seasonId: number,
    public readonly status: 'pending' | 'active' | 'expired',
    public readonly activationDate: Date | null,
    public readonly refereeMultiplierExpires: Date | null,
    public readonly totalShardsEarned: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: {
    referrerAddress: string;
    refereeAddress: string;
    seasonId: number;
  }): ReferralEntity {
    const normalizedReferrer = params.referrerAddress.toLowerCase();
    const normalizedReferee = params.refereeAddress.toLowerCase();

    if (normalizedReferrer === normalizedReferee) {
      throw new Error('Cannot refer yourself');
    }

    return new ReferralEntity(
      randomUUID(),
      normalizedReferrer,
      normalizedReferee,
      params.seasonId,
      'pending',
      null,
      null,
      0,
      new Date(),
      new Date(),
    );
  }

  activate(refereeShards: number): ReferralEntity {
    if (this.status !== 'pending') {
      throw new Error('Referral is already activated');
    }

    if (refereeShards < 100) {
      throw new Error(
        'Referee must earn at least 100 shards to activate referral',
      );
    }

    const activationDate = new Date();
    const multiplierExpires = new Date(activationDate);
    multiplierExpires.setDate(multiplierExpires.getDate() + 30); // 30 days bonus period

    return new ReferralEntity(
      this.id,
      this.referrerAddress,
      this.refereeAddress,
      this.seasonId,
      'active',
      activationDate,
      multiplierExpires,
      this.totalShardsEarned,
      this.createdAt,
      new Date(),
    );
  }

  expire(): ReferralEntity {
    if (this.status === 'expired') {
      return this;
    }

    return new ReferralEntity(
      this.id,
      this.referrerAddress,
      this.refereeAddress,
      this.seasonId,
      'expired',
      this.activationDate,
      this.refereeMultiplierExpires,
      this.totalShardsEarned,
      this.createdAt,
      new Date(),
    );
  }

  isWithinBonusPeriod(): boolean {
    if (!this.refereeMultiplierExpires) return false;
    return new Date() < this.refereeMultiplierExpires;
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  isExpired(): boolean {
    return this.status === 'expired';
  }

  addEarnedShards(amount: number): ReferralEntity {
    if (amount < 0) {
      throw new Error('Cannot add negative shards');
    }

    return new ReferralEntity(
      this.id,
      this.referrerAddress,
      this.refereeAddress,
      this.seasonId,
      this.status,
      this.activationDate,
      this.refereeMultiplierExpires,
      this.totalShardsEarned + amount,
      this.createdAt,
      new Date(),
    );
  }

  getReferrerBonusRate(): number {
    return this.isActive() ? 0.2 : 0; // 20% when active
  }

  getRefereeMultiplier(): number {
    return this.isWithinBonusPeriod() ? 1.2 : 1; // 1.2x multiplier during bonus period
  }

  toJSON() {
    return {
      id: this.id,
      referrerAddress: this.referrerAddress,
      refereeAddress: this.refereeAddress,
      seasonId: this.seasonId,
      status: this.status,
      activationDate: this.activationDate,
      refereeMultiplierExpires: this.refereeMultiplierExpires,
      totalShardsEarned: this.totalShardsEarned,
      isWithinBonusPeriod: this.isWithinBonusPeriod(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
