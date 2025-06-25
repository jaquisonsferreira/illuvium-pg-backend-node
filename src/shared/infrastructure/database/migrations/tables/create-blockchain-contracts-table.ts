import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the blockchain_contracts table
 * @param db Instance of Kysely connected to the database
 */
export async function createBlockchainContractsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    // Check if the blockchain_contracts table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'blockchain_contracts' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating blockchain_contracts table...');

      // Create the table
      await sql`
        CREATE TABLE blockchain_contracts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          address VARCHAR NOT NULL,
          contract_type VARCHAR NOT NULL CHECK (contract_type IN ('ERC20', 'ERC721', 'ERC1155')),
          name VARCHAR NOT NULL,
          symbol VARCHAR NOT NULL,
          decimals INTEGER NULL,
          network VARCHAR NOT NULL DEFAULT 'immutable-zkevm',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE(address, network)
        )
      `.execute(db);

      // Create indexes
      await sql`
        CREATE UNIQUE INDEX blockchain_contracts_address_idx ON blockchain_contracts (address)
      `.execute(db);

      await sql`
        CREATE INDEX blockchain_contracts_type_idx ON blockchain_contracts (contract_type)
      `.execute(db);

      await sql`
        CREATE INDEX blockchain_contracts_active_idx ON blockchain_contracts (is_active)
      `.execute(db);

      console.log('Blockchain contracts table created successfully');
      return;
    }

    console.log('Blockchain contracts table already exists');
  } catch (error) {
    console.error('Error creating blockchain_contracts table:', error);
    throw error;
  }
}
