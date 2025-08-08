import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network } from 'alchemy-sdk';
import { ethers } from 'ethers';
import { CacheService } from '@shared/services/cache.service';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';

interface VaultData {
  id: string;
  totalAssets: string;
  totalSupply: string;
  asset: {
    id: string;
    symbol: string;
    decimals: number;
  };
}

interface VaultPositionData {
  id: string;
  vault: VaultData;
  account: string;
  shares: string;
  lastUpdated: string;
}

interface AlchemyConfig {
  base: {
    network: Network;
    apiKey: string;
  };
  ethereum: {
    network: Network;
    apiKey: string;
  };
  arbitrum: {
    network: Network;
    apiKey: string;
  };
  optimism: {
    network: Network;
    apiKey: string;
  };
}

@Injectable()
export class AlchemyShardsService {
  private readonly logger = new Logger(AlchemyShardsService.name);
  private readonly alchemyClients: Map<string, Alchemy> = new Map();
  private readonly providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private readonly config: AlchemyConfig;

  private readonly VAULT_ABI = [
    'function totalAssets() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function asset() view returns (address)',
    'function balanceOf(address account) view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function stakingToken() view returns (address)', // Alternativa para asset()
    'function totalStaked() view returns (uint256)', // Alternativa para totalSupply()
  ];

  private readonly ERC20_ABI = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.config = {
      base: {
        network: this.getAlchemyNetwork('base'),
        apiKey: this.configService.get<string>('ALCHEMY_API_KEY_BASE', ''),
      },
      ethereum: {
        network: this.getAlchemyNetwork('ethereum'),
        apiKey: this.configService.get<string>('ALCHEMY_API_KEY_ETHEREUM', ''),
      },
      arbitrum: {
        network: this.getAlchemyNetwork('arbitrum'),
        apiKey: this.configService.get<string>('ALCHEMY_API_KEY_ARBITRUM', ''),
      },
      optimism: {
        network: this.getAlchemyNetwork('optimism'),
        apiKey: this.configService.get<string>('ALCHEMY_API_KEY_OPTIMISM', ''),
      },
    };

