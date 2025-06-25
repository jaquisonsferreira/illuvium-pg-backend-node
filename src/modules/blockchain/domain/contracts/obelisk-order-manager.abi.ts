export const OBELISK_ORDER_MANAGER_ABI = [
  // Order Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderHash', type: 'bytes32' },
      { indexed: true, name: 'maker', type: 'address' },
      { indexed: false, name: 'tokenContract', type: 'address' },
      { indexed: false, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'price', type: 'uint256' },
    ],
    name: 'OrderCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderHash', type: 'bytes32' },
      { indexed: true, name: 'taker', type: 'address' },
      { indexed: false, name: 'fillAmount', type: 'uint256' },
    ],
    name: 'OrderFilled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderHash', type: 'bytes32' },
      { indexed: true, name: 'maker', type: 'address' },
    ],
    name: 'OrderCancelled',
    type: 'event',
  },

  // Functions
  {
    inputs: [
      {
        components: [
          { name: 'maker', type: 'address' },
          { name: 'taker', type: 'address' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'paymentToken', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
        name: 'order',
        type: 'tuple',
      },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'createOrder',
    outputs: [{ name: 'orderHash', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'maker', type: 'address' },
          { name: 'taker', type: 'address' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'paymentToken', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
        name: 'order',
        type: 'tuple',
      },
      { name: 'signature', type: 'bytes' },
      { name: 'fillAmount', type: 'uint256' },
    ],
    name: 'fillOrderThroughMarketplace',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    name: 'cancelOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    name: 'orders',
    outputs: [
      { name: 'maker', type: 'address' },
      { name: 'taker', type: 'address' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'expiration', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'filled', type: 'uint256' },
      { name: 'cancelled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    name: 'getOrderHash',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;

export const ORDER_TYPEHASH =
  'Order(address maker,address taker,address tokenContract,uint256 tokenId,uint256 price,address paymentToken,uint256 amount,uint256 expiration,uint256 nonce)';

export const EIP712_DOMAIN = {
  name: 'Obelisk Order Manager',
  version: '1.0',
  chainId: 8453200017,
};
