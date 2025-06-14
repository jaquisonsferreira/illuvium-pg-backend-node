# Blockchain Recovery Guide

## Overview

This guide provides comprehensive recovery procedures for the Illuvium Obelisk blockchain indexing system. The system is designed to automatically discover, index, and persist NFT data from multiple blockchain networks with built-in recovery mechanisms.

## System Architecture

### Core Components
- **EventListenerService**: Monitors blockchain events in real-time
- **ContractDiscoveryService**: Dynamically discovers new NFT contracts
- **ContractInteractionService**: Handles blockchain contract interactions
- **BlockchainEventBridgeService**: Publishes events to AWS EventBridge
- **Database Repositories**: Persist contracts and NFT data

### Data Flow
```
Blockchain Events → EventListener → ContractInteraction → Database Storage
                                ↓
                         AWS EventBridge → External Systems
```

## Recovery Scenarios

### 1. Database Corruption or Data Loss

#### Symptoms
- Empty or missing data in `blockchain_contracts` or `blockchain_assets` tables
- API endpoints returning no results despite blockchain activity
- Inconsistent data between blockchain state and database

#### Quick Recovery (Recommended)

**Single Command Recovery** - Execute complete recovery in one step:
```bash
# Full automated recovery for obelisk-testnet
curl -X POST http://localhost:3000/api/blockchain/obelisk/full-recovery \
  -H "Content-Type: application/json" \
  -d '{"networkName": "obelisk-testnet"}'

# Full recovery with custom block range
curl -X POST http://localhost:3000/api/blockchain/obelisk/full-recovery \
  -H "Content-Type: application/json" \
  -d '{
    "networkName": "obelisk-testnet",
    "fromBlock": 0,
    "toBlock": 1000000
  }'
```

This endpoint automatically:
1. Discovers contracts from blockchain transactions
2. Schedules historical data synchronization
3. Verifies data integrity in database
4. Returns comprehensive recovery report

#### Manual Recovery Steps (Alternative)

If you need granular control over the recovery process:

1. **Stop all blockchain services**
   ```bash
   # Stop the application
   npm run stop
   ```

2. **Verify database connectivity**
   ```bash
   # Test database connection
   curl -X GET http://localhost:3000/api/blockchain/obelisk/test-db/0x90933cd33A2Aa7084bF085e06a5BF72E21CEDdDE
   ```

3. **Discover and register contracts**
   ```bash
   # Discover contracts dynamically for specific network
   curl -X POST http://localhost:3000/api/blockchain/obelisk/discover-contracts \
     -H "Content-Type: application/json" \
     -d '{"networkName": "obelisk-testnet"}'
   ```

4. **Perform historical sync**
   ```bash
   # Sync all historical data for discovered contracts
   curl -X POST http://localhost:3000/api/blockchain/sync/historical \
     -H "Content-Type: application/json" \
     -d '{"networkName": "obelisk-testnet"}'
   ```

5. **Verify recovery**
   ```bash
   # Test portfolio data
   curl -X GET http://localhost:3000/api/blockchain/obelisk/test-portfolio/0x90933cd33A2Aa7084bF085e06a5BF72E21CEDdDE

   # Test recovery endpoint
   curl -X GET http://localhost:3000/api/blockchain/obelisk/test-recovery/obelisk-testnet
   ```

### 2. Missing Contract Registration

#### Symptoms
- New NFT contracts deployed but not indexed
- Partial data recovery missing recent contracts
- API returning incomplete portfolio data

#### Quick Recovery
```bash
# Full recovery will discover and register new contracts automatically
curl -X POST http://localhost:3000/api/blockchain/obelisk/full-recovery \
  -H "Content-Type: application/json" \
  -d '{"networkName": "obelisk-testnet"}'
```

#### Manual Recovery Steps

1. **Check current registered contracts**
   ```bash
   curl -X GET http://localhost:3000/api/blockchain/obelisk/test-recovery/obelisk-testnet
   ```

2. **Discover new contracts**
   ```bash
   curl -X POST http://localhost:3000/api/blockchain/obelisk/discover-contracts \
     -H "Content-Type: application/json" \
     -d '{"networkName": "obelisk-testnet"}'
   ```

3. **Sync new contract data**
   ```bash
   curl -X POST http://localhost:3000/api/blockchain/sync/historical \
     -H "Content-Type: application/json" \
     -d '{"networkName": "obelisk-testnet"}'
   ```

