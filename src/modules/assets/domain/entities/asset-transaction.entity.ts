import { randomUUID } from 'crypto';
import { ApiProperty } from '@nestjs/swagger';
import { BlockchainAsset } from './blockchain-asset.entity';

export enum TransactionEventType {
  TRANSFER = 'TRANSFER',
  MINT = 'MINT',
  BURN = 'BURN',
  APPROVAL = 'APPROVAL',
  APPROVAL_FOR_ALL = 'APPROVAL_FOR_ALL',
}

export class AssetTransaction {
  @ApiProperty({ description: 'Unique identifier for the transaction' })
  id: string;

  @ApiProperty({ description: 'Asset ID reference' })
  assetId: string;

  @ApiProperty({ description: 'Blockchain transaction hash' })
  transactionHash: string;

  @ApiProperty({ description: 'Block number as string' })
  blockNumber: string;

  @ApiProperty({
    description: 'Type of transaction event',
    enum: ['TRANSFER', 'MINT', 'BURN', 'APPROVAL', 'APPROVAL_FOR_ALL'],
  })
  eventType: TransactionEventType;

  @ApiProperty({ description: 'From address' })
  fromAddress: string;

  @ApiProperty({ description: 'To address' })
  toAddress: string;

  @ApiProperty({
    description: 'Value transferred (if applicable)',
    nullable: true,
  })
  value?: string;

  @ApiProperty({ description: 'Block timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Creation date of the transaction record' })
  createdAt: Date;

  asset?: BlockchainAsset;

  constructor(params: {
    id?: string;
    assetId: string;
    transactionHash: string;
    blockNumber: string;
    eventType: TransactionEventType;
    fromAddress: string;
    toAddress: string;
    value?: string;
    timestamp: Date;
    createdAt?: Date;
    asset?: BlockchainAsset;
  }) {
    this.id = params.id ?? randomUUID();
    this.assetId = params.assetId;
    this.transactionHash = params.transactionHash;
    this.blockNumber = params.blockNumber;
    this.eventType = params.eventType;
    this.fromAddress = params.fromAddress.toLowerCase();
    this.toAddress = params.toAddress.toLowerCase();
    this.value = params.value;
    this.timestamp = params.timestamp;
    this.createdAt = params.createdAt ?? new Date();
    this.asset = params.asset;
  }

  isTransfer(): boolean {
    return this.eventType === TransactionEventType.TRANSFER;
  }

  isMint(): boolean {
    return this.eventType === TransactionEventType.MINT;
  }

  isBurn(): boolean {
    return this.eventType === TransactionEventType.BURN;
  }

  isApproval(): boolean {
    return (
      this.eventType === TransactionEventType.APPROVAL ||
      this.eventType === TransactionEventType.APPROVAL_FOR_ALL
    );
  }

  involvesAddress(address: string): boolean {
    const normalizedAddress = address.toLowerCase();
    return (
      this.fromAddress === normalizedAddress ||
      this.toAddress === normalizedAddress
    );
  }

  getDirectionForAddress(address: string): 'incoming' | 'outgoing' | 'none' {
    const normalizedAddress = address.toLowerCase();

    if (
      this.fromAddress === normalizedAddress &&
      this.toAddress === normalizedAddress
    ) {
      return 'none'; // Self-transaction
    }

    if (this.fromAddress === normalizedAddress) {
      return 'outgoing';
    }

    if (this.toAddress === normalizedAddress) {
      return 'incoming';
    }

    return 'none';
  }

  getOtherPartyAddress(address: string): string | null {
    const normalizedAddress = address.toLowerCase();

    if (this.fromAddress === normalizedAddress) {
      return this.toAddress;
    }

    if (this.toAddress === normalizedAddress) {
      return this.fromAddress;
    }

    return null;
  }

  getDescription(): string {
    switch (this.eventType) {
      case TransactionEventType.TRANSFER:
        return `Transferred from ${this.fromAddress} to ${this.toAddress}`;
      case TransactionEventType.MINT:
        return `Minted to ${this.toAddress}`;
      case TransactionEventType.BURN:
        return `Burned from ${this.fromAddress}`;
      case TransactionEventType.APPROVAL:
        return `Approved ${this.toAddress} for spending`;
      case TransactionEventType.APPROVAL_FOR_ALL:
        return `Approved ${this.toAddress} for all tokens`;
      default:
        return `${String(this.eventType)} transaction`;
    }
  }
}
