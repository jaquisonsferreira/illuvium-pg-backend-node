import { Injectable, Logger, Inject } from '@nestjs/common';
import { ITokenMetadataRepository } from '../../domain/repositories/token-metadata.repository.interface';
import { TokenMetadataEntity } from '../../domain/entities/token-metadata.entity';
import { BlockchainVerificationService } from '../../infrastructure/services/blockchain-verification.service';
import { ethers } from 'ethers';

interface SyncLpTokensDto {
  chain: string;
  dexName?: string;
  poolAddresses?: string[];
  limit?: number;
}

interface LpTokenInfo {
  poolAddress: string;
  lpTokenAddress: string;
  token0Address: string;
  token1Address: string;
  token0Symbol: string;
  token1Symbol: string;
  dexName: string;
}

interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  details: Array<{
    poolAddress: string;
    lpTokenAddress: string;
    status: 'synced' | 'updated' | 'error';
    error?: string;
  }>;
}

@Injectable()
export class SyncLpTokensUseCase {
  private readonly logger = new Logger(SyncLpTokensUseCase.name);
  private readonly providers: Map<string, ethers.Provider> = new Map();
  private readonly dexConfigs: Map<string, Map<string, any>> = new Map();

  constructor(
    @Inject('ITokenMetadataRepository')
    private readonly tokenMetadataRepository: ITokenMetadataRepository,
    private readonly blockchainVerificationService: BlockchainVerificationService,
  ) {
    this.initializeProviders();
    this.initializeDexConfigs();
  }

