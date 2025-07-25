import { Injectable, Logger, Inject } from '@nestjs/common';
import { ITokenMetadataRepository } from '../../domain/repositories/token-metadata.repository.interface';
import { TokenMetadataEntity } from '../../domain/entities/token-metadata.entity';
import { BlockchainVerificationService } from '../../infrastructure/services/blockchain-verification.service';
import { ethers } from 'ethers';

interface CacheTokenMetadataDto {
  tokenAddress: string;
  chain: string;
  forceRefresh?: boolean;
}

interface CacheResult {
  success: boolean;
  tokenMetadata?: TokenMetadataEntity;
  cached: boolean;
  error?: string;
}

@Injectable()
export class CacheTokenMetadataUseCase {
  private readonly logger = new Logger(CacheTokenMetadataUseCase.name);
  private readonly providers: Map<string, ethers.Provider> = new Map();

  constructor(
    @Inject('ITokenMetadataRepository')
    private readonly tokenMetadataRepository: ITokenMetadataRepository,
    private readonly blockchainVerificationService: BlockchainVerificationService,
  ) {
    this.initializeProviders();
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

  async execute(dto: CacheTokenMetadataDto): Promise<CacheResult> {
    const { tokenAddress, chain, forceRefresh = false } = dto;

    try {
      const normalizedAddress = tokenAddress.toLowerCase();

      const existingMetadata = await this.tokenMetadataRepository.findByAddress(
        normalizedAddress,
        chain,
      );

      if (existingMetadata && !forceRefresh && !existingMetadata.isStale(7)) {
        this.logger.log(
          `Token metadata found in cache: ${existingMetadata.symbol} on ${chain}`,
        );
        return {
          success: true,
          tokenMetadata: existingMetadata,
          cached: true,
        };
      }

      const tokenMetadata = await this.fetchTokenMetadata(
        normalizedAddress,
        chain,
      );

      if (!tokenMetadata) {
        return {
          success: false,
          cached: false,
          error: 'Failed to fetch token metadata from blockchain',
        };
      }

      const savedMetadata = existingMetadata
        ? await this.tokenMetadataRepository.update(
            existingMetadata.update({
              totalSupply: tokenMetadata.totalSupply || undefined,
              logoUrl: tokenMetadata.logoUrl || undefined,
              isVerified: tokenMetadata.isVerified,
            }),
          )
        : await this.tokenMetadataRepository.create(tokenMetadata);

      this.logger.log(
        `Token metadata cached: ${savedMetadata.symbol} on ${chain}`,
      );

      return {
        success: true,
        tokenMetadata: savedMetadata,
        cached: false,
      };
    } catch (error) {
      this.logger.error(
        `Error caching token metadata for ${tokenAddress} on ${chain}:`,
        error instanceof Error ? error.stack : error,
      );
      return {
        success: false,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchTokenMetadata(
    tokenAddress: string,
    chain: string,
  ): Promise<TokenMetadataEntity | null> {
    const provider = this.providers.get(chain);
    if (!provider) {
      this.logger.error(`No provider configured for chain: ${chain}`);
      return null;
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)',
        ],
        provider,
      );

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
      ]);

      const code = await provider.getCode(tokenAddress);
      const contractType = this.detectContractType(code);

      const isVerified =
        await this.blockchainVerificationService.checkContractVerification(
          tokenAddress,
          chain,
        );

      return TokenMetadataEntity.create({
        tokenAddress,
        chain,
        symbol,
        name,
        decimals,
        totalSupply: totalSupply.toString(),
        contractType,
        isVerified,
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch token metadata for ${tokenAddress} on ${chain}:`,
        error,
      );
      return null;
    }
  }

  private detectContractType(bytecode: string): string {
    const signatures = {
      ERC20: '0xa9059cbb', // transfer(address,uint256)
      ERC721: '0x23b872dd', // transferFrom(address,address,uint256)
      ERC1155: '0xf242432a', // safeTransferFrom(address,address,uint256,uint256,bytes)
    };

    for (const [type, signature] of Object.entries(signatures)) {
      if (bytecode.includes(signature.slice(2))) {
        return type;
      }
    }

    return 'ERC20';
  }

  async cacheMultipleTokens(
    tokens: Array<{ tokenAddress: string; chain: string }>,
  ): Promise<Array<CacheResult>> {
    const results: Array<CacheResult> = [];

    for (const token of tokens) {
      const result = await this.execute({
        tokenAddress: token.tokenAddress,
        chain: token.chain,
      });
      results.push(result);
    }

    return results;
  }

  async refreshStaleTokens(maxAgeDays: number = 7): Promise<number> {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - maxAgeDays);

    const staleTokens = await this.tokenMetadataRepository.findStaleTokens(
      staleDate,
      100,
    );

    let refreshedCount = 0;

    for (const token of staleTokens) {
      const result = await this.execute({
        tokenAddress: token.tokenAddress,
        chain: token.chain,
        forceRefresh: true,
      });

      if (result.success) {
        refreshedCount++;
      }
    }

    this.logger.log(`Refreshed ${refreshedCount} stale token metadata entries`);
    return refreshedCount;
  }
}
