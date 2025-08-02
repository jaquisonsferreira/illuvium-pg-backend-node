export const OBELISK_SEASONAL_VAULT_ABI = {
  abi: [
    {
      type: 'function',
      name: 'asset',
      inputs: [],
      outputs: [{ name: '', type: 'address', internalType: 'address' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'balanceOf',
      inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
      outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'convertToAssets',
      inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
      outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'convertToShares',
      inputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
      outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'decimals',
      inputs: [],
      outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'deposit',
      inputs: [
        { name: 'assets', type: 'uint256', internalType: 'uint256' },
        { name: 'receiver', type: 'address', internalType: 'address' },
      ],
      outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'nonpayable',
    },
    {
      type: 'function',
      name: 'totalAssets',
      inputs: [],
      outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'totalSupply',
      inputs: [],
      outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'withdraw',
      inputs: [
        { name: 'assets', type: 'uint256', internalType: 'uint256' },
        { name: 'receiver', type: 'address', internalType: 'address' },
        { name: 'owner', type: 'address', internalType: 'address' },
      ],
      outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'nonpayable',
    },
    {
      type: 'function',
      name: 'getSeasonStatus',
      inputs: [],
      outputs: [
        {
          name: '',
          type: 'uint8',
          internalType: 'enum ObeliskSeasonalVault.SeasonStatus',
        },
      ],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'mainnetLaunched',
      inputs: [],
      outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
      stateMutability: 'view',
    },
    {
      type: 'event',
      name: 'Deposit',
      inputs: [
        {
          name: 'sender',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'owner',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'assets',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'shares',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
      ],
      anonymous: false,
    },
    {
      type: 'event',
      name: 'Withdraw',
      inputs: [
        {
          name: 'sender',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'receiver',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'owner',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'assets',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'shares',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
      ],
      anonymous: false,
    },
    {
      type: 'event',
      name: 'VaultDeposit',
      inputs: [
        {
          name: 'vault',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'user',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'shares',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'assets',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'timestamp',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
      ],
      anonymous: false,
    },
    {
      type: 'event',
      name: 'VaultWithdrawal',
      inputs: [
        {
          name: 'vault',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'user',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'shares',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'assets',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'timestamp',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
      ],
      anonymous: false,
    },
    {
      type: 'event',
      name: 'VaultTransfer',
      inputs: [
        {
          name: 'vault',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        {
          name: 'from',
          type: 'address',
          indexed: true,
          internalType: 'address',
        },
        { name: 'to', type: 'address', indexed: true, internalType: 'address' },
        {
          name: 'shares',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
        {
          name: 'timestamp',
          type: 'uint256',
          indexed: false,
          internalType: 'uint256',
        },
      ],
      anonymous: false,
    },
  ],
} as const;

// ERC20 ABI for token decimals and basic operations
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
] as const;

// LP Token specific ABI for Uniswap V2 style pairs
export const LP_TOKEN_ABI = [
  ...ERC20_ABI,
  {
    type: 'function',
    name: 'getReserves',
    inputs: [],
    outputs: [
      { name: '_reserve0', type: 'uint112', internalType: 'uint112' },
      { name: '_reserve1', type: 'uint112', internalType: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32', internalType: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token0',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token1',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const;
