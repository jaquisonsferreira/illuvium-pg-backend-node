export interface SeasonConfig {
  vaultRates: Record<string, number>;
  socialConversionRate: number;
  vaultLocked: boolean;
  withdrawalEnabled: boolean;
  redeemPeriodDays?: number;
}

export class SeasonEntity {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly chain: string,
    public readonly startDate: Date,
    public readonly endDate: Date | null,
    public readonly status: 'active' | 'completed' | 'upcoming',
    public readonly config: SeasonConfig,
    public readonly totalParticipants: number,
    public readonly totalShardsIssued: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: {
    id: number;
    name: string;
    chain: string;
    startDate: Date;
    config: SeasonConfig;
  }): SeasonEntity {
    return new SeasonEntity(
      params.id,
      params.name,
      params.chain,
      params.startDate,
      null,
      'upcoming',
      params.config,
      0,
      0,
      new Date(),
      new Date(),
    );
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  isCompleted(): boolean {
    return this.status === 'completed';
  }

  isUpcoming(): boolean {
    return this.status === 'upcoming';
  }

  getVaultRates(): Record<string, number> {
    return this.config.vaultRates;
  }

  getVaultRate(asset: string): number {
    return this.config.vaultRates[asset] || 100; // Default rate
  }

  getSocialConversionRate(): number {
    return this.config.socialConversionRate || 100;
  }

  isVaultLocked(): boolean {
    return this.config.vaultLocked;
  }

  isWithdrawalEnabled(): boolean {
    return this.config.withdrawalEnabled;
  }

  getRedeemPeriodDays(): number | undefined {
    return this.config.redeemPeriodDays;
  }

  activate(): SeasonEntity {
    if (this.status !== 'upcoming') {
      throw new Error('Only upcoming seasons can be activated');
    }

    return new SeasonEntity(
      this.id,
      this.name,
      this.chain,
      this.startDate,
      this.endDate,
      'active',
      this.config,
      this.totalParticipants,
      this.totalShardsIssued,
      this.createdAt,
      new Date(),
    );
  }

  complete(endDate: Date): SeasonEntity {
    if (this.status !== 'active') {
      throw new Error('Only active seasons can be completed');
    }

    return new SeasonEntity(
      this.id,
      this.name,
      this.chain,
      this.startDate,
      endDate,
      'completed',
      this.config,
      this.totalParticipants,
      this.totalShardsIssued,
      this.createdAt,
      new Date(),
    );
  }

  updateStats(participants: number, shardsIssued: number): SeasonEntity {
    return new SeasonEntity(
      this.id,
      this.name,
      this.chain,
      this.startDate,
      this.endDate,
      this.status,
      this.config,
      participants,
      shardsIssued,
      this.createdAt,
      new Date(),
    );
  }

  update(params: {
    name?: string;
    endDate?: Date | null;
    status?: 'active' | 'completed' | 'upcoming';
    config?: SeasonConfig;
  }): SeasonEntity {
    return new SeasonEntity(
      this.id,
      params.name ?? this.name,
      this.chain,
      this.startDate,
      params.endDate ?? this.endDate,
      params.status ?? this.status,
      params.config ?? this.config,
      this.totalParticipants,
      this.totalShardsIssued,
      this.createdAt,
      new Date(),
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      chain: this.chain,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      config: this.config,
      totalParticipants: this.totalParticipants,
      totalShardsIssued: this.totalShardsIssued,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
