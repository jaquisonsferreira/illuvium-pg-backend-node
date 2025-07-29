import type { Kysely } from 'kysely';

export const addLockWeeksToVaultPositions = {
  up: async (db: Kysely<any>): Promise<void> => {
    await db.schema
      .alterTable('vault_positions')
      .addColumn('lock_weeks', 'integer', (col) =>
        col
          .notNull()
          .defaultTo(4)
          .check('lock_weeks >= 4 AND lock_weeks <= 48' as any),
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
