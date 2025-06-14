import { UserAuditLog } from '../entities/user-audit-log.entity';
import { UserAuditEventType } from '../types/audit-event.types';

export interface AuditLogFilters {
  userAddress?: string;
  contractAddress?: string;
  eventType?: UserAuditEventType;
  networkName?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UserAuditLogRepositoryInterface {
  create(auditLog: UserAuditLog): Promise<UserAuditLog>;
  findById(id: string): Promise<UserAuditLog | null>;
  findByUserAddress(
    userAddress: string,
    filters?: Omit<AuditLogFilters, 'userAddress'>,
  ): Promise<UserAuditLog[]>;
  findByFilters(filters: AuditLogFilters): Promise<UserAuditLog[]>;
  countByFilters(
    filters: Omit<AuditLogFilters, 'limit' | 'offset'>,
  ): Promise<number>;
  findByTransactionHash(transactionHash: string): Promise<UserAuditLog[]>;
  exists(
    transactionHash: string,
    eventType: UserAuditEventType,
  ): Promise<boolean>;
  deleteOlderThan(date: Date): Promise<number>;
}
