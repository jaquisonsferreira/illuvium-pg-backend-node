// Queue names for Bull job processing
export const BLOCKCHAIN_QUEUES = {
  BLOCK_PROCESSOR: 'blockchain:block-processor',
  EVENT_SYNC: 'blockchain:event-sync',
} as const;

// EventBridge event types
export const BLOCKCHAIN_EVENT_TYPES = {
  // ETH Events
  ETH_TRANSFERRED: 'blockchain.eth.transferred',

  // Token Events
  TOKEN_MINTED: 'blockchain.token.minted',
  TOKEN_BURNED: 'blockchain.token.burned',
  TOKEN_TRANSFERRED: 'blockchain.token.transferred',
  TOKEN_METADATA_UPDATED: 'blockchain.token.metadata_updated',
  TOKEN_APPROVAL: 'blockchain.token.approval',
  TOKEN_APPROVAL_FOR_ALL: 'blockchain.token.approval_for_all',

  // Contract Events
  CONTRACT_PAUSED: 'blockchain.contract.paused',
  CONTRACT_UNPAUSED: 'blockchain.contract.unpaused',
  CONTRACT_UPGRADED: 'blockchain.contract.upgraded',
  CONTRACT_OWNERSHIP_TRANSFERRED: 'blockchain.contract.ownership_transferred',
  CONTRACT_DISCOVERED: 'blockchain.contract.discovered',
} as const;

// Obelisk specific event types
export const OBELISK_EVENT_TYPES = {
  // Marketplace Events
  LISTING_CREATED: 'blockchain.marketplace.listingcreated',
  ITEM_SOLD: 'blockchain.marketplace.itemsold',
  LISTING_CANCELLED: 'blockchain.marketplace.listingcancelled',
  LISTING_UPDATED: 'blockchain.marketplace.listingupdated',

  // Order Events
  ORDER_CREATED: 'blockchain.order.ordercreated',
  ORDER_FILLED: 'blockchain.order.orderfilled',
  ORDER_CANCELLED: 'blockchain.order.ordercancelled',

  // Royalty Events
  ROYALTY_PAID: 'blockchain.royalty.royaltypaid',
  PLATFORM_FEE_PAID: 'blockchain.royalty.platformfeepaid',
  ROYALTY_SET: 'blockchain.royalty.royaltyset',
} as const;

// Event source for AWS EventBridge
export const EVENT_BRIDGE_SOURCE = 'obelisk.blockchain';

// Obelisk Marketplace Contract Addresses
export const OBELISK_CONTRACTS = {
  MARKETPLACE_PROXY: '0x72B48843f968C1610D15D713ddf40D85dd1ba0A8',
  ORDER_MANAGER_PROXY: '0xF82D707eC33704f33b3f22c4ae8BeE1eCD5162B8',
  ROYALTY_MANAGER_PROXY: '0xDB521aBbcef3518C150D866Bb643325f4c3A459E',

  // Mock ERC20 Tokens - Public Minting Enabled
  TOKENS: {
    USDT: '0x5Ca310E0b534032434E3Ed21A6d684112d9E41C5',
    USDC: '0x47Fec288a317eCaC07d35D8A549De6Da622b79b2',
    DAI: '0x6e44f85Ee88dc6110493A4e0DC65f04ce745fF60',
    WETH: '0xdaB3B43E59730ab60033DBe3c93f84BB5b04d3F5',
  },

  // Mock NFT Collections - Public Minting Enabled
  NFT_COLLECTIONS: {
    TEST_ART: '0x90Ef0bfdB26f026b52C1225c6c72d09fa9D321a0',
    GAME_ITEMS: '0xd1bCe537F814687e4AA3EE6C32AFc6832dEA651f',
    PROFILE_PICTURES: '0x8F92fb69919D99EF1B47943d818E5F672D127958',
  },

  // Mock ERC1155 Collections - Public Minting Enabled
  ERC1155_COLLECTIONS: {
    MULTI_TOKEN: '0x0Ca878d9333F7ebeD2bE2ED40aE9d4cF5E1FB09e',
  },
} as const;

// Network configurations
export const SUPPORTED_NETWORKS = {
  ETHEREUM: {
    chainId: 1,
    name: 'ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    wsUrl: process.env.ETHEREUM_WEBSOCKET_URL,
  },
  POLYGON: {
    chainId: 137,
    name: 'polygon',
    rpcUrl: process.env.POLYGON_RPC_URL,
    wsUrl: process.env.POLYGON_WEBSOCKET_URL,
  },
  OBELISK_TESTNET: {
    chainId: 8453200017,
    name: 'obelisk-testnet',
    rpcUrl:
      process.env.OBELISK_RPC_URL ||
      'https://obelisk-rpc-testnet.appchain.base.org/',
    wsUrl: process.env.OBELISK_WEBSOCKET_URL,
    deployer: '0x90933cd33A2Aa7084bF085e06a5BF72E21CEDdDE',
    platformFee: 250, // 250 basis points
    feeRecipient: '0x90933cd33A2Aa7084bF085e06a5BF72E21CEDdDE',
    nativeETHSupport: true,
  },
} as const;

// Block processing intervals (milliseconds)
export const BLOCK_SYNC_INTERVALS = {
  ETHEREUM: 5000, // 5 seconds
  POLYGON: 2000, // 2 seconds
  OBELISK_TESTNET: 3000, // 3 seconds
} as const;
