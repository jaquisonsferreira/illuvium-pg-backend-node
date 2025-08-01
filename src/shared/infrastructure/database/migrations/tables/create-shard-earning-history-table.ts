import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { tableExists, indexExists, constraintExists } from '../utils/migration-helpers';

export const createShardEarningHistoryTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'shard_earning_history')) {
      console.log('Shard earning history table already exists, skipping creation');
      return;
    }

    console.log('Creating shard_earning_history table...');
    await db.schema
      .createTable('shard_earning_history')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('wallet_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('season_id', 'integer', (col) => col.notNull())
      .addColumn('date', 'date', (col) => col.notNull())
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
      .addColumn('daily_total', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('vault_breakdown', 'jsonb')
      .addColumn('metadata', 'jsonb')
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add unique constraint
    if (!(await indexExists(db, 'idx_shard_history_wallet_date'))) {
      await db.schema
        .createIndex('idx_shard_history_wallet_date')
        .on('shard_earning_history')
        .columns(['wallet_address', 'date', 'season_id'])
        .unique()
        .execute();
    }

    // Add indexes
    if (!(await indexExists(db, 'idx_shard_history_wallet'))) {
      await db.schema
        .createIndex('idx_shard_history_wallet')
        .on('shard_earning_history')
        .column('wallet_address')
        .execute();
    }

    if (!(await indexExists(db, 'idx_shard_history_date'))) {
      await db.schema
        .createIndex('idx_shard_history_date')
        .on('shard_earning_history')
        .column('date')
        .execute();
    }

    if (!(await indexExists(db, 'idx_shard_history_season_date'))) {
      await db.schema
        .createIndex('idx_shard_history_season_date')
        .on('shard_earning_history')
        .columns(['season_id', 'date'])
        .execute();
    }

    // Add foreign key
    if (!(await constraintExists(db, 'fk_shard_history_season'))) {
      await sql`
        ALTER TABLE shard_earning_history
        ADD CONSTRAINT fk_shard_history_season
        FOREIGN KEY (season_id) REFERENCES seasons(id)
      `.execute(db);
    }

    console.log('Shard earning history table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('shard_earning_history').execute();
  },
};
