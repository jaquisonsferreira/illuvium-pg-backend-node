import { randomUUID } from 'crypto';

export class ShardBalanceEntity {
  constructor(
    public readonly id: string,
    public readonly walletAddress: string,
    public readonly seasonId: number,
    public readonly stakingShards: number,
    public readonly socialShards: number,
    public readonly developerShards: number,
    public readonly referralShards: number,
    public readonly totalShards: number,
    public readonly lastCalculatedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: {
    walletAddress: string;
    seasonId: number;
    stakingShards?: number;
    socialShards?: number;
    developerShards?: number;
    referralShards?: number;
  }): ShardBalanceEntity {
    const stakingShards = params.stakingShards || 0;
    const socialShards = params.socialShards || 0;
    const developerShards = params.developerShards || 0;
    const referralShards = params.referralShards || 0;

    const totalShards =
      stakingShards + socialShards + developerShards + referralShards;

    return new ShardBalanceEntity(
      randomUUID(),
      params.walletAddress.toLowerCase(),
      params.seasonId,
      stakingShards,
      socialShards,
      developerShards,
      referralShards,
      totalShards,
      new Date(),
      new Date(),
      new Date(),
    );
  }

  addShards(
    category: 'staking' | 'social' | 'developer' | 'referral',
    amount: number,
  ): ShardBalanceEntity {
    const updates = {
      stakingShards: this.stakingShards,
      socialShards: this.socialShards,
      developerShards: this.developerShards,
      referralShards: this.referralShards,
    };

    switch (category) {
      case 'staking':
        updates.stakingShards += amount;
        break;
      case 'social':
        updates.socialShards += amount;
        break;
      case 'developer':
        updates.developerShards += amount;
        break;
      case 'referral':
        updates.referralShards += amount;
        break;
    }

    const totalShards =
      updates.stakingShards +
      updates.socialShards +
      updates.developerShards +
      updates.referralShards;

    return new ShardBalanceEntity(
      this.id,
      this.walletAddress,
      this.seasonId,
      updates.stakingShards,
      updates.socialShards,
      updates.developerShards,
      updates.referralShards,
      totalShards,
      new Date(),
      this.createdAt,
      new Date(),
    );
  }

  recalculateTotal(): ShardBalanceEntity {
    const totalShards =
      this.stakingShards +
      this.socialShards +
      this.developerShards +
      this.referralShards;

    return new ShardBalanceEntity(
      this.id,
      this.walletAddress,
      this.seasonId,
      this.stakingShards,
      this.socialShards,
      this.developerShards,
      this.referralShards,
      totalShards,
      new Date(),
      this.createdAt,
      new Date(),
    );
  }

  toJSON() {
    return {
      id: this.id,
      walletAddress: this.walletAddress,
      seasonId: this.seasonId,
      stakingShards: this.stakingShards,
      socialShards: this.socialShards,
      developerShards: this.developerShards,
      referralShards: this.referralShards,
      totalShards: this.totalShards,
      lastCalculatedAt: this.lastCalculatedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