  private initializeProviders(): void {
    const chains = [
      { name: 'ethereum', rpcUrl: 'https://eth.llamarpc.com', chainId: 1 },
      { name: 'base', rpcUrl: 'https://mainnet.base.org', chainId: 8453 },
      {
        name: 'arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        chainId: 42161,
      },
      { name: 'optimism', rpcUrl: 'https://mainnet.optimism.io', chainId: 10 },
    ];

    for (const chain of chains) {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);
      this.providers.set(chain.name, provider);
    }
  }

  private initializeDexConfigs(): void {
    const uniswapV2Config = {
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      initCodeHash:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    };

    const sushiswapConfig = {
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      initCodeHash:
        '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
    };

    this.dexConfigs.set(
      'ethereum',
      new Map([
        ['uniswap-v2', uniswapV2Config],
        ['sushiswap', sushiswapConfig],
      ]),
    );

    this.dexConfigs.set(
      'base',
      new Map([
        [
          'uniswap-v2',
          {
            factoryAddress: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
            initCodeHash: uniswapV2Config.initCodeHash,
          },
        ],
      ]),
    );

    this.dexConfigs.set(
      'arbitrum',
      new Map([
        ['uniswap-v2', uniswapV2Config],
        ['sushiswap', sushiswapConfig],
      ]),
    );

    this.dexConfigs.set('optimism', new Map([['uniswap-v2', uniswapV2Config]]));
  }

  async execute(dto: SyncLpTokensDto): Promise<SyncResult> {
    const { chain, dexName, poolAddresses, limit = 100 } = dto;

    const result: SyncResult = {
      synced: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`No provider configured for chain: ${chain}`);
      }

      let lpTokensToSync: LpTokenInfo[] = [];

      if (poolAddresses && poolAddresses.length > 0) {
        lpTokensToSync = await this.fetchLpTokensFromPools(
          poolAddresses,
          chain,
          dexName,
        );
      } else {
        lpTokensToSync = await this.discoverLpTokens(chain, dexName, limit);
      }

      for (const lpToken of lpTokensToSync) {
        await this.syncLpToken(lpToken, chain, result);
      }

      this.logger.log(
        `LP token sync completed: ${result.synced} synced, ${result.updated} updated, ${result.errors} errors`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Error during LP token sync:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async fetchLpTokensFromPools(
    poolAddresses: string[],
    chain: string,
    dexName?: string,
  ): Promise<LpTokenInfo[]> {
    const lpTokens: LpTokenInfo[] = [];
    const provider = this.providers.get(chain);

    if (!provider) {
      return lpTokens;
    }

    for (const poolAddress of poolAddresses) {
      try {
        const lpTokenInfo = await this.fetchLpTokenInfo(
          poolAddress,
          chain,
          provider,
          dexName || 'unknown',
        );
        if (lpTokenInfo) {
          lpTokens.push(lpTokenInfo);
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch LP token info for pool ${poolAddress}:`,
          error,
        );
      }
    }

    return lpTokens;
  }

  private async fetchLpTokenInfo(
    poolAddress: string,
    chain: string,
    provider: ethers.Provider,
    dexName: string,
  ): Promise<LpTokenInfo | null> {
    try {
      const pairContract = new ethers.Contract(
        poolAddress,
        [
          'function token0() view returns (address)',
          'function token1() view returns (address)',
          'function name() view returns (string)',
          'function symbol() view returns (string)',
        ],
        provider,
      );

      const [token0Address, token1Address] = await Promise.all([
        pairContract.token0(),
        pairContract.token1(),
      ]);

      const [token0Metadata, token1Metadata] = await Promise.all([
        this.fetchTokenSymbol(token0Address, provider),
        this.fetchTokenSymbol(token1Address, provider),
      ]);

      return {
        poolAddress: poolAddress.toLowerCase(),
        lpTokenAddress: poolAddress.toLowerCase(),
        token0Address: token0Address.toLowerCase(),
        token1Address: token1Address.toLowerCase(),
        token0Symbol: token0Metadata || 'UNKNOWN',
        token1Symbol: token1Metadata || 'UNKNOWN',
        dexName,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch LP token info for ${poolAddress}:`,
        error,
      );
      return null;
    }
  }

  private async fetchTokenSymbol(
    tokenAddress: string,
    provider: ethers.Provider,
  ): Promise<string | null> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function symbol() view returns (string)'],
        provider,
      );
      return await tokenContract.symbol();
    } catch {
      return null;
    }
  }

  private async discoverLpTokens(
    chain: string,
    dexName?: string,
    limit: number = 100,
  ): Promise<LpTokenInfo[]> {
    const provider = this.providers.get(chain);
    if (!provider) {
      return [];
    }

    const chainDexConfigs = this.dexConfigs.get(chain);
    if (!chainDexConfigs) {
      return [];
    }

    const lpTokens: LpTokenInfo[] = [];
    const dexesToSync = dexName
      ? [[dexName, chainDexConfigs.get(dexName)]]
      : Array.from(chainDexConfigs.entries());

    for (const [dex, config] of dexesToSync) {
      if (!config) continue;

      try {
        const factoryContract = new ethers.Contract(
          config.factoryAddress,
          [
            'function allPairsLength() view returns (uint256)',
            'function allPairs(uint256) view returns (address)',
          ],
          provider,
        );

        const pairsLength = await factoryContract.allPairsLength();
        const startIndex = Math.max(0, Number(pairsLength) - limit);

        for (let i = startIndex; i < Number(pairsLength); i++) {
          try {
            const pairAddress = await factoryContract.allPairs(i);
            const lpTokenInfo = await this.fetchLpTokenInfo(
              pairAddress,
              chain,
              provider,
              dex,
            );

            if (lpTokenInfo) {
              lpTokens.push(lpTokenInfo);
              if (lpTokens.length >= limit) break;
            }
          } catch (error) {
            this.logger.warn(`Failed to fetch pair at index ${i}:`, error);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to discover LP tokens from ${dex}:`, error);
      }
    }

    return lpTokens;
  }

  private async syncLpToken(
    lpTokenInfo: LpTokenInfo,
    chain: string,
    result: SyncResult,
  ): Promise<void> {
    try {
      const existingToken = await this.tokenMetadataRepository.findByAddress(
        lpTokenInfo.lpTokenAddress,
        chain,
      );

      const lpSymbol = `${lpTokenInfo.token0Symbol}-${lpTokenInfo.token1Symbol}`;
      const lpName = `${lpTokenInfo.dexName} ${lpSymbol} LP`;

      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`No provider for chain ${chain}`);
      }

      const lpContract = new ethers.Contract(
        lpTokenInfo.lpTokenAddress,
        [
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)',
        ],
        provider,
      );

      const [decimals, totalSupply] = await Promise.all([
        lpContract.decimals(),
        lpContract.totalSupply(),
      ]);

      const isVerified =
        await this.blockchainVerificationService.checkContractVerification(
          lpTokenInfo.lpTokenAddress,
          chain,
        );

      if (existingToken) {
        const hasChanged =
          existingToken.totalSupply !== totalSupply.toString() ||
          existingToken.isVerified !== isVerified;

        if (hasChanged) {
          const updatedToken = existingToken.update({
            totalSupply: totalSupply.toString(),
            isVerified,
          });

          await this.tokenMetadataRepository.update(updatedToken);
          result.updated++;
          result.details.push({
            poolAddress: lpTokenInfo.poolAddress,
            lpTokenAddress: lpTokenInfo.lpTokenAddress,
            status: 'updated',
          });
        }
      } else {
        const newToken = TokenMetadataEntity.create({
          tokenAddress: lpTokenInfo.lpTokenAddress,
          chain,
          symbol: lpSymbol,
          name: lpName,
          decimals: Number(decimals),
          totalSupply: totalSupply.toString(),
          isLpToken: true,
          token0Address: lpTokenInfo.token0Address,
          token1Address: lpTokenInfo.token1Address,
          poolAddress: lpTokenInfo.poolAddress,
          dexName: lpTokenInfo.dexName,
          contractType: 'ERC20',
          isVerified,
        });

        await this.tokenMetadataRepository.create(newToken);
        result.synced++;
        result.details.push({
          poolAddress: lpTokenInfo.poolAddress,
          lpTokenAddress: lpTokenInfo.lpTokenAddress,
          status: 'synced',
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync LP token ${lpTokenInfo.lpTokenAddress}:`,
        error instanceof Error ? error.message : error,
      );
      result.errors++;
      result.details.push({
        poolAddress: lpTokenInfo.poolAddress,
        lpTokenAddress: lpTokenInfo.lpTokenAddress,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async syncLpTokensByDex(
    chain: string,
    dexName: string,
    limit: number = 50,
  ): Promise<SyncResult> {
    return this.execute({ chain, dexName, limit });
  }

  async syncLpTokensByPools(
    chain: string,
    poolAddresses: string[],
  ): Promise<SyncResult> {
    return this.execute({ chain, poolAddresses });
  }

  async refreshAllLpTokens(chain?: string): Promise<number> {
    const lpTokens = await this.tokenMetadataRepository.findLpTokens(chain);
    let refreshedCount = 0;

    for (const lpToken of lpTokens) {
      try {
        const result = await this.execute({
          chain: lpToken.chain,
          poolAddresses: [lpToken.poolAddress!],
        });

        if (result.updated > 0 || result.synced > 0) {
          refreshedCount++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to refresh LP token ${lpToken.tokenAddress}:`,
          error,
        );
      }
    }

    this.logger.log(`Refreshed ${refreshedCount} LP tokens`);
    return refreshedCount;
  }
}
