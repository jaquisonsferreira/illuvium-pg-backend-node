export enum AuditEventCategory {
  USER = 'user',
  DEVELOPER = 'developer',
}

export enum UserAuditEventType {
  TOKEN_MINTED = 'token.minted',
  TOKEN_TRANSFERRED = 'token.transferred',
  TOKEN_BURNED = 'token.burned',
}

export enum DeveloperAuditEventType {
  CONTRACT_PAUSED = 'contract.paused',
  CONTRACT_UNPAUSED = 'contract.unpaused',
  CONTRACT_OWNERSHIP_TRANSFERRED = 'contract.ownership_transferred',
}

export interface BaseAuditEvent {
  id: string;
  category: AuditEventCategory;
  eventType: string;
  networkName: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface UserAuditEvent extends BaseAuditEvent {
  category: AuditEventCategory.USER;
  eventType: UserAuditEventType;
  userAddress: string;
  contractAddress: string;
  tokenId: string;
  amount?: string;
  fromAddress?: string;
  toAddress?: string;
}

export interface DeveloperAuditEvent extends BaseAuditEvent {
  category: AuditEventCategory.DEVELOPER;
  eventType: DeveloperAuditEventType;
  contractAddress: string;
  actorAddress: string;
  previousValue?: string;
  newValue?: string;
}

export type AuditEvent = UserAuditEvent | DeveloperAuditEvent;
