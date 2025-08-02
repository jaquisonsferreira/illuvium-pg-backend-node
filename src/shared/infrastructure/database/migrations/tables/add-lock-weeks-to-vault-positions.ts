import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export const addLockWeeksToVaultPositions = {
  up: async (db: Kysely<any>): Promise<void> => {
    // Check if column already exists
    const result = await db
      .selectFrom('information_schema.columns')
      .select('column_name')
      .where('table_schema', '=', 'public')
      .where('table_name', '=', 'vault_positions')
      .where('column_name', '=', 'lock_weeks')
      .executeTakeFirst();

    if (result) {
      console.log('lock_weeks column already exists, skipping');
      return;
    }

    await db.schema
      .alterTable('vault_positions')
      .addColumn('lock_weeks', 'integer', (col) => col.notNull().defaultTo(4))
      .execute();

    // Add check constraint separately
    await db.schema
      .alterTable('vault_positions')
      .addCheckConstraint(
        'vault_positions_lock_weeks_check',
        sql`lock_weeks >= 4 AND lock_weeks <= 48`,
      )
      .execute();

    await db.schema
      .createIndex('idx_vault_positions_lock_weeks')
      .on('vault_positions')
      .column('lock_weeks')
      .execute();
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema
      .alterTable('vault_positions')
      .dropColumn('lock_weeks')
      .execute();
  },
};