### 3. Event Processing Failures

#### Symptoms
- Real-time events not being processed
- Queue backlog in Bull dashboard
- Missing recent NFT transfers or mints

#### Recovery Steps

1. **Check queue status**
   - Access Bull dashboard at configured URL
   - Monitor failed jobs and retry counts

2. **Clear failed jobs and restart processing**
   ```bash
   # Restart the application to reset queues
   npm run restart
   ```

3. **Manual event reprocessing**
   ```bash
   # Trigger historical sync to catch missed events
   curl -X POST http://localhost:3000/api/blockchain/sync/historical \
     -H "Content-Type: application/json" \
     -d '{"networkName": "obelisk-testnet"}'
   ```

### 4. Network Connectivity Issues

#### Symptoms
- RPC connection failures
- Timeout errors in blockchain interactions
- Inconsistent data retrieval

#### Recovery Steps

1. **Verify RPC endpoint connectivity**
   ```bash
   # Test basic connectivity
   curl -X POST https://rpc.obelisk.illuvium.io \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

2. **Update RPC configuration if needed**
   - Check environment variables for RPC URLs
   - Verify network configuration in blockchain module

3. **Restart services with new configuration**
   ```bash
   npm run restart
   ```

## Multi-Network Recovery

### Adding New Networks

1. **Update network configuration**
   ```typescript
   // Add to blockchain.constants.ts
   export const NETWORK_CONFIGS = {
     'new-network': {
       chainId: 'CHAIN_ID',
       rpcUrl: 'RPC_URL',
       contracts: {
         // Contract addresses
       }
     }
   };
   ```

2. **Discover contracts for new network**
   ```bash
   curl -X POST http://localhost:3000/api/blockchain/obelisk/discover-contracts \
     -H "Content-Type: application/json" \
     -d '{"networkName": "new-network"}'
   ```

3. **Perform initial sync**
   ```bash
   curl -X POST http://localhost:3000/api/blockchain/sync/historical \
     -H "Content-Type: application/json" \
     -d '{"networkName": "new-network"}'
   ```

## Monitoring and Health Checks

### Key Endpoints for Monitoring

- **Health Check**: `GET /api/blockchain/health`
- **Full Recovery**: `POST /api/blockchain/obelisk/full-recovery` (Primary recovery endpoint)
- **Contract Status**: `GET /api/blockchain/obelisk/test-recovery/{networkName}`
- **Portfolio Test**: `GET /api/blockchain/obelisk/test-portfolio/{address}`
- **Database Test**: `GET /api/blockchain/obelisk/test-db/{address}`

### Expected Data Volumes (Obelisk Testnet)

- **Contracts**: 3 NFT collections
- **NFTs**: 15 total tokens (5 per collection)
- **Collections**:
  - Test Art Collection (TAC): Tokens 1-5
  - Game Items NFT (GAME): Tokens 1-5
  - Profile Pictures (PFP): Tokens 1-5

## Troubleshooting Common Issues

### Database Connection Errors
```bash
# Check database connectivity
npm run db:check

# Run migrations if needed
npm run migration:run
```

### Contract ABI Issues
- Verify ABI files in `src/modules/blockchain/domain/contracts/`
- Ensure contract addresses match deployed contracts
- Check network configuration

### Event Processing Delays
- Monitor Bull queue dashboard
- Check AWS EventBridge delivery status
- Verify event listener service logs

## Best Practices

1. **Regular Health Checks**: Monitor endpoints every 5 minutes
2. **Automated Recovery**: Set up alerts for failed health checks
3. **Data Validation**: Compare blockchain state with database periodically
4. **Backup Strategy**: Regular database backups before major operations
5. **Gradual Rollouts**: Test recovery procedures on staging before production

## Emergency Contacts

- **System Administrator**: [Contact Information]
- **Blockchain Team**: [Contact Information]
- **Database Team**: [Contact Information]

## Recovery Checklist

- [ ] Database connectivity verified
- [ ] Contracts discovered and registered
- [ ] Historical sync completed
- [ ] Real-time event processing active
- [ ] Health checks passing
- [ ] Portfolio data accurate
- [ ] AWS EventBridge publishing
- [ ] Queue processing normally

## Version History

- **v1.0**: Initial recovery procedures
- **v1.1**: Added multi-network support
- **v1.2**: Enhanced monitoring and health checks