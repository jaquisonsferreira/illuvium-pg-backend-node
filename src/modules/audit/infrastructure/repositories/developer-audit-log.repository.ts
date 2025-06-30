import { Injectable, Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DeveloperAuditLog } from '../../domain/entities/developer-audit-log.entity';
import {
  DeveloperAuditLogRepositoryInterface,
  DeveloperAuditLogFilters,
} from '../../domain/repositories/developer-audit-log.repository.interface';
import { DeveloperAuditEventType } from '../../domain/types/audit-event.types';
import { Database } from '../../../../shared/infrastructure/database/database.types';
import { DeveloperAuditLog as DeveloperAuditLogRow } from '../../../../shared/infrastructure/database/database.types';
import { DATABASE_CONNECTION } from '../../../../shared/infrastructure/database/constants';

@Injectable()
export class DeveloperAuditLogRepository
  implements DeveloperAuditLogRepositoryInterface
{
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {}

  async create(auditLog: DeveloperAuditLog): Promise<DeveloperAuditLog> {
    const row = await this.db
      .insertInto('developer_audit_logs')
      .values({
        id: auditLog.id,
        event_type: auditLog.eventType,
        contract_address: auditLog.contractAddress,
        actor_address: auditLog.actorAddress,
        network_name: auditLog.networkName,
        block_number: auditLog.blockNumber,
        transaction_hash: auditLog.transactionHash,
        previous_value: auditLog.previousValue,
        new_value: auditLog.newValue,
        metadata: auditLog.metadata as object,
        timestamp: auditLog.timestamp,
        created_at: auditLog.createdAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRowToEntity(row);
  }

  async findById(id: string): Promise<DeveloperAuditLog | null> {
    const row = await this.db
      .selectFrom('developer_audit_logs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByContractAddress(
    contractAddress: string,
    filters?: Omit<DeveloperAuditLogFilters, 'contractAddress'>,
  ): Promise<DeveloperAuditLog[]> {
    let query = this.db
      .selectFrom('developer_audit_logs')
      .selectAll()
      .where('contract_address', '=', contractAddress);

    query = this.applyFilters(query, filters);

    const rows = await query.orderBy('created_at', 'desc').execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async findByActorAddress(
    actorAddress: string,
    filters?: Omit<DeveloperAuditLogFilters, 'actorAddress'>,
  ): Promise<DeveloperAuditLog[]> {
    let query = this.db
      .selectFrom('developer_audit_logs')
      .selectAll()
      .where('actor_address', '=', actorAddress);

    query = this.applyFilters(query, filters);

    const rows = await query.orderBy('created_at', 'desc').execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async findByFilters(
    filters: DeveloperAuditLogFilters,
  ): Promise<DeveloperAuditLog[]> {
    let query = this.db.selectFrom('developer_audit_logs').selectAll();

    query = this.applyFilters(query, filters);

    const rows = await query.orderBy('created_at', 'desc').execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async countByFilters(
    filters: Omit<DeveloperAuditLogFilters, 'limit' | 'offset'>,
  ): Promise<number> {
    let query = this.db
      .selectFrom('developer_audit_logs')
      .select(this.db.fn.count('id').as('count'));

    query = this.applyFilters(query, filters);

    const result = await query.executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async findByTransactionHash(
    transactionHash: string,
  ): Promise<DeveloperAuditLog[]> {
    const rows = await this.db
      .selectFrom('developer_audit_logs')
      .selectAll()
      .where('transaction_hash', '=', transactionHash)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.mapRowToEntity(row));
  }

  async exists(
    transactionHash: string,
    eventType: DeveloperAuditEventType,
  ): Promise<boolean> {
    const result = await this.db
      .selectFrom('developer_audit_logs')
      .select('id')
      .where('transaction_hash', '=', transactionHash)
      .where('event_type', '=', eventType)
      .executeTakeFirst();

    return !!result;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('developer_audit_logs')
      .where('created_at', '<', date)
      .execute();

    return result.length;
  }

  private applyFilters(
    query: any,
    filters?: Partial<DeveloperAuditLogFilters>,
  ): any {
    if (!filters) return query;

    if (filters.contractAddress) {
      query = query.where('contract_address', '=', filters.contractAddress);
    }

    if (filters.actorAddress) {
      query = query.where('actor_address', '=', filters.actorAddress);
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

  private mapRowToEntity(row: DeveloperAuditLogRow): DeveloperAuditLog {
    return new DeveloperAuditLog({
      id: row.id,
      eventType: row.event_type as DeveloperAuditEventType,
      contractAddress: row.contract_address,
      actorAddress: row.actor_address,
      networkName: row.network_name,
      blockNumber: row.block_number,
      transactionHash: row.transaction_hash,
      previousValue: row.previous_value || undefined,
      newValue: row.new_value || undefined,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
      timestamp: row.timestamp,
      createdAt: row.created_at,
    });
  }
}
