import { randomUUID } from 'crypto';
import { ApiProperty } from '@nestjs/swagger';
import { BlockchainContract } from './blockchain-contract.entity';

export class BlockchainAsset {
  @ApiProperty({ description: 'Unique identifier for the asset' })
  id: string;

  @ApiProperty({ description: 'Contract ID reference' })
  contractId: string;

  @ApiProperty({ description: 'Token ID (null for ERC20)', nullable: true })
  tokenId?: string;

  @ApiProperty({ description: 'Current owner address' })
  ownerAddress: string;

  @ApiProperty({ description: 'Balance as string for precision' })
  balance: string;

  @ApiProperty({ description: 'Token metadata', nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Last updated block number' })
  lastUpdatedBlock: string;

  @ApiProperty({ description: 'Creation date of the asset record' })
  createdAt: Date;

  @ApiProperty({ description: 'Update date of the asset record' })
  updatedAt: Date;

  // Optional populated contract data
  contract?: BlockchainContract;

  constructor(params: {
    id?: string;
    contractId: string;
    tokenId?: string;
    ownerAddress: string;
    balance?: string;
    metadata?: Record<string, any>;
    lastUpdatedBlock?: string;
    createdAt?: Date;
    updatedAt?: Date;
    contract?: BlockchainContract;
  }) {
    this.id = params.id ?? randomUUID();
    this.contractId = params.contractId;
    this.tokenId = params.tokenId;
    this.ownerAddress = params.ownerAddress.toLowerCase();
    this.balance = params.balance ?? '0';
    this.metadata = params.metadata;
    this.lastUpdatedBlock = params.lastUpdatedBlock ?? '0';
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
    this.contract = params.contract;
  }

  isNFT(): boolean {
    return this.tokenId !== null && this.tokenId !== undefined;
  }

  isFungible(): boolean {
    return !this.isNFT();
  }

  getDisplayName(): string {
    if (this.metadata?.name) {
      return this.metadata.name;
    }

    if (this.contract?.name && this.tokenId) {
      return `${this.contract.name} #${this.tokenId}`;
    }

    if (this.contract?.name) {
      return this.contract.name;
    }

    return `Asset ${this.id.slice(0, 8)}...`;
  }

  getImageUrl(): string | null {
    return this.metadata?.image || this.metadata?.image_url || null;
  }

  hasBalance(): boolean {
    return BigInt(this.balance) > 0n;
  }

  getFormattedBalance(): string {
    if (!this.contract) {
      return this.balance;
    }

    if (this.contract.isERC20() && this.contract.decimals) {
      const balanceBigInt = BigInt(this.balance);
      const divisor = BigInt(10 ** this.contract.decimals);
      const whole = balanceBigInt / divisor;
      const fraction = balanceBigInt % divisor;

      if (fraction === 0n) {
        return whole.toString();
      }

      const fractionStr = fraction
        .toString()
        .padStart(this.contract.decimals, '0');
      return `${whole}.${fractionStr.replace(/0+$/, '')}`;
    }

    return this.balance;
  }

  updateBalance(newBalance: string, blockNumber: string): void {
    this.balance = newBalance;
    this.lastUpdatedBlock = blockNumber;
    this.updatedAt = new Date();
  }

  updateOwner(newOwner: string, blockNumber: string): void {
    this.ownerAddress = newOwner.toLowerCase();
    this.lastUpdatedBlock = blockNumber;
    this.updatedAt = new Date();
  }
}
