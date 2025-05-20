import { Kysely } from 'kysely';
import { BaseRepository } from './base.repository';
import { Database } from '../database.types';

/**
 * Factory to create typed base repositories
 */
export class RepositoryFactory {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * create a repository for a specific table
   *
   * @param tableName name of the table
   * @returns instance of the repository for the specified table
   */
  createRepository<
    TableName extends keyof Database,
    Entity,
    NewEntity,
    UpdateEntity,
  >(
    tableName: TableName,
  ): BaseRepository<TableName, Entity, NewEntity, UpdateEntity> {
    class ConcreteRepository extends BaseRepository<
      TableName,
      Entity,
      NewEntity,
      UpdateEntity
    > {
      constructor(db: Kysely<Database>, table: TableName) {
        super(db, table);
      }
    }

    return new ConcreteRepository(this.db, tableName);
  }
}
