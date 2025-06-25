export const OBELISK_ROYALTY_MANAGER_ABI = [
  // Royalty Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'tokenContract', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'token', type: 'address' },
    ],
    name: 'RoyaltyPaid',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: true, name: 'token', type: 'address' },
    ],
    name: 'PlatformFeePaid',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'tokenContract', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'recipient', type: 'address' },
      { indexed: false, name: 'basisPoints', type: 'uint256' },
    ],
    name: 'RoyaltySet',
    type: 'event',
  },

  // Functions
  {
    inputs: [
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'salePrice', type: 'uint256' },
    ],
    name: 'calculateRoyalties',
    outputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'salePrice', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payer', type: 'address' },
    ],
    name: 'distributePlatformFee',
    outputs: [{ name: 'platformFeeAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'basisPoints', type: 'uint256' },
    ],
    name: 'setTokenRoyalty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenContract', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'basisPoints', type: 'uint256' },
    ],
    name: 'setContractRoyalty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'basisPoints', type: 'uint256' },
    ],
    name: 'setDefaultRoyalty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'getRoyaltyInfo',
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'basisPoints', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPlatformFeeInfo',
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'basisPoints', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
