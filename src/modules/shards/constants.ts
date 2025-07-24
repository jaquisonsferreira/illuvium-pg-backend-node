export const SHARD_QUEUES = {
  DAILY_PROCESSOR: 'shard:daily-processor',
  VAULT_SYNC: 'shard:vault-sync',
  SOCIAL_SYNC: 'shard:social-sync',
  DEVELOPER_SYNC: 'shard:developer-sync',
  REFERRAL_PROCESSOR: 'shard:referral-processor',
} as const;

export const SHARD_CACHE_KEYS = {
  BALANCE: 'shards:balance',
  HISTORY: 'shards:history',
  LEADERBOARD: 'shards:leaderboard',
  SEASON: 'shards:season',
  PRICES: 'shards:prices',
  PRICE_DATA: 'shards:price-data',
  VAULT_DATA: 'shards:vault-data',
  VAULT_POSITIONS: 'shards:vault-positions',
  DEVELOPER_VERIFICATION: 'shards:developer-verification',
} as const;

export const SHARD_CACHE_TTL = {
  BALANCE: 86400, // 24 hours
  HISTORY: 86400, // 24 hours
  LEADERBOARD: 86400, // 24 hours
  SEASON: 3600, // 1 hour
  PRICES: 3600, // 1 hour
  PRICES_FALLBACK: 86400, // 24 hours fallback
  PRICE_DATA: 300, // 5 minutes
  VAULT_DATA: 3600, // 1 hour
  VAULT_POSITIONS: 900, // 15 minutes
  HISTORICAL_DATA: 86400, // 24 hours
  DEVELOPER_VERIFICATION: 86400, // 24 hours
} as const;

export const SHARD_PROCESSING_WINDOW = {
  START_HOUR: 2, // 02:00 UTC
  END_HOUR: 4, // 04:00 UTC
} as const;

export const VAULT_RATES = {
  SEASON_1: {
    ILV: 80, // 80 Shards / $1000 / day (updated as per GitHub issue #24)
    'ILV/ETH': 150, // 150 Shards / $1000 / day for LP token
    ETH: 150, // 150 Shards / $1000 / day (TBD - keeping for compatibility)
    BTC: 150, // 150 Shards / $1000 / day (TBD - keeping for compatibility)
    USDT: 100, // 100 Shards / $1000 / day (TBD - keeping for compatibility)
    USDC: 100, // 100 Shards / $1000 / day (TBD - keeping for compatibility)
    DAI: 100, // 100 Shards / $1000 / day (TBD - keeping for compatibility)
  },
} as const;

export const REFERRAL_CONFIG = {
  REFERRER_BONUS_RATE: 0.2, // 20% of referee's shards
  MAX_REFERRER_BONUS_PER_REFERRAL: 500, // Max 500 shards per referral
  REFEREE_MULTIPLIER: 1.2, // 1.2x multiplier for referee
  REFEREE_BONUS_DURATION_DAYS: 30, // 30 days bonus period
  ACTIVATION_THRESHOLD: 100, // 100 shards minimum to activate
  MAX_REFERRALS_PER_SEASON: 10, // Max 10 referrals per wallet per season
  MAX_REFERRALS_PER_WALLET: 10, // Alias for backward compatibility
} as const;

export const ANTI_FRAUD_CONFIG = {
  MIN_WALLET_TRANSACTIONS: 30, // Minimum on-chain transactions
  FRAUD_DETECTION_THRESHOLD: 10, // 10x average = suspicious
  MAX_DAILY_VARIANCE: 5, // 5x variance from average
} as const;

export const KAITO_CONFIG = {
  YAP_TO_SHARD_RATE: 100, // 100 yap points = 1 shard
} as const;

export const DEVELOPER_REWARDS = {
  DEPLOY_CONTRACT: 500,
  DEPLOY_DAPP: 500,
  CONTRIBUTE_CODE: 100,
  FIX_BUG: 200,
  COMPLETE_BOUNTY: 300,
} as const;

export const SUPPORTED_CHAINS = [
  'base',
  'ethereum',
  'arbitrum',
  'optimism',
] as const;

export const SEASON_CHAINS = {
  SEASON_1: ['base', 'ethereum'], // Season 1 supports both Base and Ethereum
  SEASON_2_PLUS: 'o',
} as const;

export const SEASON_1_CHAINS = ['base', 'ethereum'] as const;
export const SEASON_1_PRIMARY_CHAIN = 'base' as const;

export const EARNING_CATEGORIES = [
  'staking',
  'social',
  'developer',
  'referral',
] as const;

export type EarningCategory = (typeof EARNING_CATEGORIES)[number];
