import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, Contract, Provider, JsonRpcProvider } from 'ethers';
import {
  IStakingBlockchainRepository,
  VaultPosition,
  LPTokenData,
  TokenMetadata,
  ChainType,
  BlockchainEvent,
  SeasonStatus,
  VaultType,
} from '../../domain/types/staking-types';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { LPToken } from '../../domain/entities/lp-token.entity';
import {
  OBELISK_SEASONAL_VAULT_ABI,
  ERC20_ABI,
  LP_TOKEN_ABI,
} from '../../domain/contracts/obelisk-seasonal-vault.abi';

interface ChainConfig {
  [ChainType.BASE]: {
    rpcUrl: string;
    chainId: number;
  };
  [ChainType.OBELISK]: {
    rpcUrl: string;
    chainId: number;
  };
}

@Injectable()
export class StakingBlockchainService implements IStakingBlockchainRepository {
  private readonly logger = new Logger(StakingBlockchainService.name);
  private readonly providers: Map<ChainType, JsonRpcProvider> = new Map();
  private readonly config: ChainConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      [ChainType.BASE]: {
        rpcUrl: this.configService.get<string>(
          'BASE_RPC_URL',
          'https://mainnet.base.org',
        ),
        chainId: 8453,
      },
      [ChainType.OBELISK]: {
        rpcUrl: this.configService.get<string>(
          'OBELISK_RPC_URL',
          'https://rpc.obelisk.gg',
        ),
        chainId: 1001, // Placeholder for Obelisk chain ID
      },
    };

    this.initializeProviders();
  }

  private initializeProviders(): void {
    Object.entries(this.config).forEach(([chain, config]) => {
      const provider = new JsonRpcProvider(config.rpcUrl, {
        chainId: config.chainId,
        name: chain,
      });

      this.providers.set(chain as ChainType, provider);
    });
  }

  private getProvider(chain: ChainType): JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`No provider configured for chain: ${chain}`);
    }
    return provider;
  }

  private getVaultContract(vaultAddress: string, chain: ChainType): Contract {
    const provider = this.getProvider(chain);
    return new Contract(vaultAddress, OBELISK_SEASONAL_VAULT_ABI.abi, provider);
  }

  private getERC20Contract(tokenAddress: string, chain: ChainType): Contract {
    const provider = this.getProvider(chain);
    return new Contract(tokenAddress, ERC20_ABI, provider);
  }

  private getLPTokenContract(tokenAddress: string, chain: ChainType): Contract {
    const provider = this.getProvider(chain);
    return new Contract(tokenAddress, LP_TOKEN_ABI, provider);
  }

  async getCurrentBlock(chain: ChainType): Promise<number> {
    try {
      const provider = this.getProvider(chain);
      return await provider.getBlockNumber();
    } catch (error) {
      this.logger.error(`Failed to get current block for ${chain}:`, error);
      throw new Error(`Failed to get current block for ${chain}`);
    }
  }

  async getBlockTimestamp(
    blockNumber: number,
    chain: ChainType,
  ): Promise<number> {
    try {
      const provider = this.getProvider(chain);
      const block = await provider.getBlock(blockNumber);
      if (!block) {
        throw new Error(`Block ${blockNumber} not found`);
      }
      return block.timestamp;
    } catch (error) {
      this.logger.error(
        `Failed to get block timestamp for block ${blockNumber} on ${chain}:`,
        error,
      );
      throw new Error(`Failed to get block timestamp`);
    }
  }

  async getVaultPosition(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<VaultPosition | null> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const blockTag = blockNumber || 'latest';

      const [shareBalance, totalShares, totalAssets] = await Promise.all([
        vaultContract.balanceOf(userAddress, { blockTag }),
        vaultContract.totalSupply({ blockTag }),
        vaultContract.totalAssets({ blockTag }),
      ]);

      // Calculate asset balance: (shareBalance * totalAssets) / totalShares
      let assetBalance = '0';
      if (totalShares > 0n) {
        assetBalance = ((shareBalance * totalAssets) / totalShares).toString();
      }

      if (shareBalance === 0n && assetBalance === '0') {
        return null;
      }

      const currentBlock = blockNumber || (await this.getCurrentBlock(chain));
      const timestamp = await this.getBlockTimestamp(currentBlock, chain);

      return new VaultPositionEntity(
        vaultAddress.toLowerCase(),
        userAddress.toLowerCase(),
        shareBalance.toString(),
        assetBalance,
        currentBlock,
        timestamp,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get vault position for ${userAddress} in ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to get vault position from blockchain`);
    }
  }

  async getUserVaultPositions(
    userAddress: string,
    vaultAddresses: string[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<VaultPosition[]> {
    try {
      const positionPromises = vaultAddresses.map((vaultAddress) =>
        this.getVaultPosition(userAddress, vaultAddress, chain, blockNumber),
      );

      const positions = await Promise.all(positionPromises);
      return positions.filter(
        (position): position is VaultPosition => position !== null,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get user vault positions for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to get user vault positions from blockchain`);
    }
  }

  async getVaultTotals(
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<{
    totalAssets: string;
    totalSupply: string;
    sharePrice: string;
  }> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const blockTag = blockNumber || 'latest';

      const [totalAssets, totalSupply] = await Promise.all([
        vaultContract.totalAssets({ blockTag }),
        vaultContract.totalSupply({ blockTag }),
      ]);

      // Calculate share price: totalAssets / totalSupply (in wei)
      let sharePrice = '0';
      if (totalSupply > 0n) {
        sharePrice = (
          (totalAssets * ethers.parseEther('1')) /
          totalSupply
        ).toString();
      }

      return {
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        sharePrice,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vault totals for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to get vault totals from blockchain`);
    }
  }

  async getTokenMetadata(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<TokenMetadata> {
    try {
      const tokenContract = this.getERC20Contract(tokenAddress, chain);

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);

      // Check if it's an LP token by trying to call LP-specific functions
      let isLP = false;
      let token0: string | undefined;
      let token1: string | undefined;

      try {
        const lpContract = this.getLPTokenContract(tokenAddress, chain);
        [token0, token1] = await Promise.all([
          lpContract.token0(),
          lpContract.token1(),
        ]);
        isLP = true;
      } catch {
        // Not an LP token, which is fine
      }

      return {
        address: tokenAddress.toLowerCase(),
        symbol,
        name,
        decimals,
        isLP,
        token0: token0?.toLowerCase(),
        token1: token1?.toLowerCase(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get token metadata for ${tokenAddress}:`,
        error,
      );
      throw new Error(`Failed to get token metadata from blockchain`);
    }
  }

  async getMultipleTokensMetadata(
    tokenAddresses: string[],
    chain: ChainType,
  ): Promise<TokenMetadata[]> {
    try {
      const metadataPromises = tokenAddresses.map((address) =>
        this.getTokenMetadata(address, chain),
      );

      return await Promise.all(metadataPromises);
    } catch (error) {
      this.logger.error(`Failed to get multiple tokens metadata:`, error);
      throw new Error(`Failed to get multiple tokens metadata from blockchain`);
    }
  }

  async getLPTokenData(
    tokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<LPTokenData> {
    try {
      const lpContract = this.getLPTokenContract(tokenAddress, chain);
      const blockTag = blockNumber || 'latest';

      const [token0, token1, reserves, totalSupply] = await Promise.all([
        lpContract.token0(),
        lpContract.token1(),
        lpContract.getReserves({ blockTag }),
        lpContract.totalSupply({ blockTag }),
      ]);

      const currentBlock = blockNumber || (await this.getCurrentBlock(chain));
      const timestamp = await this.getBlockTimestamp(currentBlock, chain);

      return new LPToken(
        tokenAddress.toLowerCase(),
        token0.toLowerCase(),
        token1.toLowerCase(),
        reserves[0].toString(), // reserve0
        reserves[1].toString(), // reserve1
        totalSupply.toString(),
        currentBlock,
        timestamp,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get LP token data for ${tokenAddress}:`,
        error,
      );
      throw new Error(`Failed to get LP token data from blockchain`);
    }
  }

  async getMultipleLPTokensData(
    tokenAddresses: string[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<LPTokenData[]> {
    try {
      const lpDataPromises = tokenAddresses.map((address) =>
        this.getLPTokenData(address, chain, blockNumber),
      );

      return await Promise.all(lpDataPromises);
    } catch (error) {
      this.logger.error(`Failed to get multiple LP tokens data:`, error);
      throw new Error(`Failed to get multiple LP tokens data from blockchain`);
    }
  }

  async getVaultSeasonStatus(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<SeasonStatus> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const status = await vaultContract.getSeasonStatus();
      return status as SeasonStatus;
    } catch (error) {
      this.logger.error(
        `Failed to get vault season status for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to get vault season status from blockchain`);
    }
  }

  async isMainnetLaunched(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<boolean> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      return await vaultContract.mainnetLaunched();
    } catch (error) {
      this.logger.error(
        `Failed to check mainnet launch status for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to check mainnet launch status from blockchain`);
    }
  }

  async getVaultConfig(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<{
    asset: string;
    name: string;
    symbol: string;
    decimals: number;
    minDepositAmount: string;
    minShareAmount: string;
  }> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);

      const [vaultInfo, minimumAmounts] = await Promise.all([
        vaultContract.getVaultInfo(),
        vaultContract.getMinimumAmounts(),
      ]);

      return {
        asset: vaultInfo.asset_.toLowerCase(),
        name: vaultInfo.name_,
        symbol: vaultInfo.symbol_,
        decimals: vaultInfo.decimals_,
        minDepositAmount: minimumAmounts.minDepositAmount_.toString(),
        minShareAmount: minimumAmounts.minShareAmount_.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vault config for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to get vault config from blockchain`);
    }
  }

  async getUserPendingWithdrawals(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<
    {
      withdrawalId: number;
      shares: string;
      assets: string;
      requestTime: number;
      unlockTime: number;
      finalized: boolean;
    }[]
  > {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const withdrawalIds =
        await vaultContract.getPendingWithdrawalIds(userAddress);

      const withdrawalPromises = withdrawalIds.map(async (id: bigint) => {
        const withdrawal = await vaultContract.getPendingWithdrawal(
          userAddress,
          id,
        );
        return {
          withdrawalId: Number(id),
          shares: withdrawal.shares.toString(),
          assets: withdrawal.assets.toString(),
          requestTime: Number(withdrawal.requestTime),
          unlockTime: Number(withdrawal.unlockTime),
          finalized: withdrawal.finalized,
        };
      });

      return await Promise.all(withdrawalPromises);
    } catch (error) {
      this.logger.error(
        `Failed to get pending withdrawals for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to get pending withdrawals from blockchain`);
    }
  }

  // Additional method implementations would go here...
  // For brevity, implementing placeholder methods for the remaining interface methods

  async getVaultEvents(
    vaultAddress: string,
    fromBlock: number,
    toBlock: number,
    chain: ChainType,
    eventNames?: string[],
  ): Promise<BlockchainEvent[]> {
    // Implementation would fetch and parse vault events from the blockchain
    throw new Error('Method not implemented yet');
  }

  async getTransactionVaultEvents(
    transactionHash: string,
    chain: ChainType,
  ): Promise<BlockchainEvent[]> {
    throw new Error('Method not implemented yet');
  }

  async convertSharesToAssets(
    shares: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<string> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const blockTag = blockNumber || 'latest';
      const assets = await vaultContract.convertToAssets(shares, { blockTag });
      return assets.toString();
    } catch (error) {
      this.logger.error(`Failed to convert shares to assets:`, error);
      throw new Error(`Failed to convert shares to assets`);
    }
  }

  async convertAssetsToShares(
    assets: string,
    vaultAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<string> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const blockTag = blockNumber || 'latest';
      const shares = await vaultContract.convertToShares(assets, { blockTag });
      return shares.toString();
    } catch (error) {
      this.logger.error(`Failed to convert assets to shares:`, error);
      throw new Error(`Failed to convert assets to shares`);
    }
  }

  async getMaxRedeem(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<string> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const maxShares = await vaultContract.maxRedeem(userAddress);
      return maxShares.toString();
    } catch (error) {
      this.logger.error(`Failed to get max redeem for ${userAddress}:`, error);
      throw new Error(`Failed to get max redeem from blockchain`);
    }
  }

  async getMaxWithdraw(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<string> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const maxAssets = await vaultContract.maxWithdraw(userAddress);
      return maxAssets.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get max withdraw for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to get max withdraw from blockchain`);
    }
  }

  async getUserTokenBalance(
    userAddress: string,
    tokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<string> {
    try {
      const tokenContract = this.getERC20Contract(tokenAddress, chain);
      const blockTag = blockNumber || 'latest';
      const balance = await tokenContract.balanceOf(userAddress, { blockTag });
      return balance.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get token balance for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to get token balance from blockchain`);
    }
  }

  async getMultipleUsersTokenBalances(
    userAddresses: string[],
    tokenAddress: string,
    chain: ChainType,
    blockNumber?: number,
  ): Promise<Map<string, string>> {
    try {
      const balancePromises = userAddresses.map(async (userAddress) => {
        const balance = await this.getUserTokenBalance(
          userAddress,
          tokenAddress,
          chain,
          blockNumber,
        );
        return [userAddress.toLowerCase(), balance] as const;
      });

      const balances = await Promise.all(balancePromises);
      return new Map(balances);
    } catch (error) {
      this.logger.error(`Failed to get multiple users token balances:`, error);
      throw new Error(
        `Failed to get multiple users token balances from blockchain`,
      );
    }
  }

  async isValidVault(vaultAddress: string, chain: ChainType): Promise<boolean> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      await vaultContract.asset(); // Try to call a basic vault function
      return true;
    } catch {
      return false;
    }
  }

  async isValidLPToken(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<boolean> {
    try {
      const lpContract = this.getLPTokenContract(tokenAddress, chain);
      await Promise.all([lpContract.token0(), lpContract.token1()]);
      return true;
    } catch {
      return false;
    }
  }

  async getVaultAsset(vaultAddress: string, chain: ChainType): Promise<string> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const asset = await vaultContract.asset();
      return asset.toLowerCase();
    } catch (error) {
      this.logger.error(
        `Failed to get vault asset for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to get vault asset from blockchain`);
    }
  }

  async getLPTokenComponents(
    tokenAddress: string,
    chain: ChainType,
  ): Promise<{
    token0: string;
    token1: string;
  }> {
    try {
      const lpContract = this.getLPTokenContract(tokenAddress, chain);
      const [token0, token1] = await Promise.all([
        lpContract.token0(),
        lpContract.token1(),
      ]);

      return {
        token0: token0.toLowerCase(),
        token1: token1.toLowerCase(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get LP token components for ${tokenAddress}:`,
        error,
      );
      throw new Error(`Failed to get LP token components from blockchain`);
    }
  }

  async estimateVaultOperationGas(
    operation: 'deposit' | 'withdraw' | 'redeem',
    vaultAddress: string,
    amount: string,
    userAddress: string,
    chain: ChainType,
  ): Promise<string> {
    throw new Error('Method not implemented yet');
  }

  async areWithdrawalsAllowed(
    vaultAddress: string,
    chain: ChainType,
  ): Promise<boolean> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      return await vaultContract.withdrawalsAllowed();
    } catch (error) {
      this.logger.error(
        `Failed to check if withdrawals are allowed for ${vaultAddress}:`,
        error,
      );
      throw new Error(`Failed to check withdrawals allowed from blockchain`);
    }
  }

  async getUserLockInfo(
    userAddress: string,
    vaultAddress: string,
    chain: ChainType,
  ): Promise<{
    depositTime: number;
    totalLockDuration: number;
    lastUpdateTime: number;
  } | null> {
    try {
      const vaultContract = this.getVaultContract(vaultAddress, chain);
      const lockInfo = await vaultContract.getLockInfo(userAddress);

      if (lockInfo.depositTime === 0n) {
        return null;
      }

      return {
        depositTime: Number(lockInfo.depositTime),
        totalLockDuration: Number(lockInfo.totalLockDuration),
        lastUpdateTime: Number(lockInfo.lastUpdateTime),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user lock info for ${userAddress}:`,
        error,
      );
      throw new Error(`Failed to get user lock info from blockchain`);
    }
  }

  async batchCall(
    calls: {
      target: string;
      callData: string;
      allowFailure?: boolean;
    }[],
    chain: ChainType,
    blockNumber?: number,
  ): Promise<
    {
      success: boolean;
      returnData: string;
    }[]
  > {
    throw new Error('Method not implemented yet');
  }

  async healthCheck(chain: ChainType): Promise<{
    isHealthy: boolean;
    latency: number;
    blockNumber: number;
    chainId: number;
  }> {
    const startTime = Date.now();

    try {
      const provider = this.getProvider(chain);
      const [blockNumber, network] = await Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
      ]);

      const latency = Date.now() - startTime;

      return {
        isHealthy: true,
        latency,
        blockNumber,
        chainId: Number(network.chainId),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error(`Health check failed for ${chain}:`, error);

      return {
        isHealthy: false,
        latency,
        blockNumber: 0,
        chainId: 0,
      };
    }
  }
}
