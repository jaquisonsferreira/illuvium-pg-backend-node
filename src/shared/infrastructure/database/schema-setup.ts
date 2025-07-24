import { Kysely } from 'kysely';
import { Database } from './database.types';
import { migrations } from './migrations';

/**
 * Configure and verify the database schema
 * This is an alternative to the Kysely migrations system that has problems with CockroachDB
 */
export async function setupDatabaseSchema(db: Kysely<Database>): Promise<void> {
  try {
    console.log('Starting database schema configuration...');

    // Execute all migrations in sequence
    for (const migration of migrations) {
      // Check if migration is an object with up method or a function
      if (typeof migration === 'function') {
        await migration(db);
      } else if (migration && typeof migration.up === 'function') {
        await migration.up(db);
      } else {
        throw new Error('Invalid migration format');
      }
    }

    console.log('Database schema configuration completed successfully');
  } catch (error) {
    console.error('Failed to configure the database schema');
    console.error(error);
    throw error;
  }
}
