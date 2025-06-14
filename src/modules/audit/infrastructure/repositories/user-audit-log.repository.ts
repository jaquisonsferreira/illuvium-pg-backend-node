import { Injectable, Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { UserAuditLog } from '../../domain/entities/user-audit-log.entity';
import {
  UserAuditLogRepositoryInterface,
  AuditLogFilters,
} from '../../domain/repositories/user-audit-log.repository.interface';
import { UserAuditEventType } from '../../domain/types/audit-event.types';
import { Database } from '../../../../shared/infrastructure/database/database.types';
import { UserAuditLog as UserAuditLogRow } from '../../../../shared/infrastructure/database/database.types';
import { DATABASE_CONNECTION } from '../../../../shared/infrastructure/database/constants';

@Injectable()
export class UserAuditLogRepository implements UserAuditLogRepositoryInterface {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {}

  async create(auditLog: UserAuditLog): Promise<UserAuditLog> {
    const row = await this.db
      .insertInto('user_audit_logs')
      .values({
        id: auditLog.id,
        user_address: auditLog.userAddress,
        event_type: auditLog.eventType,
        contract_address: auditLog.contractAddress,
        token_id: auditLog.tokenId,
        network_name: auditLog.networkName,
        block_number: auditLog.blockNumber,
        transaction_hash: auditLog.transactionHash,
        amount: auditLog.amount,
        from_address: auditLog.fromAddress,
        to_address: auditLog.toAddress,
        metadata: auditLog.metadata as object,
        timestamp: auditLog.timestamp,
        created_at: auditLog.createdAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRowToEntity(row);
  }

  async findById(id: string): Promise<UserAuditLog | null> {
    const row = await this.db
      .selectFrom('user_audit_logs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByUserAddress(
    userAddress: string,
    filters?: Omit<AuditLogFilters, 'userAddress'>,
  ): Promise<UserAuditLog[]> {
    let query = this.db
      .selectFrom('user_audit_logs')
      .selectAll()
      .where('user_address', '=', userAddress);

    query = this.applyFilters(query, filters);

    const rows = await query.orderBy('created_at', 'desc').execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async findByFilters(filters: AuditLogFilters): Promise<UserAuditLog[]> {
    let query = this.db.selectFrom('user_audit_logs').selectAll();

    query = this.applyFilters(query, filters);

    const rows = await query.orderBy('created_at', 'desc').execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async countByFilters(
    filters: Omit<AuditLogFilters, 'limit' | 'offset'>,
  ): Promise<number> {
    let query = this.db
      .selectFrom('user_audit_logs')
      .select(this.db.fn.count('id').as('count'));

    query = this.applyFilters(query, filters);

    const result = await query.executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async findByTransactionHash(
    transactionHash: string,
  ): Promise<UserAuditLog[]> {
    const rows = await this.db
      .selectFrom('user_audit_logs')
      .selectAll()
      .where('transaction_hash', '=', transactionHash)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async exists(
    transactionHash: string,
    eventType: UserAuditEventType,
  ): Promise<boolean> {
    const result = await this.db
      .selectFrom('user_audit_logs')
      .select('id')
      .where('transaction_hash', '=', transactionHash)
      .where('event_type', '=', eventType)
      .executeTakeFirst();

    return !!result;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('user_audit_logs')
      .where('created_at', '<', date)
      .execute();

    return result.length;
  }

  private applyFilters(query: any, filters?: Partial<AuditLogFilters>): any {
    if (!filters) return query;

    if (filters.userAddress) {
      query = query.where('user_address', '=', filters.userAddress);
    }

    if (filters.contractAddress) {
      query = query.where('contract_address', '=', filters.contractAddress);
    }

    if (filters.eventType) {
      query = query.where('event_type', '=', filters.eventType);
    }

    if (filters.networkName) {
      query = query.where('network_name', '=', filters.networkName);
    }

    if (filters.fromDate) {
      query = query.where('timestamp', '>=', filters.fromDate);
    }

    if (filters.toDate) {
      query = query.where('timestamp', '<=', filters.toDate);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    return query;
  }

  private mapRowToEntity(row: UserAuditLogRow): UserAuditLog {
    return new UserAuditLog({
      id: row.id,
      userAddress: row.user_address,
      eventType: row.event_type as UserAuditEventType,
      contractAddress: row.contract_address,
      tokenId: row.token_id,
      networkName: row.network_name,
      blockNumber: row.block_number,
      transactionHash: row.transaction_hash,
      amount: row.amount || undefined,
      fromAddress: row.from_address || undefined,
      toAddress: row.to_address || undefined,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
      timestamp: row.timestamp,
      createdAt: row.created_at,
    });
  }
}
