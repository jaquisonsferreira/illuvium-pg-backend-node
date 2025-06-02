import { createAssetsTable } from './tables/create-assets-table';
import { createUsersTable } from './tables/create-users-table';

// Export all migrations as an array to be executed in order
export const migrations = [
  createAssetsTable,
  createUsersTable,
  // Add new migrations here in chronological order
];
