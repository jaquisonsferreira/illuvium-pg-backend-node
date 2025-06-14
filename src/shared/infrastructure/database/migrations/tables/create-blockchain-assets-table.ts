import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the blockchain_assets table
 * @param db Instance of Kysely connected to the database
 */
export async function createBlockchainAssetsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    // Check if the blockchain_assets table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'blockchain_assets' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating blockchain_assets table...');

      // Create the table
      await sql`
        CREATE TABLE blockchain_assets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contract_id UUID NOT NULL REFERENCES blockchain_contracts(id) ON DELETE CASCADE,
          token_id VARCHAR NULL,
          owner_address VARCHAR NOT NULL,
          balance VARCHAR NOT NULL DEFAULT '0',
          metadata JSONB NULL,
          last_updated_block VARCHAR NOT NULL DEFAULT '0',
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      // Create indexes
      await sql`
        CREATE INDEX blockchain_assets_contract_idx ON blockchain_assets (contract_id)
      `.execute(db);

      await sql`
        CREATE INDEX blockchain_assets_owner_idx ON blockchain_assets (owner_address)
      `.execute(db);

      await sql`
        CREATE INDEX blockchain_assets_contract_token_idx ON blockchain_assets (contract_id, token_id)
      `.execute(db);

      await sql`
        CREATE UNIQUE INDEX blockchain_assets_unique_token_idx ON blockchain_assets (contract_id, token_id)
        WHERE token_id IS NOT NULL
      `.execute(db);

      await sql`
        CREATE INDEX blockchain_assets_owner_contract_idx ON blockchain_assets (owner_address, contract_id)
      `.execute(db);

      await sql`
        CREATE INDEX blockchain_assets_updated_block_idx ON blockchain_assets (last_updated_block)
      `.execute(db);

      console.log('Blockchain assets table created successfully');
      return;
    }

    console.log('Blockchain assets table already exists');
  } catch (error) {
    console.error('Error creating blockchain_assets table:', error);
    throw error;
  }
}
