import { createAssetsTable } from './tables/create-assets-table';

// Export all migrations as an array to be executed in order
export const migrations = [
  createAssetsTable,
  // Add new migrations here in chronological order
];
