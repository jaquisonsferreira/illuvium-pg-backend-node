import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the users table
 * @param db Instance of Kysely connected to the database
 */
export async function createUsersTable(db: Kysely<Database>): Promise<void> {
  try {
    // Check if the users table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'users' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating users table...');

      // Create the table
      await sql`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          privy_id VARCHAR UNIQUE NOT NULL,
          wallet_address VARCHAR NULL,
          email VARCHAR NULL,
          phone_number VARCHAR NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      // Create indexes
      await sql`
        CREATE UNIQUE INDEX users_privy_id_idx ON users (privy_id)
      `.execute(db);

      await sql`
        CREATE INDEX users_wallet_address_idx ON users (wallet_address)
      `.execute(db);

      await sql`
        CREATE INDEX users_email_idx ON users (email)
      `.execute(db);

      await sql`
        CREATE INDEX users_is_active_idx ON users (is_active)
      `.execute(db);

      console.log('Users table created successfully');
      return;
    }

    console.log('Users table already exists');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
}
