import { promises as fs } from 'fs';
import * as path from 'path';
import { Kysely, Migrator, FileMigrationProvider, sql } from 'kysely';
import { Database } from '../database.types';

/**
 * Class responsible for executing database migrations
 */
export class MigrationRunner {
  private readonly db: Kysely<Database>;
  private readonly migrator: Migrator;

  constructor(db: Kysely<Database>) {
    this.db = db;
    this.migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        // Path to the migrations directory
        migrationFolder: path.join(__dirname, 'migrations'),
      }),
    });
  }

  /**
   * Create the migration table manually for CockroachDB
   * This is a workaround for compatibility issues between Kysely and CockroachDB
   */
  private async ensureMigrationTableExists(): Promise<void> {
    try {
      // Create migration table if it doesn't exist using raw SQL
      await sql`
        CREATE TABLE IF NOT EXISTS kysely_migration (
          name VARCHAR(255) PRIMARY KEY,
          timestamp VARCHAR(255) NOT NULL
        )
      `.execute(this.db);

      // Create migration lock table if it doesn't exist using raw SQL
      await sql`
        CREATE TABLE IF NOT EXISTS kysely_migration_lock (
          id VARCHAR(255) PRIMARY KEY,
          is_locked INTEGER NOT NULL
        )
      `.execute(this.db);

      // Check if we need to initialize the lock
      const lockExists = await sql`
        SELECT id FROM kysely_migration_lock WHERE id = 'migration_lock'
      `.execute(this.db);

      // Initialize with default row if it doesn't exist
      if (lockExists.rows.length === 0) {
        await sql`
          INSERT INTO kysely_migration_lock (id, is_locked)
          VALUES ('migration_lock', 0)
        `.execute(this.db);
        console.log('Migration lock initialized');
      }

      console.log('Migration tables ready');
    } catch (error) {
      console.error('Error creating migration tables:', error);
      throw error;
    }
  }

  /**
   * Execute all pending migrations
   */
  async migrateToLatest(): Promise<void> {
    try {
      // Ensure the migration table exists
      await this.ensureMigrationTableExists();

      const { error, results } = await this.migrator.migrateToLatest();

      if (results && results.length > 0) {
        for (const result of results) {
          if (result.status === 'Success') {
            console.log(
              `Migration "${result.migrationName}" executed successfully`,
            );
          } else if (result.status === 'Error') {
            console.error(
              `Failed to execute migration "${result.migrationName}"`,
            );
          }
        }
      }

      if (error) {
        console.error('Failed to execute migrations');
        console.error(error);
        throw new Error('Error executing migrations');
      }
    } catch (error) {
      console.error('Failed to execute migrations');
      console.error(error);
      throw new Error('Error executing migrations');
    }
  }
}
