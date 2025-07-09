import { Inject, Injectable } from '@nestjs/common';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';
import {
  IDeveloperApiKeyRepository,
  CreateApiKeyData,
  UpdateApiKeyData,
} from '../../domain/repositories/developer-api-key.repository.interface';
import { ApiKeyStatus } from '../../constants';
import { randomBytes } from 'crypto';
import {
  Database,
  Kysely,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

@Injectable()
export class DeveloperApiKeyRepository implements IDeveloperApiKeyRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {}

  async create(data: CreateApiKeyData): Promise<DeveloperApiKey> {
    const id = randomBytes(16).toString('hex');
    const key = randomBytes(32).toString('hex');
    const now = new Date();

    const result = await this.db
      .insertInto('developer_api_keys')
      .values({
        id,
        user_id: data.userId,
        name: data.name,
        key_hash: key, // TODO: Store the key directly for now, should be hashed in production
        permissions: JSON.stringify(data.permissions),
        is_active: true,
        expires_at: data.expiresAt,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new DeveloperApiKey(
      result.id,
      key, // Return the actual key
      result.name,
      JSON.parse(result.permissions),
      ApiKeyStatus.ACTIVE,
      result.user_id,
      result.expires_at,
      result.created_at,
      result.updated_at,
      result.last_used_at,
    );
  }

  async findById(id: string): Promise<DeveloperApiKey | null> {
    const result = await this.db
      .selectFrom('developer_api_keys')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return new DeveloperApiKey(
      result.id,
      result.key_hash, // Use key_hash from DB
      result.name,
      JSON.parse(result.permissions),
      result.is_active ? ApiKeyStatus.ACTIVE : ApiKeyStatus.INACTIVE,
      result.user_id,
      result.expires_at,
      result.created_at,
      result.updated_at,
      result.last_used_at,
    );
  }

  async findByKey(key: string): Promise<DeveloperApiKey | null> {
    const result = await this.db
      .selectFrom('developer_api_keys')
      .selectAll()
      .where('key_hash', '=', key) // Use key_hash field
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return new DeveloperApiKey(
      result.id,
      result.key_hash,
      result.name,
      JSON.parse(result.permissions),
      result.is_active ? ApiKeyStatus.ACTIVE : ApiKeyStatus.INACTIVE,
      result.user_id,
      result.expires_at,
      result.created_at,
      result.updated_at,
      result.last_used_at,
    );
  }

  async findByUserId(userId: string): Promise<DeveloperApiKey[]> {
    const results = await this.db
      .selectFrom('developer_api_keys')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(
      (result) =>
        new DeveloperApiKey(
          result.id,
          result.key_hash,
          result.name,
          JSON.parse(result.permissions),
          result.is_active ? ApiKeyStatus.ACTIVE : ApiKeyStatus.INACTIVE,
          result.user_id,
          result.expires_at,
          result.created_at,
          result.updated_at,
          result.last_used_at,
        ),
    );
  }

  async update(id: string, data: UpdateApiKeyData): Promise<DeveloperApiKey> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.permissions !== undefined) {
      updateData.permissions = JSON.stringify(data.permissions);
    }
    if (data.status !== undefined) {
      updateData.is_active = data.status === ApiKeyStatus.ACTIVE;
    }
    if (data.expiresAt !== undefined) updateData.expires_at = data.expiresAt;

    updateData.updated_at = new Date();

    const result = await this.db
      .updateTable('developer_api_keys')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new DeveloperApiKey(
      result.id,
      result.key_hash,
      result.name,
      JSON.parse(result.permissions),
      result.is_active ? ApiKeyStatus.ACTIVE : ApiKeyStatus.INACTIVE,
      result.user_id,
      result.expires_at,
      result.created_at,
      result.updated_at,
      result.last_used_at,
    );
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('developer_api_keys')
      .where('id', '=', id)
      .execute();
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db
      .updateTable('developer_api_keys')
      .set({ last_used_at: new Date() })
      .where('id', '=', id)
      .execute();
  }
}
