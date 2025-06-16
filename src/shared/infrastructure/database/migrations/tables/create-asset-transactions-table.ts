import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the asset_transactions table
 * @param db Instance of Kysely connected to the database
 */
export async function createAssetTransactionsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    // Check if the asset_transactions table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'asset_transactions' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating asset_transactions table...');

      // Create the table
      await sql`
        CREATE TABLE asset_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_id UUID NOT NULL REFERENCES blockchain_assets(id) ON DELETE CASCADE,
          transaction_hash VARCHAR NOT NULL,
          block_number VARCHAR NOT NULL,
          event_type VARCHAR NOT NULL CHECK (event_type IN ('TRANSFER', 'MINT', 'BURN', 'APPROVAL', 'APPROVAL_FOR_ALL')),
          from_address VARCHAR NOT NULL,
          to_address VARCHAR NOT NULL,
          value VARCHAR NULL,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      // Create indexes
      await sql`
        CREATE INDEX asset_transactions_asset_idx ON asset_transactions (asset_id)
      `.execute(db);

      await sql`
        CREATE INDEX asset_transactions_hash_idx ON asset_transactions (transaction_hash)
      `.execute(db);

      await sql`
        CREATE INDEX asset_transactions_block_idx ON asset_transactions (block_number)
      `.execute(db);

      await sql`
        CREATE INDEX asset_transactions_event_type_idx ON asset_transactions (event_type)
      `.execute(db);

      await sql`
        CREATE INDEX asset_transactions_from_idx ON asset_transactions (from_address)
      `.execute(db);

      await sql`
        CREATE INDEX asset_transactions_to_idx ON asset_transactions (to_address)
      `.execute(db);

      await sql`
        CREATE INDEX asset_transactions_timestamp_idx ON asset_transactions (timestamp DESC)
      `.execute(db);

      console.log('Asset transactions table created successfully');
      return;
    }

    console.log('Asset transactions table already exists');
  } catch (error) {
    console.error('Error creating asset_transactions table:', error);
    throw error;
  }
}
