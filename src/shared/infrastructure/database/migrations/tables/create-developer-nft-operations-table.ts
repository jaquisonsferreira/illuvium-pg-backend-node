import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createDeveloperNftOperationsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'developer_nft_operations' AND table_schema = 'public'
    `.execute(db);

    if (tableExists.rows.length === 0) {
      console.log('Creating developer_nft_operations table...');

      await sql`
        CREATE TABLE developer_nft_operations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
          operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('MINT', 'BURN', 'TRANSFER', 'METADATA_UPDATE', 'SALE')),
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
          to_address VARCHAR(42) NULL,
          token_id VARCHAR(255) NOT NULL,
          amount NUMERIC NULL,
          metadata JSONB NULL,
          transaction_hash VARCHAR(66) NULL,
          error_message TEXT NULL,
          processed_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      await sql`
        CREATE INDEX developer_nft_operations_api_key_id_idx ON developer_nft_operations (api_key_id)
      `.execute(db);

      await sql`
        CREATE INDEX developer_nft_operations_operation_type_idx ON developer_nft_operations (operation_type)
      `.execute(db);

      await sql`
        CREATE INDEX developer_nft_operations_status_idx ON developer_nft_operations (status)
      `.execute(db);

      await sql`
        CREATE INDEX developer_nft_operations_token_id_idx ON developer_nft_operations (token_id)
      `.execute(db);

      await sql`
        CREATE INDEX developer_nft_operations_transaction_hash_idx ON developer_nft_operations (transaction_hash)
      `.execute(db);

      await sql`
        CREATE INDEX developer_nft_operations_created_at_idx ON developer_nft_operations (created_at)
      `.execute(db);

      console.log('✅ developer_nft_operations table created successfully');
    } else {
      console.log(
        'ℹ️ developer_nft_operations table already exists, skipping...',
      );
    }
  } catch (error) {
    console.error('❌ Error creating developer_nft_operations table:', error);
    throw error;
  }
}
