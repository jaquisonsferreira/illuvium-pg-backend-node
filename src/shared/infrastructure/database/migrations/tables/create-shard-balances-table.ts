import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import {
  tableExists,
  indexExists,
  constraintExists,
} from '../utils/migration-helpers';

export const createShardBalancesTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'shard_balances')) {
      console.log('Shard balances table already exists, skipping creation');
      return;
    }

    console.log('Creating shard_balances table...');
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
    if (!(await indexExists(db, 'idx_shard_balances_wallet_season'))) {
      await db.schema
        .createIndex('idx_shard_balances_wallet_season')
        .on('shard_balances')
        .columns(['wallet_address', 'season_id'])
        .unique()
        .execute();
    }

    // Add indexes
    if (!(await indexExists(db, 'idx_shard_balances_wallet'))) {
      await db.schema
        .createIndex('idx_shard_balances_wallet')
        .on('shard_balances')
        .column('wallet_address')
        .execute();
    }

    if (!(await indexExists(db, 'idx_shard_balances_season'))) {
      await db.schema
        .createIndex('idx_shard_balances_season')
        .on('shard_balances')
        .column('season_id')
        .execute();
    }

    if (!(await indexExists(db, 'idx_shard_balances_total_shards'))) {
      await db.schema
        .createIndex('idx_shard_balances_total_shards')
        .on('shard_balances')
        .column('total_shards')
        .execute();
    }

    // Add foreign key
    if (!(await constraintExists(db, 'fk_shard_balances_season'))) {
      await sql`
        ALTER TABLE shard_balances
        ADD CONSTRAINT fk_shard_balances_season
        FOREIGN KEY (season_id) REFERENCES seasons(id)
      `.execute(db);
    }

    console.log('Shard balances table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('shard_balances').execute();
  },
};
