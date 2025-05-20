import { Kysely, sql } from 'kysely';
import { Database } from '../database.types';

/**
 * Base repository that implements common CRUD operations
 * @template TableName - Name of the table in Database
 * @template Entity - Type of the entity
 * @template NewEntity - Type for creating entity
 * @template UpdateEntity - Type for updating entity
 */
export abstract class BaseRepository<
  TableName extends keyof Database,
  Entity,
  NewEntity,
  UpdateEntity,
> {
  constructor(
    protected readonly db: Kysely<Database>,
    protected readonly tableName: TableName,
  ) {}

  /**
   * Create a new entity in the database
   */
  async create(entity: NewEntity): Promise<Entity> {
    return (await this.db
      .insertInto(this.tableName)
      .values(entity as any)
      .returningAll()
      .executeTakeFirstOrThrow()) as unknown as Entity;
  }

  /**
   * Find an entity by ID
   */
  async findById(id: string): Promise<Entity | null> {
    const result = await sql`
      SELECT * FROM ${sql.table(this.tableName)}
      WHERE id = ${id}
      LIMIT 1
    `.execute(this.db);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Entity;
  }

  /**
   * List all entities
   */
  async findAll(): Promise<Entity[]> {
    const result = await sql`
      SELECT * FROM ${sql.table(this.tableName)}
    `.execute(this.db);

    return result.rows as unknown as Entity[];
  }

  /**
   * Update an entity
   */
  async update(id: string, entity: UpdateEntity): Promise<Entity | null> {
    const updateData = {
      ...(entity as any),
      updated_at: new Date(),
    };

    const updateColumns = Object.keys(updateData);
    const setFragments = updateColumns.map(
      (col) => sql`${sql.id(col)} = ${updateData[col]}`,
    );

    const result = await sql`
      UPDATE ${sql.table(this.tableName)}
      SET ${sql.join(setFragments, sql`, `)}
      WHERE id = ${id}
      RETURNING *
    `.execute(this.db);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Entity;
  }

  /**
   * Remove an entity
   */
  async delete(id: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM ${sql.table(this.tableName)}
      WHERE id = ${id}
    `.execute(this.db);

    return (result.numAffectedRows ?? 0) > 0;
  }

  /**
   * Returns a query builder for selection
   * Useful for more complex queries
   */
  protected getSelectBuilder() {
    return this.db.selectFrom(this.tableName);
  }
}
