import { Injectable, Logger, Inject } from '@nestjs/common';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { VaultSyncService } from '../../infrastructure/services/vault-sync.service';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import { v4 as uuidv4 } from 'uuid';

interface SyncVaultPositionsDto {
  walletAddress?: string;
  seasonId: number;
  chain?: string;
}

interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  details: Array<{
    walletAddress: string;
    chain: string;
    vaultAddress: string;
    status: 'synced' | 'updated' | 'error';
    error?: string;
  }>;
}

@Injectable()
export class SyncVaultPositionsUseCase {
  private readonly logger = new Logger(SyncVaultPositionsUseCase.name);

  constructor(
    @Inject('IVaultPositionRepository')
    private readonly vaultPositionRepository: IVaultPositionRepository,
    @Inject('ISeasonRepository')
    private readonly seasonRepository: ISeasonRepository,
    private readonly vaultSyncService: VaultSyncService,
  ) {}

  async execute(dto: SyncVaultPositionsDto): Promise<SyncResult> {
    const { walletAddress, seasonId, chain } = dto;

    const season = await this.seasonRepository.findById(seasonId);
    if (!season || !season.isActive()) {
      throw new Error(`Season ${seasonId} is not active`);
    }

    const result: SyncResult = {
      synced: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    try {
      if (walletAddress) {
        await this.syncWalletPositions(walletAddress, seasonId, chain, result);
      } else {
        await this.syncAllActivePositions(seasonId, chain, result);
      }
    } catch (error) {
      this.logger.error(
        'Error during vault position sync:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }

    this.logger.log(
      `Sync completed: ${result.synced} synced, ${result.updated} updated, ${result.errors} errors`,
    );

    return result;
  }

  private async syncWalletPositions(
    walletAddress: string,
    seasonId: number,
    chain: string | undefined,
    result: SyncResult,
  ): Promise<void> {
    const chains = chain
      ? [chain]
      : ['base', 'ethereum', 'arbitrum', 'optimism'];

    for (const chainName of chains) {
      try {
        const positions = await this.vaultSyncService.syncWalletPositions(
          walletAddress,
          seasonId,
          chainName,
          new Date(),
        );

        for (const positionData of positions) {
          await this.processPosition(
            walletAddress,
            chainName,
            positionData,
            seasonId,
            result,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to sync ${walletAddress} on ${chainName}:`,
          error instanceof Error ? error.message : error,
        );
        result.errors++;
        result.details.push({
          walletAddress,
          chain: chainName,
          vaultAddress: 'N/A',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async syncAllActivePositions(
    seasonId: number,
    chain: string | undefined,
    result: SyncResult,
  ): Promise<void> {
    const activePositions =
      await this.vaultPositionRepository.findActiveBySeason(seasonId);
    const uniqueWallets = [
      ...new Set(activePositions.map((p) => p.walletAddress)),
    ];

    this.logger.log(`Found ${uniqueWallets.length} unique wallets to sync`);

    for (const wallet of uniqueWallets) {
      await this.syncWalletPositions(wallet, seasonId, chain, result);
    }
  }

  private async processPosition(
    walletAddress: string,
    chain: string,
    positionData: any,
    seasonId: number,
    result: SyncResult,
  ): Promise<void> {
    try {
      const existingPosition =
        await this.vaultPositionRepository.findByWalletVaultAndSeason(
          walletAddress,
          positionData.vaultAddress,
          seasonId,
        );

      if (existingPosition) {
        const hasChanged =
          existingPosition.balance !== positionData.balance ||
          existingPosition.usdValue !== positionData.usdValue;

        if (hasChanged) {
          const updatedPosition = new VaultPositionEntity(
            existingPosition.id,
            existingPosition.walletAddress,
            existingPosition.vaultAddress,
            existingPosition.assetSymbol,
            existingPosition.chain,
            positionData.balance,
            existingPosition.shares,
            positionData.usdValue,
            existingPosition.lockWeeks,
            existingPosition.snapshotDate,
            existingPosition.blockNumber,
            existingPosition.createdAt,
          );

          await this.vaultPositionRepository.update(updatedPosition);
          result.updated++;
          result.details.push({
            walletAddress,
            chain,
            vaultAddress: positionData.vaultAddress,
            status: 'updated',
          });
        }
      } else {
        const newPosition = new VaultPositionEntity(
          uuidv4(),
          walletAddress.toLowerCase(),
          positionData.vaultAddress.toLowerCase(),
          positionData.assetSymbol,
          chain,
          positionData.balance,
          positionData.shares,
          positionData.usdValue,
          positionData.lockWeeks || 4,
          new Date(),
          positionData.blockNumber || 0,
          new Date(),
        );

        await this.vaultPositionRepository.create(newPosition);
        result.synced++;
        result.details.push({
          walletAddress,
          chain,
          vaultAddress: positionData.vaultAddress,
          status: 'synced',
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process position for ${walletAddress} in vault ${positionData.vaultAddress}:`,
        error instanceof Error ? error.message : error,
      );
      result.errors++;
      result.details.push({
        walletAddress,
        chain,
        vaultAddress: positionData.vaultAddress,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async removeStalePositions(
    seasonId: number,
    staleThresholdHours: number = 24,
  ): Promise<number> {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - staleThresholdHours);

    const stalePositions =
      await this.vaultPositionRepository.findStalePositions(staleDate);

    let removedCount = 0;

    for (const position of stalePositions) {
      try {
        const currentData = await this.vaultSyncService.getVaultPosition(
          position.walletAddress,
          position.vaultAddress,
          position.chain,
        );

        if (!currentData || parseFloat(currentData.balance) === 0) {
          await this.vaultPositionRepository.delete(position.id);
          removedCount++;
          this.logger.log(
            `Removed stale position for ${position.walletAddress} in vault ${position.vaultAddress}`,
          );
        } else {
          const updatedPosition = new VaultPositionEntity(
            position.id,
            position.walletAddress,
            position.vaultAddress,
            position.assetSymbol,
            position.chain,
            currentData.balance,
            position.shares,
            currentData.usdValue,
            position.lockWeeks,
            position.snapshotDate,
            position.blockNumber,
            position.createdAt,
          );
          await this.vaultPositionRepository.update(updatedPosition);
        }
      } catch (error) {
        this.logger.error(
          `Failed to check stale position ${position.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return removedCount;
  }
}
