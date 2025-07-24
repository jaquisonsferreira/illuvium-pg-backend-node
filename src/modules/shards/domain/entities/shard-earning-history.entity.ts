import { randomUUID } from 'crypto';

export interface VaultBreakdown {
  vaultId: string;
  asset: string;
  chain: string;
  shardsEarned: number;
  usdValue: number;
}

export class ShardEarningHistoryEntity {
  constructor(
    public readonly id: string,
    public readonly walletAddress: string,
    public readonly seasonId: number,
    public readonly date: Date,
    public readonly stakingShards: number,
    public readonly socialShards: number,
    public readonly developerShards: number,
    public readonly referralShards: number,
    public readonly dailyTotal: number,
    public readonly vaultBreakdown: VaultBreakdown[],
    public readonly metadata: Record<string, any>,
    public readonly createdAt: Date,
  ) {}

  static create(params: {
    walletAddress: string;
    seasonId: number;
    date: Date;
    stakingShards?: number;
    socialShards?: number;
    developerShards?: number;
    referralShards?: number;
    vaultBreakdown?: VaultBreakdown[];
    metadata?: Record<string, any>;
  }): ShardEarningHistoryEntity {
    const stakingShards = params.stakingShards || 0;
    const socialShards = params.socialShards || 0;
    const developerShards = params.developerShards || 0;
    const referralShards = params.referralShards || 0;

    const dailyTotal =
      stakingShards + socialShards + developerShards + referralShards;

    // Normalize date to start of day UTC
    const normalizedDate = new Date(params.date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    return new ShardEarningHistoryEntity(
      randomUUID(),
      params.walletAddress.toLowerCase(),
      params.seasonId,
      normalizedDate,
      stakingShards,
      socialShards,
      developerShards,
      referralShards,
      dailyTotal,
      params.vaultBreakdown || [],
      params.metadata || {},
      new Date(),
    );
  }

  hasEarnings(): boolean {
    return this.dailyTotal > 0;
  }

  getDateString(): string {
    return this.date.toISOString().split('T')[0];
  }

  getVaultBreakdownByAsset(asset: string): VaultBreakdown | undefined {
    return this.vaultBreakdown.find((v) => v.asset === asset);
  }

  getTotalVaultShards(): number {
    return this.vaultBreakdown.reduce(
      (sum, vault) => sum + vault.shardsEarned,
      0,
    );
  }

  getTotalUsdValue(): number {
    return this.vaultBreakdown.reduce((sum, vault) => sum + vault.usdValue, 0);
  }

  getCategoryBreakdown(): Record<string, number> {
    return {
      staking: this.stakingShards,
      social: this.socialShards,
      developer: this.developerShards,
      referral: this.referralShards,
    };
  }

  toJSON() {
    return {
      id: this.id,
      walletAddress: this.walletAddress,
      seasonId: this.seasonId,
      date: this.getDateString(),
      stakingShards: this.stakingShards,
      socialShards: this.socialShards,
      developerShards: this.developerShards,
      referralShards: this.referralShards,
      dailyTotal: this.dailyTotal,
      vaultBreakdown: this.vaultBreakdown,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}
