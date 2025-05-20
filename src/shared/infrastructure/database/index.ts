export { Kysely } from 'kysely';

import db from './kysely.config';
import { MigrationRunner } from './migrations/migration-provider';
import { setupDatabaseSchema } from './schema-setup';

// Export the db instance for use in the entire application
export { db, MigrationRunner, setupDatabaseSchema };

// Export types for use in the entire application
export * from './database.types';
export * from './repositories/repository.factory';
export * from './repositories/base.repository';
export * from './constants';
