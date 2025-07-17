# Developer Contribution Verification Setup

This document explains how to set up the verification services for developer contributions in the OCSAS module.

## Prerequisites

### 1. Block Explorer API Keys

You need to obtain API keys from the following block explorers:

- **Etherscan**: https://etherscan.io/apis
- **Basescan**: https://basescan.org/apis
- **Arbiscan**: https://arbiscan.io/apis
- **Optimism Etherscan**: https://optimistic.etherscan.io/apis

### 2. GitHub Personal Access Token

Create a GitHub Personal Access Token:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Create a new token with the following scopes:
   - `repo` (Full control of private repositories)
   - `read:user` (Read user profile data)
   - `user:email` (Access user email addresses)

### 3. RPC Endpoints

The default RPC endpoints are provided, but you may want to use your own for better performance:
- Ethereum: Consider using Infura, Alchemy, or QuickNode
- Base: Consider using the official Base RPC or a premium provider
- Arbitrum: Consider using the official Arbitrum RPC or a premium provider
- Optimism: Consider using the official Optimism RPC or a premium provider

## Configuration

Add the following environment variables to your `.env` file:

```env
# Blockchain Verification
ETHEREUM_RPC_URL=https://eth.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io

# Block Explorer API Keys
ETHERSCAN_API_KEY=your-etherscan-api-key
BASESCAN_API_KEY=your-basescan-api-key
ARBISCAN_API_KEY=your-arbiscan-api-key
OPTIMISM_ETHERSCAN_API_KEY=your-optimism-etherscan-api-key

# GitHub API
GITHUB_API_TOKEN=your-github-personal-access-token
```

## Verification Process

### Smart Contract Deployment Verification

When a developer submits a smart contract deployment contribution, the system will:

1. Verify the transaction exists on-chain
2. Confirm the deployer address matches the claiming wallet
3. Check that the contract address in the transaction matches the claimed address
4. Verify the contract has bytecode deployed
5. Store the block number and timestamp for audit purposes

### Contract Verification Check

For verified contract contributions, the system will:

1. Query the block explorer API to check verification status
2. Confirm the contract is verified on the respective chain's explorer
3. Cache the verification status to reduce API calls

### GitHub Contribution Verification

For GitHub contributions, the system will:

1. Extract repository and PR/commit information from the URL
2. Verify the PR exists and is merged OR the commit is in the main branch
3. Check that the author matches the claimed identity (if email provided)
4. Store contribution metadata for audit purposes

## Rate Limits

Be aware of the following rate limits:

- **Etherscan/Basescan**: 5 calls/second (free tier)
- **GitHub API**: 5,000 requests/hour (authenticated)
- **RPC Endpoints**: Varies by provider

## Testing

To test the verification services:

1. **Smart Contract Deployment**:
   ```typescript
   const details = {
     contractAddress: '0x...',
     transactionHash: '0x...',
     deployerAddress: '0x...',
     chainId: 1, // Ethereum mainnet
   };
   ```

2. **GitHub Contribution**:
   ```typescript
   const details = {
     githubUrl: 'https://github.com/owner/repo/pull/123',
     authorEmail: 'developer@example.com', // optional
   };
   ```

## Troubleshooting

### Common Issues

1. **API Key Invalid**: Ensure your API keys are correctly set in the environment variables
2. **Rate Limit Exceeded**: Implement caching and rate limiting in production
3. **RPC Connection Failed**: Check your RPC URLs and network connectivity
4. **GitHub Token Permissions**: Ensure your token has the required scopes

### Debug Mode

Enable debug logging for verification services:

```typescript
// In your main.ts or app configuration
import { Logger } from '@nestjs/common';

Logger.setLogLevels(['log', 'error', 'warn', 'debug', 'verbose']);
```

## Security Considerations

1. **Never commit API keys or tokens** to version control
2. **Use environment variables** for all sensitive configuration
3. **Implement rate limiting** to prevent API quota exhaustion
4. **Cache verification results** to reduce external API calls
5. **Validate all input** before making external API calls
6. **Use HTTPS** for all external API communications

## Future Enhancements

- Support for additional chains (Polygon, BSC, etc.)
- Integration with more code platforms (GitLab, Bitbucket)
- Automated wallet-to-GitHub identity verification
- Support for npm package publications
- Integration with bug bounty platforms