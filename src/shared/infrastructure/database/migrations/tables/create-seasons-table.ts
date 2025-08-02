import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { tableExists, indexExists } from '../utils/migration-helpers';

export const createSeasonsTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'seasons')) {
      console.log('Seasons table already exists, skipping creation');
      return;
    }

    console.log('Creating seasons table...');
    await db.schema
      .createTable('seasons')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('name', 'varchar(100)', (col) => col.notNull())
      .addColumn('chain', 'varchar(20)', (col) => col.notNull())
      .addColumn('start_date', 'timestamp', (col) => col.notNull())
      .addColumn('end_date', 'timestamp')
      .addColumn('status', 'varchar(20)', (col) =>
        col.notNull().defaultTo('upcoming'),
      )
      .addColumn('config', 'jsonb', (col) => col.notNull())
      .addColumn('total_participants', 'integer', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('total_shards_issued', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn('updated_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add indexes
    if (!(await indexExists(db, 'idx_seasons_status'))) {
      await db.schema
        .createIndex('idx_seasons_status')
        .on('seasons')
        .column('status')
        .execute();
    }

    if (!(await indexExists(db, 'idx_seasons_chain'))) {
      await db.schema
        .createIndex('idx_seasons_chain')
        .on('seasons')
        .column('chain')
        .execute();
    }

    console.log('Seasons table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('seasons').execute();
  },
};
