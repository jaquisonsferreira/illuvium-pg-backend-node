import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { tableExists, indexExists } from '../utils/migration-helpers';

export const createPriceHistoryTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'price_history')) {
      console.log('Price history table already exists, skipping creation');
      return;
    }

    console.log('Creating price_history table...');
    await db.schema
      .createTable('price_history')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('token_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('chain', 'varchar(20)', (col) => col.notNull())
      .addColumn('price_usd', 'decimal(20, 8)', (col) => col.notNull())
      .addColumn('price_change_24h', 'decimal(10, 4)')
      .addColumn('market_cap', 'decimal(30, 2)')
      .addColumn('volume_24h', 'decimal(30, 2)')
      .addColumn('timestamp', 'timestamp', (col) => col.notNull())
      .addColumn('source', 'varchar(50)', (col) => col.notNull())
      .addColumn('granularity', 'varchar(20)', (col) => col.notNull()) // hourly, daily
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add unique constraint to prevent duplicate entries
    if (!(await indexExists(db, 'idx_price_history_unique'))) {
      await db.schema
        .createIndex('idx_price_history_unique')
        .on('price_history')
        .columns(['token_address', 'chain', 'timestamp', 'granularity', 'source'])
        .unique()
        .execute();
    }

    // Add indexes for common queries
    if (!(await indexExists(db, 'idx_price_history_token_chain'))) {
      await db.schema
        .createIndex('idx_price_history_token_chain')
        .on('price_history')
        .columns(['token_address', 'chain'])
        .execute();
    }

    if (!(await indexExists(db, 'idx_price_history_timestamp'))) {
      await db.schema
        .createIndex('idx_price_history_timestamp')
        .on('price_history')
        .column('timestamp')
        .execute();
    }

    if (!(await indexExists(db, 'idx_price_history_source'))) {
      await db.schema
        .createIndex('idx_price_history_source')
        .on('price_history')
        .column('source')
        .execute();
    }

    if (!(await indexExists(db, 'idx_price_history_granularity'))) {
      await db.schema
        .createIndex('idx_price_history_granularity')
        .on('price_history')
        .column('granularity')
        .execute();
    }

    console.log('Price history table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('price_history').execute();
  },
};