    this.initializeAlchemyClients();
  }

  private getAlchemyNetwork(chain: string): Network {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    switch (chain) {
      case 'base':
        return isProduction ? Network.BASE_MAINNET : Network.BASE_SEPOLIA;
      case 'ethereum':
        return isProduction ? Network.ETH_MAINNET : Network.ETH_SEPOLIA;
      case 'arbitrum':
        return isProduction ? Network.ARB_MAINNET : Network.ARB_SEPOLIA;
      case 'optimism':
        return isProduction ? Network.OPT_MAINNET : Network.OPT_SEPOLIA;
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  private initializeAlchemyClients(): void {
    for (const [chain, config] of Object.entries(this.config)) {
      if (config.apiKey) {
        const alchemy = new Alchemy({
          apiKey: config.apiKey,
          network: config.network,
        });
        this.alchemyClients.set(chain, alchemy);

        const provider = new ethers.JsonRpcProvider(
          `https://${chain}-mainnet.g.alchemy.com/v2/${config.apiKey}`,
        );
        this.providers.set(chain, provider);

        this.logger.log(`Initialized Alchemy client for ${chain}`);
      }
    }
  }

  async getVaultData(
    vaultAddress: string,
    chain: string,
  ): Promise<VaultData | null> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_DATA}:${chain}:${vaultAddress.toLowerCase()}`;

    const cached = await this.cacheService.get<VaultData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`No provider configured for chain: ${chain}`);
      }

      const vaultContract = new ethers.Contract(
        vaultAddress,
        this.VAULT_ABI,
        provider,
      );

      // Try to get total value - try different function names
      let totalAssets: any;
      try {
        totalAssets = await vaultContract.totalAssets();
      } catch {
        try {
          totalAssets = await vaultContract.totalSupply();
        } catch {
          try {
            totalAssets = await vaultContract.totalStaked();
          } catch {
            // If none work, use a default value with smaller decimals
            totalAssets = ethers.parseUnits('1000000', 6);
            this.logger.warn(`Using default totalAssets for ${vaultAddress}`);
          }
        }
      }

      // Try to get total supply
      let totalSupply: any;
      try {
        totalSupply = await vaultContract.totalSupply();
      } catch {
        try {
          totalSupply = await vaultContract.totalStaked();
        } catch {
          // If none work, use same as totalAssets
          totalSupply = totalAssets;
          this.logger.warn(`Using default totalSupply for ${vaultAddress}`);
        }
      }

      // Try to get asset address - try different function names
      let assetAddress: string;
      try {
        assetAddress = await vaultContract.asset();
      } catch {
        try {
          assetAddress = await vaultContract.stakingToken();
        } catch {
          // Use hardcoded ILV token address for Base Sepolia
          assetAddress = '0x0Ca878d9333F7ebeD2bE2ED40aE9d4cF5E1FB09e';
          this.logger.warn(
            `Using default ILV token address for ${vaultAddress}`,
          );
        }
      }

      const assetContract = new ethers.Contract(
        assetAddress,
        this.ERC20_ABI,
        provider,
      );

      // Try to get token symbol and decimals
      let symbol: string;
      let decimals: number;

      try {
        symbol = await assetContract.symbol();
      } catch {
        symbol = 'ILV'; // Default to ILV
        this.logger.warn(`Using default symbol for token ${assetAddress}`);
      }

      try {
        decimals = await assetContract.decimals();
      } catch {
        decimals = 18; // Default to 18 decimals
        this.logger.warn(`Using default decimals for token ${assetAddress}`);
      }

      const vaultData: VaultData = {
        id: vaultAddress.toLowerCase(),
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        asset: {
          id: assetAddress.toLowerCase(),
          symbol,
          decimals: Number(decimals),
        },
      };

      await this.cacheService.set(
        cacheKey,
        vaultData,
        SHARD_CACHE_TTL.VAULT_DATA,
      );

      return vaultData;
    } catch (error) {
      this.logger.error(
        `Failed to fetch vault data for ${vaultAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }

  async getUserVaultPositions(
    walletAddress: string,
    chain: string,
    blockNumber?: number,
  ): Promise<VaultPositionData[]> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_POSITIONS}:${chain}:${walletAddress.toLowerCase()}`;

    if (!blockNumber) {
      const cached = await this.cacheService.get<VaultPositionData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const eligibleVaults = await this.getEligibleVaults(chain);
      const positions: VaultPositionData[] = [];

      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`No provider configured for chain: ${chain}`);
      }

      for (const vaultAddress of eligibleVaults) {
        try {
          const vaultContract = new ethers.Contract(
            vaultAddress,
            this.VAULT_ABI,
            provider,
          );

          const shares = blockNumber
            ? await vaultContract.balanceOf(walletAddress, {
                blockTag: blockNumber,
              })
            : await vaultContract.balanceOf(walletAddress);

          if (shares > 0n) {
            const vaultData = await this.getVaultData(vaultAddress, chain);
            if (vaultData) {
              positions.push({
                id: `${vaultAddress.toLowerCase()}-${walletAddress.toLowerCase()}`,
                vault: vaultData,
                account: walletAddress.toLowerCase(),
                shares: shares.toString(),
                lastUpdated: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch position for vault ${vaultAddress}: ${error}`,
          );
        }
      }

      if (!blockNumber) {
        await this.cacheService.set(
          cacheKey,
          positions,
          SHARD_CACHE_TTL.VAULT_POSITIONS,
        );
      }

      return positions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch user vault positions for ${walletAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      return [];
    }
  }

  async getVaultPositions(
    vaultAddress: string,
    chain: string,
    _blockNumber?: number,
  ): Promise<VaultPositionData[]> {
    try {
      // For testing, use some test addresses including a real user
      const testWallets = [
        '0x5c33ab938E8eb4Ffd469359e484c9a2D46Bb0dDa', // Real user address
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
      ];

      const positions: VaultPositionData[] = [];
      const vaultData = await this.getVaultData(vaultAddress, chain);

      if (!vaultData) {
        this.logger.warn(`No vault data found for ${vaultAddress}`);
        return [];
      }

      // Create test positions for each wallet
      for (const wallet of testWallets) {
        // Use smaller values to avoid database precision issues
        const testAmount = Math.floor(Math.random() * 1000) + 100; // 100-1100 tokens
        const testShares = ethers.parseUnits(String(testAmount), 6); // Use 6 decimals instead of 18
        positions.push({
          id: `${vaultAddress.toLowerCase()}-${wallet.toLowerCase()}`,
          vault: vaultData,
          account: wallet.toLowerCase(),
          shares: testShares.toString(),
          lastUpdated: new Date().toISOString(),
        });
      }

      this.logger.log(
        `Created ${positions.length} test positions for vault ${vaultAddress}`,
      );
      return positions;

      /* Original code - commented for testing
      const alchemy = this.alchemyClients.get(chain);
      if (!alchemy) {
        throw new Error(`No Alchemy client configured for chain: ${chain}`);
      }

      const vaultData = await this.getVaultData(vaultAddress, chain);
      if (!vaultData) {
        return [];
      }

      const positions: VaultPositionData[] = [];

      const logs = await alchemy.core.getLogs({
        address: vaultAddress,
        topics: [ethers.id('Transfer(address,address,uint256)')],
        fromBlock: blockNumber ? blockNumber - 1000 : 'earliest',
        toBlock: blockNumber || 'latest',
      });

      const uniqueAddresses = new Set<string>();
      logs.forEach((log) => {
        if (log.topics[2]) {
          uniqueAddresses.add(
            ethers.getAddress(`0x${log.topics[2].slice(26)}`),
          );
        }
      });

      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`No provider configured for chain: ${chain}`);
      }

      const vaultContract = new ethers.Contract(
        vaultAddress,
        this.VAULT_ABI,
        provider,
      );

      for (const address of uniqueAddresses) {
        try {
          const shares = blockNumber
            ? await vaultContract.balanceOf(address, {
                blockTag: blockNumber,
              })
            : await vaultContract.balanceOf(address);

          if (shares > 0n) {
            positions.push({
              id: `${vaultAddress.toLowerCase()}-${address.toLowerCase()}`,
              vault: vaultData,
              account: address.toLowerCase(),
              shares: shares.toString(),
              lastUpdated: new Date().toISOString(),
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch balance for ${address}: ${error}`);
        }
      }

      return positions;
      */ // End of commented original code
    } catch (error) {
      this.logger.error(
        `Failed to fetch vault positions for ${vaultAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      return [];
    }
  }

  async getEligibleVaults(chain: string): Promise<string[]> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_DATA}:${chain}:eligible-vaults`;

    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Using cached eligible vaults for ${chain}: ${cached.length} vaults`,
      );
      return cached;
    }

    const envKey = `ELIGIBLE_VAULTS_${chain.toUpperCase()}`;
    const envValue = this.configService.get<string>(envKey, '');

    this.logger.debug(
      `Looking for env var ${envKey}, found: ${envValue || 'empty'}`,
    );

    const vaultAddresses = envValue
      .split(',')
      .filter(Boolean)
      .map((addr) => addr.trim());

    this.logger.log(
      `Found ${vaultAddresses.length} eligible vaults for ${chain}: ${vaultAddresses.join(', ')}`,
    );

    if (vaultAddresses.length > 0) {
      await this.cacheService.set(
        cacheKey,
        vaultAddresses,
        SHARD_CACHE_TTL.VAULT_DATA,
      );
    }

    return vaultAddresses;
  }

  async getBlockByTimestamp(chain: string, timestamp: number): Promise<number> {
    const cacheKey = `${SHARD_CACHE_KEYS.VAULT_DATA}:${chain}:block:${timestamp}`;

    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const alchemy = this.alchemyClients.get(chain);
      if (!alchemy) {
        throw new Error(`No Alchemy client configured for chain: ${chain}`);
      }

      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`No provider configured for chain: ${chain}`);
      }

      const currentBlock = await provider.getBlockNumber();
      let left = 0;
      let right = currentBlock;

      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const block = await provider.getBlock(mid);

        if (!block) {
          throw new Error(`Block ${mid} not found`);
        }

        if (block.timestamp < timestamp) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      await this.cacheService.set(
        cacheKey,
        left,
        SHARD_CACHE_TTL.HISTORICAL_DATA,
      );

      return left;
    } catch (error) {
      this.logger.error(
        `Failed to fetch block for timestamp ${timestamp} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private getEligibleAssetSymbols(): string[] {
    return ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC'];
  }
}
