# The Graph Protocol Migration Guide

## Issue: Deprecated Subgraph URLs

The hardcoded URLs in `subgraph.service.ts` are using the deprecated hosted service:
- `https://api.thegraph.com/subgraphs/name/*`

These endpoints have been shut down and return the error:
```json
{
  "errors": [
    {
      "message": "This endpoint has been removed. If you have any questions, reach out to support@thegraph.zendesk.com"
    }
  ]
}
```

## Solution: Migrate to The Graph's Decentralized Network

### 1. Update Environment Variables

Add the new subgraph URLs to your `.env` file:

```env
# The Graph Decentralized Network URLs
# Format: https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/[subgraph-id]

# Example for Base chain (you'll need to find the actual subgraph IDs)
SUBGRAPH_URL_BASE=https://gateway-arbitrum.network.thegraph.com/api/YOUR_API_KEY/subgraphs/id/SUBGRAPH_ID

# For Ethereum mainnet
SUBGRAPH_URL_ETHEREUM=https://gateway-arbitrum.network.thegraph.com/api/YOUR_API_KEY/subgraphs/id/SUBGRAPH_ID

# For Arbitrum
SUBGRAPH_URL_ARBITRUM=https://gateway-arbitrum.network.thegraph.com/api/YOUR_API_KEY/subgraphs/id/SUBGRAPH_ID

# For Optimism
SUBGRAPH_URL_OPTIMISM=https://gateway-arbitrum.network.thegraph.com/api/YOUR_API_KEY/subgraphs/id/SUBGRAPH_ID
```

### 2. Get an API Key

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Create an account or sign in
3. Generate an API key
4. Fund your billing balance (queries require GRT tokens)

### 3. Find Subgraph IDs

Search for the subgraphs you need on [The Graph Explorer](https://thegraph.com/explorer):

- Look for vault/DeFi subgraphs for each chain
- Check if they index the data you need (vaults, positions, assets)
- Note the Subgraph ID from the details page

### 4. Update Block Subgraph URLs

The block subgraphs in `getBlockSubgraphUrl()` also need updating:

```typescript
private getBlockSubgraphUrl(chain: string): string {
  // These URLs are also deprecated and need to be updated
  const blockSubgraphUrls: Record<string, string> = {
    base: process.env.SUBGRAPH_BLOCKS_BASE_URL || '',
    ethereum: process.env.SUBGRAPH_BLOCKS_ETHEREUM_URL || '',
    arbitrum: process.env.SUBGRAPH_BLOCKS_ARBITRUM_URL || '',
    optimism: process.env.SUBGRAPH_BLOCKS_OPTIMISM_URL || '',
  };

  return blockSubgraphUrls[chain] || this.subgraphUrls[chain];
}
```

### 5. Alternative Solutions

If suitable subgraphs don't exist on The Graph Network:

1. **Direct RPC Calls**: Query vault contracts directly using ethers.js
2. **Indexing Service**: Use alternatives like:
   - Alchemy Subgraphs
   - QuickNode Streams
   - Covalent API
   - Moralis Streams
3. **Self-hosted Graph Node**: Deploy your own subgraphs

### 6. Implementation Priority

Since the subgraph service is critical for vault data:

1. **Short term**: Implement fallback to RPC calls for essential data
2. **Medium term**: Find or deploy suitable subgraphs on The Graph Network
3. **Long term**: Consider building your own indexing solution

## Testing

After updating the URLs:

```bash
# Test the subgraph connectivity
curl -X POST YOUR_SUBGRAPH_URL \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _meta { block { number } } }"}'
```

## Resources

- [The Graph Migration Guide](https://thegraph.com/docs/en/sunset-of-hosted-service/)
- [The Graph Studio](https://thegraph.com/studio/)
- [Subgraph Development](https://thegraph.com/docs/en/developing/creating-a-subgraph/)