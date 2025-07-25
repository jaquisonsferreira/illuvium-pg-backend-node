import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export const createPriceHistoryTable = {
  up: async (db: Kysely<any>): Promise<void> => {
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
    await db.schema
      .createIndex('idx_price_history_unique')
      .on('price_history')
      .columns(['token_address', 'chain', 'timestamp', 'granularity', 'source'])
      .unique()
      .execute();

    // Add indexes for common queries
    await db.schema
      .createIndex('idx_price_history_token_chain')
      .on('price_history')
      .columns(['token_address', 'chain'])
      .execute();

    await db.schema
      .createIndex('idx_price_history_timestamp')
      .on('price_history')
      .column('timestamp')
      .execute();

    await db.schema
      .createIndex('idx_price_history_source')
      .on('price_history')
      .column('source')
      .execute();

    await db.schema
      .createIndex('idx_price_history_granularity')
      .on('price_history')
      .column('granularity')
      .execute();
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('price_history').execute();
  },
};
