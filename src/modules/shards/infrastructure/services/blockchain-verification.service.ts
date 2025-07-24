import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

interface ContractDeploymentInfo {
  contractAddress: string;
  deployerAddress: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  verified: boolean;
}

interface BlockExplorerConfig {
  apiUrl: string;
  apiKey: string;
}

@Injectable()
export class BlockchainVerificationService {
  private readonly logger = new Logger(BlockchainVerificationService.name);
  private readonly providers: Map<string, ethers.Provider> = new Map();
  private readonly explorerConfigs: Map<string, BlockExplorerConfig> = new Map();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.initializeProviders();
    this.initializeExplorerConfigs();
  }

  private initializeProviders(): void {
    const chains = [
      { name: 'ethereum', rpcUrl: this.configService.get('ETHEREUM_RPC_URL') || 'https://eth.llamarpc.com', chainId: 1 },
      { name: 'base', rpcUrl: this.configService.get('BASE_RPC_URL') || 'https://mainnet.base.org', chainId: 8453 },
      { name: 'arbitrum', rpcUrl: this.configService.get('ARBITRUM_RPC_URL') || 'https://arb1.arbitrum.io/rpc', chainId: 42161 },
      { name: 'optimism', rpcUrl: this.configService.get('OPTIMISM_RPC_URL') || 'https://mainnet.optimism.io', chainId: 10 },
    ];

    for (const chain of chains) {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);
      this.providers.set(chain.name, provider);
    }
  }

  private initializeExplorerConfigs(): void {
    this.explorerConfigs.set('ethereum', {
      apiUrl: 'https://api.etherscan.io/api',
      apiKey: this.configService.get('ETHERSCAN_API_KEY') || '',
    });

    this.explorerConfigs.set('base', {
      apiUrl: 'https://api.basescan.org/api',
      apiKey: this.configService.get('BASESCAN_API_KEY') || '',
    });

    this.explorerConfigs.set('arbitrum', {
      apiUrl: 'https://api.arbiscan.io/api',
      apiKey: this.configService.get('ARBISCAN_API_KEY') || '',
    });

    this.explorerConfigs.set('optimism', {
      apiUrl: 'https://api-optimistic.etherscan.io/api',
      apiKey: this.configService.get('OPTIMISM_ETHERSCAN_API_KEY') || '',
    });
  }

  async verifyContractDeployment(
    contractAddress: string,
    deployerAddress: string,
    transactionHash: string,
    chainName: string,
  ): Promise<ContractDeploymentInfo | null> {
    try {
      const provider = this.providers.get(chainName);
      if (!provider) {
        this.logger.error(`No provider configured for chain: ${chainName}`);
        return null;
      }

      const tx = await provider.getTransaction(transactionHash);
      if (!tx) {
        this.logger.warn(`Transaction ${transactionHash} not found`);
        return null;
      }

      const receipt = await provider.getTransactionReceipt(transactionHash);
      if (!receipt) {
        this.logger.warn(`Transaction receipt ${transactionHash} not found`);
        return null;
      }

      if (receipt.from.toLowerCase() !== deployerAddress.toLowerCase()) {
        this.logger.warn(`Deployer mismatch: expected ${deployerAddress}, got ${receipt.from}`);
        return null;
      }

      if (receipt.contractAddress?.toLowerCase() !== contractAddress.toLowerCase()) {
        this.logger.warn(`Contract address mismatch: expected ${contractAddress}, got ${receipt.contractAddress}`);
        return null;
      }

      const code = await provider.getCode(contractAddress);
      if (code === '0x' || code === '0x0') {
        this.logger.warn(`No code found at contract address ${contractAddress}`);
        return null;
      }

      const block = await provider.getBlock(receipt.blockNumber);
      if (!block) {
        this.logger.warn(`Block ${receipt.blockNumber} not found`);
        return null;
      }

      const isVerified = await this.checkContractVerification(contractAddress, chainName);

      return {
        contractAddress: receipt.contractAddress!,
        deployerAddress: receipt.from,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        timestamp: block.timestamp,
        verified: isVerified,
      };
    } catch (error) {
      this.logger.error(`Error verifying contract deployment:`, error);
      return null;
    }
  }

  async checkContractVerification(
    contractAddress: string,
    chainName: string,
  ): Promise<boolean> {
    try {
      const explorerConfig = this.explorerConfigs.get(chainName);
      if (!explorerConfig || !explorerConfig.apiKey) {
        this.logger.warn(`No explorer API key configured for chain: ${chainName}`);
        return false;
      }

      const url = `${explorerConfig.apiUrl}?module=contract&action=getabi&address=${contractAddress}&apikey=${explorerConfig.apiKey}`;
      
      const response = await firstValueFrom(
        this.httpService.get<{ status: string; result: string }>(url)
      );

      if (response.data.status === '1' && response.data.result !== 'Contract source code not verified') {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking contract verification:`, error);
      return false;
    }
  }

  async getContractCreationInfo(
    contractAddress: string,
    chainName: string,
  ): Promise<{
    creatorAddress: string;
    transactionHash: string;
    blockNumber: number;
  } | null> {
    try {
      const explorerConfig = this.explorerConfigs.get(chainName);
      if (!explorerConfig || !explorerConfig.apiKey) {
        this.logger.warn(`No explorer API key configured for chain: ${chainName}`);
        return null;
      }

      const url = `${explorerConfig.apiUrl}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${explorerConfig.apiKey}`;
      
      const response = await firstValueFrom(
        this.httpService.get<{
          status: string;
          result: Array<{
            contractCreator: string;
            txHash: string;
            blockNumber: string;
          }>;
        }>(url)
      );

      if (response.data.status === '1' && response.data.result?.length > 0) {
        const creation = response.data.result[0];
        return {
          creatorAddress: creation.contractCreator,
          transactionHash: creation.txHash,
          blockNumber: parseInt(creation.blockNumber),
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting contract creation info:`, error);
      return null;
    }
  }
}