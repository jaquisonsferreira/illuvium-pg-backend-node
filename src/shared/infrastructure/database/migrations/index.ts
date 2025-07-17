import { createAssetsTable } from './tables/create-assets-table';
import { createUsersTable } from './tables/create-users-table';
import { createBlockchainContractsTable } from './tables/create-blockchain-contracts-table';
import { createBlockchainAssetsTable } from './tables/create-blockchain-assets-table';
import { createAssetTransactionsTable } from './tables/create-asset-transactions-table';
import { createAssetMarketplaceTable } from './tables/create-asset-marketplace-table';
import { createUserAuditLogsTable } from './tables/create-user-audit-logs-table';
import { createDeveloperAuditLogsTable } from './tables/create-developer-audit-logs-table';
import { createDeveloperApiKeysTable } from './tables/create-developer-api-keys-table';
import { createDeveloperNftOperationsTable } from './tables/create-developer-nft-operations-table';
import { createChatRoomsTable } from './tables/create-chat-rooms-table';
import { createChatMessagesTable } from './tables/create-chat-messages-table';
import { createChatNotificationsTable } from './tables/create-chat-notifications-table';
import { createWebhookSubscriptionsTable } from './tables/create-webhook-subscriptions-table';
import { createSeasonsTable } from './tables/create-seasons-table';
import { createShardBalancesTable } from './tables/create-shard-balances-table';
import { createShardEarningHistoryTable } from './tables/create-shard-earning-history-table';
import { createReferralsTable } from './tables/create-referrals-table';
import { createVaultPositionsTable } from './tables/create-vault-positions-table';
import { createDeveloperContributionsTable } from './tables/create-developer-contributions-table';

export const migrations = [
  createAssetsTable,
  createUsersTable,
  createBlockchainContractsTable,
  createBlockchainAssetsTable,
  createAssetTransactionsTable,
  createAssetMarketplaceTable,
  createUserAuditLogsTable,
  createDeveloperAuditLogsTable,
  createDeveloperApiKeysTable,
  createDeveloperNftOperationsTable,
  createChatRoomsTable,
  createChatMessagesTable,
  createChatNotificationsTable,
  createWebhookSubscriptionsTable,
  createSeasonsTable,
  createShardBalancesTable,
  createShardEarningHistoryTable,
  createReferralsTable,
  createVaultPositionsTable,
  createDeveloperContributionsTable,
];
