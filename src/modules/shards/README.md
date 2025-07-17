# OCSAS - Obelisk Off-Chain Shard Attribution System

## Overview

The OCSAS module implements the complete shard reward system for the Illuvium ecosystem. It tracks and manages off-chain points (shards) earned through various activities.

## Architecture

The module follows Clean Architecture principles with clear separation of concerns:

```
src/modules/shards/
├── domain/                 # Business logic and entities
│   ├── entities/          # Domain models
│   ├── repositories/      # Repository interfaces
│   └── services/          # Domain services
├── application/           # Use cases and application logic
│   └── use-cases/        # Application use cases
├── infrastructure/        # External integrations
│   ├── repositories/     # Database implementations
│   ├── services/         # External API integrations
│   ├── processors/       # Background job processors
│   └── jobs/            # Queue job definitions
├── interface/            # API layer
│   ├── controllers/     # REST controllers
│   ├── dto/            # Data transfer objects
│   └── schedulers/     # Cron job schedulers
└── swagger/             # API documentation

```

## API Endpoints

### Shard Balance & History

- `GET /api/shards/{walletAddress}` - Get current shard balance
  - Query params: `season`, `chain`, `include_all_seasons`
  - Returns balance breakdown by category and vault

- `GET /api/shards/{walletAddress}/history` - Get earning history
  - Query params: `season`, `chain`, `startDate`, `endDate`, `days`, `page`, `limit`, `vault`
  - Returns daily earning breakdown with pagination

### Referrals

- `GET /api/shards/{walletAddress}/referrals` - Get referral information
  - Query params: `season`, `chain`
  - Returns referral status and active referrals

- `POST /api/shards/{walletAddress}/referrals` - Create a referral
  - Body: `{ "referral_code": "0x..." }`
  - Registers referee with referrer

### Leaderboard

- `GET /api/leaderboard` - Get shard leaderboard
  - Query params: `season`, `timeframe`, `page`, `limit`, `search`, `include_user_position`, `user_wallet`
  - Returns ranked list with optional user position

### Season Management

- `GET /api/seasons` - Get all seasons
- `GET /api/seasons/{seasonId}` - Get specific season
- `POST /api/seasons` - Create new season (admin)
- `PUT /api/seasons/{seasonId}` - Update season (admin)

### System Status

- `GET /api/system/status` - Get system health and status
  - Returns processing status, service health, and queue metrics

## Shard Categories

1. **Staking Shards** - Earned by providing liquidity in vaults
   - ILV: 80 Shards/$1000/day (updated as per GitHub issue #24)
   - ILV/ETH LP: 150 Shards/$1000/day
   - Other assets: TBD

2. **Social Shards** - Earned through Kaito AI engagement
   - Conversion: 100 YAP points = 1 Shard

3. **Developer Shards** - Earned by ecosystem contributions
   - Contract deployment: 500 Shards
   - dApp deployment: 500 Shards
   - Code contributions: 100 Shards
   - Bug fixes: 200 Shards
   - Bounties: 300 Shards

4. **Referral Shards** - Earned through referral system
   - Referrer: 20% of referee's shards (max 500/referral)
   - Referee: 1.2x multiplier for 30 days
   - Max 10 referrals per season

## Daily Processing

The system processes shard calculations daily between 02:00-04:00 UTC:

1. Sync vault positions from blockchain
2. Fetch token prices from CoinGecko
3. Sync social data from Kaito AI
4. Process developer contributions
5. Calculate daily shards for all wallets
6. Update leaderboards and statistics

## Multi-Chain Support

- **Season 1**: Base and Ethereum chains supported
  - Primary chain: Base (default)
  - Secondary chain: Ethereum (optional)
- **Season 2+**: Obelisk chain only

Chain validation is enforced - requests must use a supported chain for each season.

## Error Handling

All errors follow a standardized format:

```json
{
  "statusCode": 400,
  "error": "INVALID_WALLET_ADDRESS",
  "message": "The provided wallet address is invalid",
  "details": [{
    "field": "wallet",
    "message": "Must be a valid Ethereum address",
    "value": "0xinvalid"
  }],
  "path": "/api/shards/0xinvalid",
  "timestamp": "2025-01-15T15:45:30Z"
}
```

Common error codes:
- `INVALID_WALLET_ADDRESS` - Invalid Ethereum address format
- `SEASON_CHAIN_MISMATCH` - Wrong chain for season
- `SEASON_NOT_FOUND` - Season doesn't exist
- `REFERRAL_LIMIT_EXCEEDED` - Max referrals reached
- `SELF_REFERRAL_NOT_ALLOWED` - Cannot refer yourself
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Configuration

Key environment variables:

```env
# API Keys
COINGECKO_API_KEY=your_api_key
KAITO_API_KEY=your_api_key

# The Graph endpoints
SUBGRAPH_URL_BASE=https://api.thegraph.com/subgraphs/name/...
SUBGRAPH_URL_OBELISK=https://api.thegraph.com/subgraphs/name/...

# Redis for queues and caching
REDIS_HOST=localhost
REDIS_PORT=6379

# Processing window
SHARD_PROCESSING_START_HOUR=2
SHARD_PROCESSING_END_HOUR=4
```

## Development

### Running Tests

```bash
# Unit tests
npm run test:unit src/modules/shards

# Integration tests
npm run test:integration src/modules/shards

# E2E tests
npm run test:e2e
```

### Local Development

1. Start dependencies:
   ```bash
   docker-compose up -d postgres redis
   ```

2. Run migrations:
   ```bash
   npm run migration:run
   ```

3. Start development server:
   ```bash
   npm run start:dev
   ```

4. Access Swagger docs: http://localhost:3000/api/docs

## Monitoring

The module provides comprehensive monitoring through:

- Health checks at `/api/system/status`
- OpenTelemetry tracing for all operations
- Prometheus metrics for queue processing
- Structured logging with correlation IDs

## Security Considerations

- All wallet addresses are validated
- No authentication required (public data)
- Rate limiting applied (100 req/min per IP)
- Anti-fraud detection for suspicious activities
- Input validation on all endpoints
- SQL injection protection via Kysely ORM

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] GraphQL API alternative
- [ ] Mobile SDK
- [ ] Webhook notifications
- [ ] Advanced analytics dashboard
- [ ] Multi-signature admin operations