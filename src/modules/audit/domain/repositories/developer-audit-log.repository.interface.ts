import { DeveloperAuditLog } from '../entities/developer-audit-log.entity';
import { DeveloperAuditEventType } from '../types/audit-event.types';

export interface DeveloperAuditLogFilters {
  contractAddress?: string;
  actorAddress?: string;
  eventType?: DeveloperAuditEventType;
  networkName?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface DeveloperAuditLogRepositoryInterface {
  create(auditLog: DeveloperAuditLog): Promise<DeveloperAuditLog>;
  findById(id: string): Promise<DeveloperAuditLog | null>;
  findByContractAddress(
    contractAddress: string,
    filters?: Omit<DeveloperAuditLogFilters, 'contractAddress'>,
  ): Promise<DeveloperAuditLog[]>;
  findByActorAddress(
    actorAddress: string,
    filters?: Omit<DeveloperAuditLogFilters, 'actorAddress'>,
  ): Promise<DeveloperAuditLog[]>;
  findByFilters(
    filters: DeveloperAuditLogFilters,
  ): Promise<DeveloperAuditLog[]>;
  countByFilters(
    filters: Omit<DeveloperAuditLogFilters, 'limit' | 'offset'>,
  ): Promise<number>;
  findByTransactionHash(transactionHash: string): Promise<DeveloperAuditLog[]>;
  exists(
    transactionHash: string,
    eventType: DeveloperAuditEventType,
  ): Promise<boolean>;
  deleteOlderThan(date: Date): Promise<number>;
}
