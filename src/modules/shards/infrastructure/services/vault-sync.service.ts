import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@shared/decorators/cron.decorator';
import { v4 as uuidv4 } from 'uuid';
import { SubgraphService } from './subgraph.service';
import { CoinGeckoService } from './coingecko.service';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { SHARD_QUEUES, SUPPORTED_CHAINS } from '../../constants';

interface VaultSyncJob {
  chain: string;
  vaultAddress: string;
  snapshotDate: Date;
  blockNumber?: number;
}

@Injectable()
export class VaultSyncService {
  private readonly logger = new Logger(VaultSyncService.name);

  constructor(
    @InjectQueue(SHARD_QUEUES.VAULT_SYNC)
    private readonly vaultSyncQueue: Queue,
    private readonly subgraphService: SubgraphService,
    private readonly coinGeckoService: CoinGeckoService,
    private readonly vaultPositionRepository: IVaultPositionRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async scheduleDailyVaultSync(): Promise<void> {
    this.logger.log('Starting scheduled daily vault sync');

    const snapshotDate = new Date();
    snapshotDate.setUTCHours(0, 0, 0, 0);

    for (const chain of SUPPORTED_CHAINS) {
      await this.syncChainVaults(chain, snapshotDate);
    }
  }

  async syncChainVaults(chain: string, snapshotDate: Date): Promise<void> {
    try {
      this.logger.log(
        `Syncing vaults for chain ${chain} on ${snapshotDate.toISOString()}`,
      );

      const eligibleVaults =
        await this.subgraphService.getEligibleVaults(chain);

      if (eligibleVaults.length === 0) {
        this.logger.warn(`No eligible vaults found for chain ${chain}`);
        return;
      }

      await this.vaultPositionRepository.deleteByDateAndChain(
        snapshotDate,
        chain,
      );

      for (const vaultAddress of eligibleVaults) {
        await this.vaultSyncQueue.add(
          'sync-vault',
          {
            chain,
            vaultAddress,
            snapshotDate,
          } as VaultSyncJob,
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
      }

      this.logger.log(
        `Queued ${eligibleVaults.length} vaults for sync on ${chain}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync vaults for chain ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async processVaultSync(job: VaultSyncJob): Promise<void> {
    const { chain, vaultAddress, snapshotDate, blockNumber } = job;

    try {
      this.logger.debug(`Processing vault sync: ${vaultAddress} on ${chain}`);

      let targetBlock = blockNumber;
      if (!targetBlock) {
        const midnight = new Date(snapshotDate);
        midnight.setUTCHours(0, 0, 0, 0);
        const timestamp = Math.floor(midnight.getTime() / 1000);
        targetBlock = await this.subgraphService.getBlockByTimestamp(
          chain,
          timestamp,
        );
      }

      const [vaultData, positions] = await Promise.all([
        this.subgraphService.getVaultData(vaultAddress, chain),
        this.subgraphService.getVaultPositions(
          vaultAddress,
          chain,
          targetBlock,
        ),
      ]);

      if (!vaultData) {
        this.logger.warn(`No vault data found for ${vaultAddress} on ${chain}`);
        return;
      }

      const tokenPrice = await this.coinGeckoService.getTokenPrice(
        vaultData.asset.symbol,
      );

      const vaultPositionEntities: VaultPositionEntity[] = [];

      for (const position of positions) {
        const shares = BigInt(position.shares);
        const totalSupply = BigInt(position.vault.totalSupply);
        const totalAssets = BigInt(position.vault.totalAssets);

        if (totalSupply === 0n) continue;

        const balance = (shares * totalAssets) / totalSupply;

        const decimals = position.vault.asset.decimals;
        const balanceNumber = Number(balance) / Math.pow(10, decimals);
        const usdValue = balanceNumber * tokenPrice;

        const entity = new VaultPositionEntity(
          uuidv4(),
          position.account,
          vaultAddress,
          position.vault.asset.symbol,
          chain,
          balance.toString(),
          shares.toString(),
          usdValue,
          snapshotDate,
          targetBlock,
          new Date(),
        );

        vaultPositionEntities.push(entity);
      }

      if (vaultPositionEntities.length > 0) {
        await this.vaultPositionRepository.createBatch(vaultPositionEntities);
        this.logger.log(
          `Synced ${vaultPositionEntities.length} positions for vault ${vaultAddress} on ${chain}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync vault ${vaultAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async syncWalletPositions(
    walletAddress: string,
    seasonId: number,
    chain: string,
    snapshotDate: Date,
  ): Promise<VaultPositionEntity[]> {
    try {
      const midnight = new Date(snapshotDate);
      midnight.setUTCHours(0, 0, 0, 0);
      const timestamp = Math.floor(midnight.getTime() / 1000);
      const blockNumber = await this.subgraphService.getBlockByTimestamp(
        chain,
        timestamp,
      );

      const positions = await this.subgraphService.getUserVaultPositions(
        walletAddress,
        chain,
        blockNumber,
      );

      const tokenSymbols = [
        ...new Set(positions.map((p) => p.vault.asset.symbol)),
      ];
      const tokenPrices =
        await this.coinGeckoService.getMultipleTokenPrices(tokenSymbols);

      const vaultPositionEntities: VaultPositionEntity[] = [];

      for (const position of positions) {
        const shares = BigInt(position.shares);
        const totalSupply = BigInt(position.vault.totalSupply);
        const totalAssets = BigInt(position.vault.totalAssets);

        if (totalSupply === 0n) continue;

        const balance = (shares * totalAssets) / totalSupply;
        const tokenPrice = tokenPrices.get(position.vault.asset.symbol) || 0;

        const decimals = position.vault.asset.decimals;
        const balanceNumber = Number(balance) / Math.pow(10, decimals);
        const usdValue = balanceNumber * tokenPrice;

        const entity = new VaultPositionEntity(
          uuidv4(),
          walletAddress,
          position.vault.id,
          position.vault.asset.symbol,
          chain,
          balance.toString(),
          shares.toString(),
          usdValue,
          snapshotDate,
          blockNumber,
          new Date(),
        );

        vaultPositionEntities.push(entity);
      }

      if (vaultPositionEntities.length > 0) {
        for (const entity of vaultPositionEntities) {
          await this.vaultPositionRepository.upsert(entity);
        }
      }

      return vaultPositionEntities;
    } catch (error) {
      this.logger.error(
        `Failed to sync user positions for ${walletAddress} on ${chain}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getHistoricalVaultValue(
    walletAddress: string,
    vaultAddress: string,
    date: Date,
  ): Promise<number> {
    const positions = await this.vaultPositionRepository.findByWalletAndDate(
      walletAddress,
      date,
    );

    const vaultPosition = positions.find(
      (p) => p.vaultAddress.toLowerCase() === vaultAddress.toLowerCase(),
    );

    return vaultPosition?.usdValue || 0;
  }

  async getTotalVaultValue(
    walletAddress: string,
    chain: string,
    date: Date,
  ): Promise<number> {
    const positions = await this.vaultPositionRepository.findByWalletAndDate(
      walletAddress,
      date,
    );

    return positions
      .filter((p) => p.chain === chain)
      .reduce((total, p) => total + p.usdValue, 0);
  }

  async getVaultPosition(
    walletAddress: string,
    vaultAddress: string,
    chain: string,
    blockNumber?: number,
  ): Promise<VaultPositionEntity | null> {
    const positions = await this.subgraphService.getUserVaultPositions(
      walletAddress,
      chain,
      blockNumber,
    );

    const targetPosition = positions.find(
      (p) => p.vault.id.toLowerCase() === vaultAddress.toLowerCase(),
    );

    if (!targetPosition) {
      return null;
    }

    const tokenPrice = await this.coinGeckoService.getTokenPrice(
      targetPosition.vault.asset.symbol,
    );

    const shares = BigInt(targetPosition.shares);
    const totalSupply = BigInt(targetPosition.vault.totalSupply);
    const totalAssets = BigInt(targetPosition.vault.totalAssets);

    if (totalSupply === 0n) return null;

    const balance = (shares * totalAssets) / totalSupply;
    const decimals = targetPosition.vault.asset.decimals;
    const balanceNumber = Number(balance) / Math.pow(10, decimals);
    const usdValue = balanceNumber * tokenPrice;

    return new VaultPositionEntity(
      uuidv4(),
      walletAddress,
      vaultAddress,
      targetPosition.vault.asset.symbol,
      chain,
      balance.toString(),
      shares.toString(),
      usdValue,
      new Date(),
      blockNumber || 0,
      new Date(),
    );
  }
}
