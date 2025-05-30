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

      // Create the users table following the existing structure
      await sql`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          privy_id VARCHAR UNIQUE NOT NULL,
          nickname VARCHAR NULL,
          avatar_url VARCHAR NULL,
          experiments JSONB NULL,
          social_bluesky VARCHAR NULL,
          social_discord VARCHAR NULL,
          social_instagram VARCHAR NULL,
          social_farcaster VARCHAR NULL,
          social_twitch VARCHAR NULL,
          social_youtube VARCHAR NULL,
          social_x VARCHAR NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      // Create the linked_accounts table
      await sql`
        CREATE TABLE linked_accounts (
          owner UUID REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR NOT NULL,
          identifier VARCHAR NOT NULL,
          email_address VARCHAR NULL,
          label VARCHAR NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now(),
          PRIMARY KEY(owner, type, identifier)
        )
      `.execute(db);

      // Create indexes for users table
      await sql`
        CREATE UNIQUE INDEX users_privy_id_idx ON users (privy_id)
      `.execute(db);

      await sql`
        CREATE UNIQUE INDEX users_nickname_idx ON users (nickname) WHERE nickname IS NOT NULL
      `.execute(db);

      await sql`
        CREATE INDEX users_is_active_idx ON users (is_active)
      `.execute(db);

      // Create indexes for linked_accounts table
      await sql`
        CREATE INDEX linked_accounts_owner_idx ON linked_accounts (owner)
      `.execute(db);

      await sql`
        CREATE INDEX linked_accounts_owner_wallets_idx ON linked_accounts (owner) WHERE type = 'wallet'
      `.execute(db);

      console.log('Users and linked_accounts tables created successfully');
      return;
    }

    console.log('Users table already exists');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
}
