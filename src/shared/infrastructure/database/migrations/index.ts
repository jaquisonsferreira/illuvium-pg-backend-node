import { createAssetsTable } from './tables/create-assets-table';
import { createUsersTable } from './tables/create-users-table';
import { createBlockchainContractsTable } from './tables/create-blockchain-contracts-table';
import { createBlockchainAssetsTable } from './tables/create-blockchain-assets-table';
import { createAssetTransactionsTable } from './tables/create-asset-transactions-table';
import { createAssetMarketplaceTable } from './tables/create-asset-marketplace-table';

// Export all migrations as an array to be executed in order
export const migrations = [
  createAssetsTable,
  createUsersTable,
  createBlockchainContractsTable,
  createBlockchainAssetsTable,
  createAssetTransactionsTable,
  createAssetMarketplaceTable,
];
