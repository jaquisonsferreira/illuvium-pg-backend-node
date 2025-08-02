import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import {
  tableExists,
  indexExists,
  constraintExists,
} from '../utils/migration-helpers';

export const createReferralsTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'referrals')) {
      console.log('Referrals table already exists, skipping creation');
      return;
    }

    console.log('Creating referrals table...');
    await db.schema
      .createTable('referrals')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('referrer_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('referee_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('season_id', 'integer', (col) => col.notNull())
      .addColumn('status', 'varchar(20)', (col) =>
        col.notNull().defaultTo('pending'),
      )
      .addColumn('activation_date', 'timestamp')
      .addColumn('referee_multiplier_expires', 'timestamp')
      .addColumn('total_shards_earned', 'decimal(20, 2)', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn('updated_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add unique constraint
    if (!(await indexExists(db, 'idx_referrals_referee_season'))) {
      await db.schema
        .createIndex('idx_referrals_referee_season')
        .on('referrals')
        .columns(['referee_address', 'season_id'])
        .unique()
        .execute();
    }

    // Add indexes
    if (!(await indexExists(db, 'idx_referrals_referrer_season'))) {
      await db.schema
        .createIndex('idx_referrals_referrer_season')
        .on('referrals')
        .columns(['referrer_address', 'season_id'])
        .execute();
    }

    if (!(await indexExists(db, 'idx_referrals_status'))) {
      await db.schema
        .createIndex('idx_referrals_status')
        .on('referrals')
        .column('status')
        .execute();
    }

    if (!(await indexExists(db, 'idx_referrals_activation_date'))) {
      await db.schema
        .createIndex('idx_referrals_activation_date')
        .on('referrals')
        .column('activation_date')
        .execute();
    }

    // Add foreign key
    if (!(await constraintExists(db, 'fk_referrals_season'))) {
      await sql`
        ALTER TABLE referrals
        ADD CONSTRAINT fk_referrals_season
        FOREIGN KEY (season_id) REFERENCES seasons(id)
      `.execute(db);
    }

    // Add check constraint
    if (!(await constraintExists(db, 'chk_referrals_different_addresses'))) {
      await sql`
        ALTER TABLE referrals
        ADD CONSTRAINT chk_referrals_different_addresses
        CHECK (referrer_address != referee_address)
      `.execute(db);
    }

    console.log('Referrals table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('referrals').execute();
  },
};
