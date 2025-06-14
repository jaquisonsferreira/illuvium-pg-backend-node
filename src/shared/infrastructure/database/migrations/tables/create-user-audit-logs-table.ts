import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createUserAuditLogsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'user_audit_logs' AND table_schema = 'public'
    `.execute(db);

    if (tableExists.rows.length === 0) {
      console.log('Creating user_audit_logs table...');

      await sql`
        CREATE TABLE user_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_address VARCHAR(42) NOT NULL,
          event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('token.minted', 'token.transferred', 'token.burned')),
          contract_address VARCHAR(42) NOT NULL,
          token_id VARCHAR NOT NULL,
          network_name VARCHAR(50) NOT NULL,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          amount VARCHAR NULL,
          from_address VARCHAR(42) NULL,
          to_address VARCHAR(42) NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      await sql`
        CREATE INDEX user_audit_logs_user_address_idx ON user_audit_logs (user_address)
      `.execute(db);

      await sql`
        CREATE INDEX user_audit_logs_contract_address_idx ON user_audit_logs (contract_address)
      `.execute(db);

      await sql`
        CREATE INDEX user_audit_logs_event_type_idx ON user_audit_logs (event_type)
      `.execute(db);

      await sql`
        CREATE INDEX user_audit_logs_transaction_hash_idx ON user_audit_logs (transaction_hash)
      `.execute(db);

      await sql`
        CREATE INDEX user_audit_logs_timestamp_idx ON user_audit_logs (timestamp)
      `.execute(db);

      await sql`
        CREATE INDEX user_audit_logs_network_name_idx ON user_audit_logs (network_name)
      `.execute(db);

      await sql`
        CREATE UNIQUE INDEX user_audit_logs_tx_event_unique_idx ON user_audit_logs (transaction_hash, event_type)
      `.execute(db);

      console.log('user_audit_logs table created successfully');
    } else {
      console.log('user_audit_logs table already exists');
    }
  } catch (error) {
    console.error('Error creating user_audit_logs table:', error);
    throw error;
  }
}
