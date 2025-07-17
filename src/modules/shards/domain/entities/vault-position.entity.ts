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
    return (this.usdValue / 1000) * ratePerThousandUsd;
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
      snapshotDate: this.getSnapshotDateString(),
      blockNumber: this.blockNumber,
      createdAt: this.createdAt,
    };
  }
}
