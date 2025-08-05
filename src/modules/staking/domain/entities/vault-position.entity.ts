import { VaultPosition as IVaultPosition } from '../types/staking-types';

export class VaultPositionEntity implements IVaultPosition {
  constructor(
    public readonly vault: string,
    public readonly user: string,
    public readonly shares: string,
    public readonly assets: string,
    public readonly blockNumber: number,
    public readonly timestamp: number,
  ) {}

  hasBalance(): boolean {
    return this.shares !== '0' || this.assets !== '0';
  }

  formatBalance(decimals: number = 18): {
    shares: string;
    assets: string;
  } {
    const shareAmount = parseFloat(this.shares) / Math.pow(10, decimals);
    const assetAmount = parseFloat(this.assets) / Math.pow(10, decimals);

    return {
      shares: shareAmount.toFixed(6),
      assets: assetAmount.toFixed(6),
    };
  }

  calculateUsdValue(tokenPriceUsd: number, decimals: number = 18): number {
    const assetAmount = parseFloat(this.assets) / Math.pow(10, decimals);
    return assetAmount * tokenPriceUsd;
  }

  toJSON(): IVaultPosition {
    return {
      vault: this.vault,
      user: this.user,
      shares: this.shares,
      assets: this.assets,
      blockNumber: this.blockNumber,
      timestamp: this.timestamp,
    };
  }

  static fromSubgraphData(data: {
    vault: string;
    user: string;
    shares: string;
    assets: string;
    blockNumber: number;
    timestamp: number;
  }): VaultPositionEntity {
    return new VaultPositionEntity(
      data.vault,
      data.user,
      data.shares,
      data.assets,
      data.blockNumber,
      data.timestamp,
    );
  }
}
