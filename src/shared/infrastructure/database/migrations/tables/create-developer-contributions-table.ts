import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import {
  tableExists,
  indexExists,
  constraintExists,
} from '../utils/migration-helpers';

export const createDeveloperContributionsTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'developer_contributions')) {
      console.log(
        'Developer contributions table already exists, skipping creation',
      );
      return;
    }

    console.log('Creating developer_contributions table...');
    await db.schema
      .createTable('developer_contributions')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('wallet_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('season_id', 'integer', (col) => col.notNull())
      .addColumn('action_type', 'varchar(50)', (col) => col.notNull())
      .addColumn('action_details', 'jsonb', (col) => col.notNull())
      .addColumn('shards_earned', 'decimal(20, 2)', (col) => col.notNull())
      .addColumn('verified', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('verified_at', 'timestamp')
      .addColumn('verified_by', 'varchar(100)')
      .addColumn('distributed_at', 'timestamp')
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn('updated_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add indexes
    if (!(await indexExists(db, 'idx_developer_contributions_wallet_season'))) {
      await db.schema
        .createIndex('idx_developer_contributions_wallet_season')
        .on('developer_contributions')
        .columns(['wallet_address', 'season_id'])
        .execute();
    }

    if (!(await indexExists(db, 'idx_developer_contributions_action_type'))) {
      await db.schema
        .createIndex('idx_developer_contributions_action_type')
        .on('developer_contributions')
        .column('action_type')
        .execute();
    }

    if (!(await indexExists(db, 'idx_developer_contributions_verified'))) {
      await db.schema
        .createIndex('idx_developer_contributions_verified')
        .on('developer_contributions')
        .column('verified')
        .execute();
    }

    if (!(await indexExists(db, 'idx_developer_contributions_distributed'))) {
      await db.schema
        .createIndex('idx_developer_contributions_distributed')
        .on('developer_contributions')
        .column('distributed_at')
        .execute();
    }

    // Add foreign key
    if (!(await constraintExists(db, 'fk_developer_contributions_season'))) {
      await sql`
        ALTER TABLE developer_contributions
        ADD CONSTRAINT fk_developer_contributions_season
        FOREIGN KEY (season_id) REFERENCES seasons(id)
      `.execute(db);
    }

    console.log('Developer contributions table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('developer_contributions').execute();
  },
};
