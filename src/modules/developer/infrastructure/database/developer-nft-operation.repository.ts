import { Injectable, Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../../shared/infrastructure/database/database.types';
import { DATABASE_CONNECTION } from '../../../../shared/infrastructure/database/constants';
import { IDeveloperNftOperationRepository } from '../../domain/repositories/developer-nft-operation.repository.interface';
import { DeveloperNftOperation } from '../../domain/entities/developer-nft-operation.entity';
import { CreateNftOperationData } from '../../domain/repositories/developer-nft-operation.repository.interface';
import { NftOperationStatus } from '../../constants';

@Injectable()
export class DeveloperNftOperationRepository
  implements IDeveloperNftOperationRepository
{
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Kysely<Database>,
  ) {}

  async create(data: CreateNftOperationData): Promise<DeveloperNftOperation> {
    const id = crypto.randomUUID();
    const now = new Date();

    const result = await this.database
      .insertInto('developer_nft_operations')
      .values({
        id,
        api_key_id: data.apiKeyId,
        operation_type: data.operationType,
        status: NftOperationStatus.PENDING,
        to_address: data.toAddress || '',
        token_id: data.tokenId || null,
        amount: data.amount?.toString() || null,
        metadata: data.metadata || null,
        transaction_hash: null,
        error_message: null,
        processed_at: null,
        created_at: now,
        updated_at: now,
      })
      .returning([
        'id',
        'api_key_id',
        'operation_type',
        'status',
        'to_address',
        'token_id',
        'amount',
        'metadata',
        'transaction_hash',
        'error_message',
        'processed_at',
        'created_at',
        'updated_at',
      ])
      .executeTakeFirstOrThrow();

    return this.mapToDomain(result);
  }

  async findById(id: string): Promise<DeveloperNftOperation | null> {
    const result = await this.database
      .selectFrom('developer_nft_operations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return result ? this.mapToDomain(result) : null;
  }

  async findByApiKeyId(apiKeyId: string): Promise<DeveloperNftOperation[]> {
    const results = await this.database
      .selectFrom('developer_nft_operations')
      .selectAll()
      .where('api_key_id', '=', apiKeyId)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map((result) => this.mapToDomain(result));
  }

  async findByStatus(
    status: NftOperationStatus,
  ): Promise<DeveloperNftOperation[]> {
    const results = await this.database
      .selectFrom('developer_nft_operations')
      .selectAll()
      .where('status', '=', status)
      .orderBy('created_at', 'asc')
      .execute();

    return results.map((result) => this.mapToDomain(result));
  }

  async updateStatus(
    id: string,
    status: NftOperationStatus,
    transactionHash?: string,
    errorMessage?: string,
  ): Promise<DeveloperNftOperation> {
    const now = new Date();
    const processedAt =
      status === NftOperationStatus.COMPLETED ||
      status === NftOperationStatus.FAILED
        ? now
        : null;

    const result = await this.database
      .updateTable('developer_nft_operations')
      .set({
        status,
        transaction_hash: transactionHash || null,
        error_message: errorMessage || null,
        processed_at: processedAt,
        updated_at: now,
      })
      .where('id', '=', id)
      .returning([
        'id',
        'api_key_id',
        'operation_type',
        'status',
        'to_address',
        'token_id',
        'amount',
        'metadata',
        'transaction_hash',
        'error_message',
        'processed_at',
        'created_at',
        'updated_at',
      ])
      .executeTakeFirstOrThrow();

    return this.mapToDomain(result);
  }

  async update(id: string, data: any): Promise<DeveloperNftOperation> {
    const now = new Date();

    const result = await this.database
      .updateTable('developer_nft_operations')
      .set({
        ...data,
        updated_at: now,
      })
      .where('id', '=', id)
      .returning([
        'id',
        'api_key_id',
        'operation_type',
        'status',
        'to_address',
        'token_id',
        'amount',
        'metadata',
        'transaction_hash',
        'error_message',
        'processed_at',
        'created_at',
        'updated_at',
      ])
      .executeTakeFirstOrThrow();

    return this.mapToDomain(result);
  }

  async delete(id: string): Promise<void> {
    await this.database
      .deleteFrom('developer_nft_operations')
      .where('id', '=', id)
      .execute();
  }

  private mapToDomain(row: any): DeveloperNftOperation {
    return new DeveloperNftOperation(
      row.id,
      row.api_key_id,
      row.operation_type,
      row.status,
      row.to_address,
      row.token_id,
      row.amount ? parseInt(row.amount, 10) : null,
      row.metadata ? JSON.parse(row.metadata) : null,
      row.transaction_hash,
      row.error_message,
      row.processed_at,
      row.created_at,
      row.updated_at,
    );
  }
}
