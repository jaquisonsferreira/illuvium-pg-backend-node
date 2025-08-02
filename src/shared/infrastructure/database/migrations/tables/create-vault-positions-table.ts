import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { tableExists, indexExists } from '../utils/migration-helpers';

export const createVaultPositionsTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    if (await tableExists(db, 'vault_positions')) {
      console.log('Vault positions table already exists, skipping creation');
      return;
    }

    console.log('Creating vault_positions table...');
    await db.schema
      .createTable('vault_positions')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('wallet_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('vault_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('asset_symbol', 'varchar(10)', (col) => col.notNull())
      .addColumn('chain', 'varchar(20)', (col) => col.notNull())
      .addColumn('balance', 'decimal(36, 18)', (col) => col.notNull())
      .addColumn('shares', 'decimal(36, 18)', (col) => col.notNull())
      .addColumn('usd_value', 'decimal(20, 2)', (col) => col.notNull())
      .addColumn('snapshot_date', 'date', (col) => col.notNull())
      .addColumn('block_number', 'bigint', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add unique constraint
    if (!(await indexExists(db, 'idx_vault_positions_wallet_vault_date'))) {
      await db.schema
        .createIndex('idx_vault_positions_wallet_vault_date')
        .on('vault_positions')
        .columns(['wallet_address', 'vault_address', 'snapshot_date'])
        .unique()
        .execute();
    }

    // Add indexes
    if (!(await indexExists(db, 'idx_vault_positions_wallet'))) {
      await db.schema
        .createIndex('idx_vault_positions_wallet')
        .on('vault_positions')
        .column('wallet_address')
        .execute();
    }

    if (!(await indexExists(db, 'idx_vault_positions_vault'))) {
      await db.schema
        .createIndex('idx_vault_positions_vault')
        .on('vault_positions')
        .column('vault_address')
        .execute();
    }

    if (!(await indexExists(db, 'idx_vault_positions_date'))) {
      await db.schema
        .createIndex('idx_vault_positions_date')
        .on('vault_positions')
        .column('snapshot_date')
        .execute();
    }

    if (!(await indexExists(db, 'idx_vault_positions_chain_date'))) {
      await db.schema
        .createIndex('idx_vault_positions_chain_date')
        .on('vault_positions')
        .columns(['chain', 'snapshot_date'])
        .execute();
    }

    if (!(await indexExists(db, 'idx_vault_positions_asset'))) {
      await db.schema
        .createIndex('idx_vault_positions_asset')
        .on('vault_positions')
        .column('asset_symbol')
        .execute();
    }

    console.log('Vault positions table created successfully');
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('vault_positions').execute();
  },
};
