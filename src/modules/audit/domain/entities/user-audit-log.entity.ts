import { randomUUID } from 'crypto';
import {
  UserAuditEvent,
  AuditEventCategory,
  UserAuditEventType,
} from '../types/audit-event.types';

export interface UserAuditLogProps {
  id?: string;
  userAddress: string;
  eventType: UserAuditEventType;
  contractAddress: string;
  tokenId: string;
  networkName: string;
  blockNumber: number;
  transactionHash: string;
  amount?: string;
  fromAddress?: string;
  toAddress?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt?: Date;
}

export class UserAuditLog {
  constructor(private readonly props: UserAuditLogProps) {
    if (!props.id) {
      props.id = randomUUID();
    }
    if (!props.createdAt) {
      props.createdAt = new Date();
    }
    if (!props.metadata) {
      props.metadata = {};
    }

    this.validateProps();
  }

  get id(): string {
    return this.props.id!;
  }

  get userAddress(): string {
    return this.props.userAddress;
  }

  get eventType(): UserAuditEventType {
    return this.props.eventType;
  }

  get contractAddress(): string {
    return this.props.contractAddress;
  }

  get tokenId(): string {
    return this.props.tokenId;
  }

  get networkName(): string {
    return this.props.networkName;
  }

  get blockNumber(): number {
    return this.props.blockNumber;
  }

  get transactionHash(): string {
    return this.props.transactionHash;
  }

  get amount(): string | undefined {
    return this.props.amount;
  }

  get fromAddress(): string | undefined {
    return this.props.fromAddress;
  }

  get toAddress(): string | undefined {
    return this.props.toAddress;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata!;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get createdAt(): Date {
    return this.props.createdAt!;
  }

  private validateProps(): void {
    if (!this.props.userAddress || !this.props.userAddress.startsWith('0x')) {
      throw new Error('User address must be a valid Ethereum address');
    }

    if (
      !this.props.contractAddress ||
      !this.props.contractAddress.startsWith('0x')
    ) {
      throw new Error('Contract address must be a valid Ethereum address');
    }

    if (!this.props.tokenId) {
      throw new Error('Token ID is required');
    }

    if (
      !this.props.transactionHash ||
      !this.props.transactionHash.startsWith('0x')
    ) {
      throw new Error('Transaction hash must be a valid hex string');
    }

    if (this.props.blockNumber < 0) {
      throw new Error('Block number must be a positive number');
    }
  }

  toAuditEvent(): UserAuditEvent {
    return {
      id: this.id,
      category: AuditEventCategory.USER,
      eventType: this.eventType,
      userAddress: this.userAddress,
      contractAddress: this.contractAddress,
      tokenId: this.tokenId,
      networkName: this.networkName,
      blockNumber: this.blockNumber,
      transactionHash: this.transactionHash,
      amount: this.amount,
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      metadata: this.metadata,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
    };
  }

  static fromBlockchainEvent(eventData: {
    userAddress: string;
    eventType: UserAuditEventType;
    contractAddress: string;
    tokenId: string;
    networkName: string;
    blockNumber: number;
    transactionHash: string;
    amount?: string;
    fromAddress?: string;
    toAddress?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }): UserAuditLog {
    return new UserAuditLog(eventData);
  }
}
