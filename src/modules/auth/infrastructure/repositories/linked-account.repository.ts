import { Injectable, Inject } from '@nestjs/common';
import { LinkedAccountRepositoryInterface } from '../../domain/repositories/linked-account.repository.interface';
import { LinkedAccountEntity } from '../../domain/entities/linked-account.entity';
import {
  Database,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';
import { sql } from 'kysely';

@Injectable()
export class LinkedAccountRepository
  implements LinkedAccountRepositoryInterface
{
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {}

  async findByOwner(owner: string): Promise<LinkedAccountEntity[]> {
    const results = await sql`
      SELECT * FROM linked_accounts
      WHERE owner = ${owner}
      ORDER BY created_at DESC
    `.execute(this.db);

    return results.rows.map(
      (row: any) =>
        new LinkedAccountEntity({
          owner: row.owner,
          type: row.type,
          identifier: row.identifier,
          emailAddress: row.email_address || undefined,
          label: row.label || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }

  async findByTypeAndIdentifier(
    type: string,
    identifier: string,
  ): Promise<LinkedAccountEntity | null> {
    const result = await this.db
      .selectFrom('linked_accounts')
      .selectAll()
      .where('type', '=', type)
      .where('identifier', '=', identifier)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return new LinkedAccountEntity({
      owner: result.owner,
      type: result.type,
      identifier: result.identifier,
      emailAddress: result.email_address || undefined,
      label: result.label || undefined,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    });
  }

  async findWalletsByOwner(owner: string): Promise<LinkedAccountEntity[]> {
    const result = await this.db
      .selectFrom('linked_accounts')
      .selectAll()
      .where('owner', '=', owner)
      .where('type', '=', 'wallet')
      .orderBy('created_at', 'asc')
      .execute();

    return result.map(
      (row: any) =>
        new LinkedAccountEntity({
          owner: row.owner,
          type: row.type,
          identifier: row.identifier,
          emailAddress: row.email_address || undefined,
          label: row.label || undefined,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }),
    );
  }

  async findEmailByOwner(owner: string): Promise<LinkedAccountEntity | null> {
    const result = await this.db
      .selectFrom('linked_accounts')
      .selectAll()
      .where('owner', '=', owner)
      .where('type', '=', 'email')
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return new LinkedAccountEntity({
      owner: result.owner,
      type: result.type,
      identifier: result.identifier,
      emailAddress: result.email_address || undefined,
      label: result.label || undefined,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    });
  }

  async save(linkedAccount: LinkedAccountEntity): Promise<LinkedAccountEntity> {
    const props = linkedAccount.toJSON();

    const result = await this.db
      .insertInto('linked_accounts')
      .values({
        owner: props.owner,
        type: props.type,
        identifier: props.identifier,
        email_address: props.emailAddress || null,
        label: props.label || null,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      })
      .onConflict((oc) =>
        oc.columns(['owner', 'type', 'identifier']).doUpdateSet({
          email_address: props.emailAddress || null,
          label: props.label || null,
          updated_at: props.updatedAt,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return new LinkedAccountEntity({
      owner: result.owner,
      type: result.type,
      identifier: result.identifier,
      emailAddress: result.email_address || undefined,
      label: result.label || undefined,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    });
  }

  async delete(owner: string, type: string, identifier: string): Promise<void> {
    await this.db
      .deleteFrom('linked_accounts')
      .where('owner', '=', owner)
      .where('type', '=', type)
      .where('identifier', '=', identifier)
      .execute();
  }

  async deleteAllByOwner(owner: string): Promise<void> {
    await this.db
      .deleteFrom('linked_accounts')
      .where('owner', '=', owner)
      .execute();
  }
}
