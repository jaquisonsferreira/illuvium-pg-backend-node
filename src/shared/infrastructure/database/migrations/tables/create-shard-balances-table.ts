import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export const createShardBalancesTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    await db.schema
      .createTable('shard_balances')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('wallet_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('season_id', 'integer', (col) => col.notNull())
      .addColumn('staking_shards', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('social_shards', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('developer_shards', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('referral_shards', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('total_shards', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('last_calculated_at', 'timestamp', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn('updated_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add unique constraint
    await db.schema
      .createIndex('idx_shard_balances_wallet_season')
      .on('shard_balances')
      .columns(['wallet_address', 'season_id'])
      .unique()
      .execute();

    // Add indexes
    await db.schema
      .createIndex('idx_shard_balances_wallet')
      .on('shard_balances')
      .column('wallet_address')
      .execute();

    await db.schema
      .createIndex('idx_shard_balances_season')
      .on('shard_balances')
      .column('season_id')
      .execute();

    await db.schema
      .createIndex('idx_shard_balances_total_shards')
      .on('shard_balances')
      .column('total_shards')
      .execute();

    // Add foreign key
    await sql`
    ALTER TABLE shard_balances
    ADD CONSTRAINT fk_shard_balances_season
    FOREIGN KEY (season_id) REFERENCES seasons(id)
  `.execute(db);
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('shard_balances').execute();
  },
};
