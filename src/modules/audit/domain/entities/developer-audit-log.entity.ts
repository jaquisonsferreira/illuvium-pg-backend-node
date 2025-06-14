import { randomUUID } from 'crypto';
import {
  DeveloperAuditEvent,
  AuditEventCategory,
  DeveloperAuditEventType,
} from '../types/audit-event.types';

export interface DeveloperAuditLogProps {
  id?: string;
  eventType: DeveloperAuditEventType;
  contractAddress: string;
  actorAddress: string;
  networkName: string;
  blockNumber: number;
  transactionHash: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt?: Date;
}

export class DeveloperAuditLog {
  constructor(private readonly props: DeveloperAuditLogProps) {
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

  get eventType(): DeveloperAuditEventType {
    return this.props.eventType;
  }

  get contractAddress(): string {
    return this.props.contractAddress;
  }

  get actorAddress(): string {
    return this.props.actorAddress;
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

  get previousValue(): string | undefined {
    return this.props.previousValue;
  }

  get newValue(): string | undefined {
    return this.props.newValue;
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
    if (
      !this.props.contractAddress ||
      !this.props.contractAddress.startsWith('0x')
    ) {
      throw new Error('Contract address must be a valid Ethereum address');
    }

    if (!this.props.actorAddress || !this.props.actorAddress.startsWith('0x')) {
      throw new Error('Actor address must be a valid Ethereum address');
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

  toAuditEvent(): DeveloperAuditEvent {
    return {
      id: this.id,
      category: AuditEventCategory.DEVELOPER,
      eventType: this.eventType,
      contractAddress: this.contractAddress,
      actorAddress: this.actorAddress,
      networkName: this.networkName,
      blockNumber: this.blockNumber,
      transactionHash: this.transactionHash,
      previousValue: this.previousValue,
      newValue: this.newValue,
      metadata: this.metadata,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
    };
  }

  static fromBlockchainEvent(eventData: {
    eventType: DeveloperAuditEventType;
    contractAddress: string;
    actorAddress: string;
    networkName: string;
    blockNumber: number;
    transactionHash: string;
    previousValue?: string;
    newValue?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }): DeveloperAuditLog {
    return new DeveloperAuditLog(eventData);
  }
}
