import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the assets table
 * @param db Instance of Kysely connected to the database
 */
export async function createAssetsTable(db: Kysely<Database>): Promise<void> {
  try {
    // Check if the assets table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'assets' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating assets table...');

      // Create the table
      await sql`
        CREATE TABLE assets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          description VARCHAR NOT NULL,
          image_url VARCHAR NOT NULL,
          price DECIMAL(18, 2) NOT NULL,
          tags TEXT[] NOT NULL DEFAULT '{}'::text[],
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      // Create index
      await sql`
        CREATE INDEX assets_name_idx ON assets (name)
      `.execute(db);

      console.log('Assets table created successfully');
      return;
    }

    console.log('Assets table already exists');
  } catch (error) {
    console.error('Error creating assets table:', error);
    throw error;
  }
}
