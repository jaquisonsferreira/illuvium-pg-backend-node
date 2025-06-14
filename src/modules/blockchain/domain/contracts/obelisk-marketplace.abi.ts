export const OBELISK_MARKETPLACE_ABI = [
  // Listing Management
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'listingId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: true, name: 'nftContract', type: 'address' },
      { indexed: false, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'paymentToken', type: 'address' },
      { indexed: false, name: 'expirationTime', type: 'uint256' },
    ],
    name: 'ListingCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'listingId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'platformFeeAmount', type: 'uint256' },
      { indexed: false, name: 'sellerAmount', type: 'uint256' },
    ],
    name: 'ItemSold',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'listingId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
    ],
    name: 'ListingCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'listingId', type: 'uint256' },
      { indexed: false, name: 'newPrice', type: 'uint256' },
      { indexed: false, name: 'newExpirationTime', type: 'uint256' },
    ],
    name: 'ListingUpdated',
    type: 'event',
  },

  // Price Management Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'tokenContract', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: true, name: 'validator', type: 'address' },
      { indexed: false, name: 'isValid', type: 'bool' },
      { indexed: false, name: 'reason', type: 'string' },
    ],
    name: 'PriceValidated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'listingId', type: 'uint256' },
      { indexed: false, name: 'basePrice', type: 'uint256' },
      { indexed: false, name: 'priceChangeRate', type: 'uint256' },
      { indexed: false, name: 'maxMultiplier', type: 'uint256' },
      { indexed: false, name: 'minMultiplier', type: 'uint256' },
    ],
    name: 'DynamicPricingEnabled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'tokenContract', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'paymentToken', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'PriceHistoryRecorded',
    type: 'event',
  },

  // Functions
  {
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
      { name: 'duration', type: 'uint256' },
    ],
    name: 'createListing',
    outputs: [{ name: 'listingId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'buy',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'cancelListing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'newPrice', type: 'uint256' },
      { name: 'newExpirationTime', type: 'uint256' },
    ],
    name: 'updateListing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'listings',
    outputs: [
      { name: 'seller', type: 'address' },
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
      { name: 'listingTime', type: 'uint256' },
      { name: 'expirationTime', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'getPriceHistory',
    outputs: [
      { name: 'lastSalePrice', type: 'uint256' },
      { name: 'lastSaleTime', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
      { name: 'saleCount', type: 'uint256' },
      { name: 'lastPaymentToken', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
