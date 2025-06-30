import { createAssetsTable } from './tables/create-assets-table';
import { createUsersTable } from './tables/create-users-table';
import { createBlockchainContractsTable } from './tables/create-blockchain-contracts-table';
import { createBlockchainAssetsTable } from './tables/create-blockchain-assets-table';
import { createAssetTransactionsTable } from './tables/create-asset-transactions-table';
import { createAssetMarketplaceTable } from './tables/create-asset-marketplace-table';
import { createUserAuditLogsTable } from './tables/create-user-audit-logs-table';
import { createDeveloperAuditLogsTable } from './tables/create-developer-audit-logs-table';

export const migrations = [
  createAssetsTable,
  createUsersTable,
  createBlockchainContractsTable,
  createBlockchainAssetsTable,
  createAssetTransactionsTable,
  createAssetMarketplaceTable,
  createUserAuditLogsTable,
  createDeveloperAuditLogsTable,
];
