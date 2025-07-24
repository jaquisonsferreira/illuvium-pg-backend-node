import { randomUUID } from 'crypto';

export class VaultPositionEntity {
  constructor(
    public readonly id: string,
    public readonly walletAddress: string,
    public readonly vaultAddress: string,
    public readonly assetSymbol: string,
    public readonly chain: string,
    public readonly balance: string, // BigNumber as string
    public readonly shares: string, // BigNumber as string
    public readonly usdValue: number,
    public readonly lockWeeks: number, // Lock duration in weeks (4-48)
    public readonly snapshotDate: Date,
    public readonly blockNumber: number,
    public readonly createdAt: Date,
  ) {}

  static create(params: {
    walletAddress: string;
    vaultAddress: string;
    assetSymbol: string;
    chain: string;
    balance: string;
    shares: string;
    usdValue: number;
    lockWeeks: number;
    snapshotDate: Date;
    blockNumber: number;
  }): VaultPositionEntity {
    // Normalize date to start of day UTC
    const normalizedDate = new Date(params.snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    return new VaultPositionEntity(
      randomUUID(),
      params.walletAddress.toLowerCase(),
      params.vaultAddress.toLowerCase(),
      params.assetSymbol,
      params.chain,
      params.balance,
      params.shares,
      params.usdValue,
      params.lockWeeks,
      normalizedDate,
      params.blockNumber,
      new Date(),
    );
  }

  hasBalance(): boolean {
    return this.balance !== '0' && this.shares !== '0';
  }

  getSnapshotDateString(): string {
    return this.snapshotDate.toISOString().split('T')[0];
  }

  isFromChain(chain: string): boolean {
    return this.chain.toLowerCase() === chain.toLowerCase();
  }

  calculateShards(ratePerThousandUsd: number): number {
    const baseShards = (this.usdValue / 1000) * ratePerThousandUsd;
    const lockMultiplier = this.calculateLockMultiplier();
    return baseShards * lockMultiplier;
  }

  calculateLockMultiplier(): number {
    // Linear curve: 1x at 4 weeks, 2x at 48 weeks
    // Formula: multiplier = 1 + (lockWeeks - 4) / 44
    if (this.lockWeeks < 4) return 1; // Minimum lock period
    if (this.lockWeeks > 48) return 2; // Maximum multiplier

    return 1 + (this.lockWeeks - 4) / 44;
  }

  toJSON() {
    return {
      id: this.id,
      walletAddress: this.walletAddress,
      vaultAddress: this.vaultAddress,
      assetSymbol: this.assetSymbol,
      chain: this.chain,
      balance: this.balance,
      shares: this.shares,
      usdValue: this.usdValue,
      lockWeeks: this.lockWeeks,
      lockMultiplier: this.calculateLockMultiplier(),
      snapshotDate: this.getSnapshotDateString(),
      blockNumber: this.blockNumber,
      createdAt: this.createdAt,
    };
  }
}
