import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export const createTokenMetadataTable = {
  up: async (db: Kysely<any>): Promise<void> => {
    await db.schema
      .createTable('token_metadata')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('token_address', 'varchar(42)', (col) => col.notNull())
      .addColumn('chain', 'varchar(20)', (col) => col.notNull())
      .addColumn('symbol', 'varchar(20)', (col) => col.notNull())
      .addColumn('name', 'varchar(100)', (col) => col.notNull())
      .addColumn('decimals', 'integer', (col) => col.notNull())
      .addColumn('total_supply', 'decimal(36, 0)')
      .addColumn('circulating_supply', 'decimal(36, 0)')
      .addColumn('coingecko_id', 'varchar(100)')
      .addColumn('is_lp_token', 'boolean', (col) =>
        col.defaultTo(false).notNull(),
      )
      .addColumn('token0_address', 'varchar(42)') // For LP tokens
      .addColumn('token1_address', 'varchar(42)') // For LP tokens
      .addColumn('pool_address', 'varchar(42)') // For LP tokens
      .addColumn('dex_name', 'varchar(50)') // For LP tokens (e.g., 'uniswap-v2', 'aerodrome')
      .addColumn('logo_url', 'varchar(500)')
      .addColumn('contract_type', 'varchar(20)') // ERC20, ERC721, ERC1155
      .addColumn('is_verified', 'boolean', (col) =>
        col.defaultTo(false).notNull(),
      )
      .addColumn('last_updated', 'timestamp', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn('updated_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // Add unique constraint
    await db.schema
      .createIndex('idx_token_metadata_unique')
      .on('token_metadata')
      .columns(['token_address', 'chain'])
      .unique()
      .execute();

    // Add indexes
    await db.schema
      .createIndex('idx_token_metadata_symbol')
      .on('token_metadata')
      .column('symbol')
      .execute();

    await db.schema
      .createIndex('idx_token_metadata_coingecko_id')
      .on('token_metadata')
      .column('coingecko_id')
      .execute();

    await db.schema
      .createIndex('idx_token_metadata_is_lp')
      .on('token_metadata')
      .column('is_lp_token')
      .execute();

    await db.schema
      .createIndex('idx_token_metadata_last_updated')
      .on('token_metadata')
      .column('last_updated')
      .execute();
  },

  down: async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('token_metadata').execute();
  },
};
