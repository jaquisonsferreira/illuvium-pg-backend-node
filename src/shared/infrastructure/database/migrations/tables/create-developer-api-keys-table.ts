import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createDeveloperApiKeysTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'developer_api_keys' AND table_schema = 'public'
    `.execute(db);

    if (tableExists.rows.length === 0) {
      console.log('Creating developer_api_keys table...');

      await sql`
        CREATE TABLE developer_api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key_hash VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          permissions TEXT[] NOT NULL DEFAULT '{}',
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'REVOKED')),
          expires_at TIMESTAMP NULL,
          last_used_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      await sql`
        CREATE INDEX developer_api_keys_key_hash_idx ON developer_api_keys (key_hash)
      `.execute(db);

      await sql`
        CREATE INDEX developer_api_keys_status_idx ON developer_api_keys (status)
      `.execute(db);

      await sql`
        CREATE INDEX developer_api_keys_expires_at_idx ON developer_api_keys (expires_at)
      `.execute(db);

      await sql`
        CREATE INDEX developer_api_keys_created_at_idx ON developer_api_keys (created_at)
      `.execute(db);

      console.log('✅ developer_api_keys table created successfully');
    } else {
      console.log('ℹ️ developer_api_keys table already exists, skipping...');
    }
  } catch (error) {
    console.error('❌ Error creating developer_api_keys table:', error);
    throw error;
  }
}
