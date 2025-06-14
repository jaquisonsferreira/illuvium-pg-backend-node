import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createDeveloperAuditLogsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'developer_audit_logs' AND table_schema = 'public'
    `.execute(db);

    if (tableExists.rows.length === 0) {
      console.log('Creating developer_audit_logs table...');

      await sql`
        CREATE TABLE developer_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('contract.paused', 'contract.unpaused', 'contract.ownership_transferred')),
          contract_address VARCHAR(42) NOT NULL,
          actor_address VARCHAR(42) NOT NULL,
          network_name VARCHAR(50) NOT NULL,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          previous_value VARCHAR NULL,
          new_value VARCHAR NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      await sql`
        CREATE INDEX developer_audit_logs_contract_address_idx ON developer_audit_logs (contract_address)
      `.execute(db);

      await sql`
        CREATE INDEX developer_audit_logs_actor_address_idx ON developer_audit_logs (actor_address)
      `.execute(db);

      await sql`
        CREATE INDEX developer_audit_logs_event_type_idx ON developer_audit_logs (event_type)
      `.execute(db);

      await sql`
        CREATE INDEX developer_audit_logs_transaction_hash_idx ON developer_audit_logs (transaction_hash)
      `.execute(db);

      await sql`
        CREATE INDEX developer_audit_logs_timestamp_idx ON developer_audit_logs (timestamp)
      `.execute(db);

      await sql`
        CREATE INDEX developer_audit_logs_network_name_idx ON developer_audit_logs (network_name)
      `.execute(db);

      await sql`
        CREATE UNIQUE INDEX developer_audit_logs_tx_event_unique_idx ON developer_audit_logs (transaction_hash, event_type)
      `.execute(db);

      console.log('developer_audit_logs table created successfully');
    } else {
      console.log('developer_audit_logs table already exists');
    }
  } catch (error) {
    console.error('Error creating developer_audit_logs table:', error);
    throw error;
  }
}
