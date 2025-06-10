import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import {
  Database,
  AssetTransaction as AssetTransactionDB,
  NewAssetTransaction,
  AssetTransactionUpdate,
} from '../../../../shared/infrastructure/database/database.types';
import {
  AssetTransaction,
  TransactionEventType,
} from '../../domain/entities/asset-transaction.entity';
import { BlockchainAsset } from '../../domain/entities/blockchain-asset.entity';
import {
  AssetTransactionRepositoryInterface,
  TransactionSearchFilters,
} from '../../domain/repositories/asset-transaction.repository.interface';

@Injectable()
export class AssetTransactionRepository
  implements AssetTransactionRepositoryInterface
{
  constructor(private readonly db: Kysely<Database>) {}

  private toDomainEntity(
    row: AssetTransactionDB,
    asset?: BlockchainAsset,
  ): AssetTransaction {
    return new AssetTransaction({
      id: row.id,
      assetId: row.asset_id,
      transactionHash: row.transaction_hash,
      blockNumber: row.block_number,
      eventType: row.event_type as TransactionEventType,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      value: row.value || undefined,
      timestamp: row.timestamp,
      createdAt: row.created_at,
      asset,
    });
  }

  private toNewDatabase(transaction: AssetTransaction): NewAssetTransaction {
    return {
      id: transaction.id,
      asset_id: transaction.assetId,
      transaction_hash: transaction.transactionHash,
      block_number: transaction.blockNumber,
      event_type: transaction.eventType,
      from_address: transaction.fromAddress,
      to_address: transaction.toAddress,
      value: transaction.value || null,
      timestamp: transaction.timestamp,
      created_at: transaction.createdAt,
    };
  }

  private toUpdateDatabase(
    transaction: Partial<AssetTransaction>,
  ): AssetTransactionUpdate {
    const update: AssetTransactionUpdate = {};

    if (transaction.assetId !== undefined)
      update.asset_id = transaction.assetId;
    if (transaction.transactionHash !== undefined)
      update.transaction_hash = transaction.transactionHash;
    if (transaction.blockNumber !== undefined)
      update.block_number = transaction.blockNumber;
    if (transaction.eventType !== undefined)
      update.event_type = transaction.eventType;
    if (transaction.fromAddress !== undefined)
      update.from_address = transaction.fromAddress;
    if (transaction.toAddress !== undefined)
      update.to_address = transaction.toAddress;
    if (transaction.value !== undefined)
      update.value = transaction.value || null;
    if (transaction.timestamp !== undefined)
      update.timestamp = transaction.timestamp;

    return update;
  }

  async create(transaction: AssetTransaction): Promise<AssetTransaction> {
    const newTransaction = this.toNewDatabase(transaction);

    const row = await this.db
      .insertInto('asset_transactions')
      .values(newTransaction)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toDomainEntity(row);
  }

  async findById(id: string): Promise<AssetTransaction | null> {
    const row = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async findByTransactionHash(hash: string): Promise<AssetTransaction[]> {
    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('transaction_hash', '=', hash)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByAsset(assetId: string): Promise<AssetTransaction[]> {
    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('asset_id', '=', assetId)
      .orderBy('timestamp', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByAddress(address: string): Promise<AssetTransaction[]> {
    const normalizedAddress = address.toLowerCase();

    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('from_address', '=', normalizedAddress),
          eb('to_address', '=', normalizedAddress),
        ]),
      )
      .orderBy('timestamp', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findAll(): Promise<AssetTransaction[]> {
    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .orderBy('timestamp', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async update(
    id: string,
    transaction: Partial<AssetTransaction>,
  ): Promise<AssetTransaction | null> {
    const updateData = this.toUpdateDatabase(transaction);

    const row = await this.db
      .updateTable('asset_transactions')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('asset_transactions')
      .where('id', '=', id)
      .execute();

    return Number(result[0]?.numDeletedRows) > 0;
  }

  async search(filters: TransactionSearchFilters): Promise<{
    transactions: AssetTransaction[];
    total: number;
  }> {
    let query = this.db.selectFrom('asset_transactions').selectAll();

    if (filters.assetIds?.length) {
      query = query.where('asset_id', 'in', filters.assetIds);
    }

    if (filters.transactionHashes?.length) {
      query = query.where('transaction_hash', 'in', filters.transactionHashes);
    }

    if (filters.blockNumbers?.length) {
      query = query.where('block_number', 'in', filters.blockNumbers);
    }

    if (filters.eventTypes?.length) {
      query = query.where('event_type', 'in', filters.eventTypes);
    }

    if (filters.fromAddresses?.length) {
      const normalizedAddresses = filters.fromAddresses.map((addr) =>
        addr.toLowerCase(),
      );
      query = query.where('from_address', 'in', normalizedAddresses);
    }

    if (filters.toAddresses?.length) {
      const normalizedAddresses = filters.toAddresses.map((addr) =>
        addr.toLowerCase(),
      );
      query = query.where('to_address', 'in', normalizedAddresses);
    }

    if (filters.involvedAddresses?.length) {
      const normalizedAddresses = filters.involvedAddresses.map((addr) =>
        addr.toLowerCase(),
      );
      query = query.where((eb) =>
        eb.or([
          eb('from_address', 'in', normalizedAddresses),
          eb('to_address', 'in', normalizedAddresses),
        ]),
      );
    }

    if (filters.dateFrom) {
      query = query.where('timestamp', '>=', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.where('timestamp', '<=', filters.dateTo);
    }

    const countQuery = query.select((eb) => eb.fn.count('id').as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);

    const sortBy = filters.sortBy || 'timestamp';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    if (filters.limit) {
      query = query.limit(Math.min(filters.limit, 100));
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const rows = await query.execute();
    const transactions = rows.map((row) => this.toDomainEntity(row));

    return { transactions, total };
  }

  async findByEventType(
    eventType: TransactionEventType,
  ): Promise<AssetTransaction[]> {
    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('event_type', '=', eventType)
      .orderBy('timestamp', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByBlockRange(
    fromBlock: string,
    toBlock: string,
  ): Promise<AssetTransaction[]> {
    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('block_number', '>=', fromBlock)
      .where('block_number', '<=', toBlock)
      .orderBy('block_number', 'asc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByDateRange(from: Date, to: Date): Promise<AssetTransaction[]> {
    const rows = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('timestamp', '>=', from)
      .where('timestamp', '<=', to)
      .orderBy('timestamp', 'asc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async createMany(
    transactions: AssetTransaction[],
  ): Promise<AssetTransaction[]> {
    if (transactions.length === 0) return [];
    if (transactions.length > 100) {
      throw new Error('Cannot create more than 100 transactions at once');
    }

    const newTransactions = transactions.map((tx) => this.toNewDatabase(tx));

    const rows = await this.db
      .insertInto('asset_transactions')
      .values(newTransactions)
      .returningAll()
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async countByAsset(assetId: string): Promise<number> {
    const result = await this.db
      .selectFrom('asset_transactions')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('asset_id', '=', assetId)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async countByAddress(address: string): Promise<number> {
    const normalizedAddress = address.toLowerCase();

    const result = await this.db
      .selectFrom('asset_transactions')
      .select((eb) => eb.fn.count('id').as('count'))
      .where((eb) =>
        eb.or([
          eb('from_address', '=', normalizedAddress),
          eb('to_address', '=', normalizedAddress),
        ]),
      )
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async countByEventType(eventType: TransactionEventType): Promise<number> {
    const result = await this.db
      .selectFrom('asset_transactions')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('event_type', '=', eventType)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async getLatestByAsset(assetId: string): Promise<AssetTransaction | null> {
    const row = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where('asset_id', '=', assetId)
      .orderBy('timestamp', 'desc')
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async getLatestByAddress(address: string): Promise<AssetTransaction | null> {
    const normalizedAddress = address.toLowerCase();

    const row = await this.db
      .selectFrom('asset_transactions')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('from_address', '=', normalizedAddress),
          eb('to_address', '=', normalizedAddress),
        ]),
      )
      .orderBy('timestamp', 'desc')
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }
}
