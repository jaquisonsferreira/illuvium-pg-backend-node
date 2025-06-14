export interface BaseBlockchainEvent {
  eventType: string;
  networkName: string;
  blockNumber: number;
  transactionHash: string;
  blockHash: string;
  logIndex: number;
  timestamp: Date;
}

export interface EthTransferredEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.eth.transferred';
  from: string;
  to: string;
  value: string; // wei amount as string
}

export interface TokenMintedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.token.minted';
  contractAddress: string;
  to: string;
  tokenId: string;
  amount?: string; // for ERC1155
}

export interface TokenBurnedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.token.burned';
  contractAddress: string;
  from: string;
  tokenId: string;
  amount?: string; // for ERC1155
}

export interface TokenTransferredEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.token.transferred';
  contractAddress: string;
  from: string;
  to: string;
  tokenId: string;
  amount?: string; // for ERC1155
}

export interface TokenMetadataUpdatedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.token.metadata_updated';
  contractAddress: string;
  tokenId: string;
  metadataUri: string;
}

export interface TokenApprovalEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.token.approval';
  contractAddress: string;
  owner: string;
  approved: string;
  tokenId: string;
}

export interface TokenApprovalForAllEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.token.approval_for_all';
  contractAddress: string;
  owner: string;
  operator: string;
  approved: boolean;
}

export interface ContractPausedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.contract.paused';
  contractAddress: string;
  account: string;
}

export interface ContractUnpausedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.contract.unpaused';
  contractAddress: string;
  account: string;
}

export interface ContractUpgradedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.contract.upgraded';
  contractAddress: string;
  implementation: string;
}

export interface ContractOwnershipTransferredEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.contract.ownership_transferred';
  contractAddress: string;
  previousOwner: string;
  newOwner: string;
}

export interface ContractDiscoveredEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.contract.discovered';
  contractAddress: string;
  contractType: 'ERC20' | 'ERC721' | 'ERC1155';
  name?: string;
  symbol?: string;
  decimals?: number;
}

// Obelisk Marketplace Events
export interface ObeliskListingCreatedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.marketplace.listingcreated';
  contractAddress: string;
  listingId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  price: string;
  paymentToken: string;
  expirationTime: string;
}

export interface ObeliskItemSoldEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.marketplace.itemsold';
  contractAddress: string;
  listingId: string;
  seller: string;
  buyer: string;
  price: string;
  platformFeeAmount: string;
  sellerAmount: string;
}

export interface ObeliskListingCancelledEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.marketplace.listingcancelled';
  contractAddress: string;
  listingId: string;
  seller: string;
}

export interface ObeliskListingUpdatedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.marketplace.listingupdated';
  contractAddress: string;
  listingId: string;
  newPrice: string;
  newExpirationTime: string;
}

// Obelisk Order Events
export interface ObeliskOrderCreatedEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.order.ordercreated';
  contractAddress: string;
  orderHash: string;
  maker: string;
  tokenContract: string;
  tokenId: string;
  price: string;
}

export interface ObeliskOrderFilledEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.order.orderfilled';
  contractAddress: string;
  orderHash: string;
  taker: string;
  fillAmount: string;
}

export interface ObeliskOrderCancelledEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.order.ordercancelled';
  contractAddress: string;
  orderHash: string;
  maker: string;
}

// Obelisk Royalty Events
export interface ObeliskRoyaltyPaidEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.royalty.royaltypaid';
  contractAddress: string;
  tokenContract: string;
  tokenId: string;
  recipient: string;
  amount: string;
  token: string;
}

export interface ObeliskPlatformFeePaidEvent extends BaseBlockchainEvent {
  eventType: 'blockchain.royalty.platformfeepaid';
  contractAddress: string;
  recipient: string;
  amount: string;
  token: string;
}

export type BlockchainEvent =
  | EthTransferredEvent
  | TokenMintedEvent
  | TokenBurnedEvent
  | TokenTransferredEvent
  | TokenMetadataUpdatedEvent
  | TokenApprovalEvent
  | TokenApprovalForAllEvent
  | ContractPausedEvent
  | ContractUnpausedEvent
  | ContractUpgradedEvent
  | ContractOwnershipTransferredEvent
  | ContractDiscoveredEvent
  | ObeliskListingCreatedEvent
  | ObeliskItemSoldEvent
  | ObeliskListingCancelledEvent
  | ObeliskListingUpdatedEvent
  | ObeliskOrderCreatedEvent
  | ObeliskOrderFilledEvent
  | ObeliskOrderCancelledEvent
  | ObeliskRoyaltyPaidEvent
  | ObeliskPlatformFeePaidEvent;

export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processedAt: Date;
  error?: string;
}

export interface BlockProcessingJob {
  networkName: string;
  blockNumber: number;
  priority?: number;
}

export interface EventSyncJob {
  networkName: string;
  fromBlock: number;
  toBlock: number;
  contractAddresses?: string[];
}
