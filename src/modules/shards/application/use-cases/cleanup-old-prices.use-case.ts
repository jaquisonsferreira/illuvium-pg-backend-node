import { Injectable, Logger, Inject } from '@nestjs/common';
import { IPriceHistoryRepository } from '../../domain/repositories/price-history.repository.interface';

interface CleanupOldPricesDto {
  retentionDays?: number;
  granularity?: 'minute' | 'hour' | 'day' | 'all';
  dryRun?: boolean;
}

interface CleanupResult {
  granularity: string;
  retentionDays: number;
  cutoffDate: Date;
  deletedCount: number;
  dryRun: boolean;
  details: Array<{
    granularity: string;
    cutoffDate: Date;
    affectedRecords: number;
  }>;
}

interface RetentionPolicy {
  granularity: string;
  retentionDays: number;
}

@Injectable()
export class CleanupOldPricesUseCase {
  private readonly logger = new Logger(CleanupOldPricesUseCase.name);

  private readonly defaultRetentionPolicies: RetentionPolicy[] = [
    { granularity: 'minute', retentionDays: 7 },
    { granularity: 'hour', retentionDays: 30 },
    { granularity: 'day', retentionDays: 365 },
  ];

  constructor(
    @Inject('IPriceHistoryRepository')
    private readonly priceHistoryRepository: IPriceHistoryRepository,
  ) {}

  async execute(dto: CleanupOldPricesDto = {}): Promise<CleanupResult> {
    const { retentionDays, granularity = 'all', dryRun = false } = dto;

    const result: CleanupResult = {
      granularity,
      retentionDays: retentionDays || 0,
      cutoffDate: new Date(),
      deletedCount: 0,
      dryRun,
      details: [],
    };

    try {
      if (granularity === 'all') {
        await this.cleanupAllGranularities(dryRun, result);
      } else {
        const retention =
          retentionDays || this.getDefaultRetentionDays(granularity);
        await this.cleanupByGranularity(granularity, retention, dryRun, result);
      }

      this.logger.log(
        `Cleanup ${dryRun ? '(DRY RUN) ' : ''}completed: ${result.deletedCount} records ${dryRun ? 'would be ' : ''}deleted`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Error during price history cleanup:',
        error instanceof Error ? error.stack : error,
      );
      throw new Error(
        `Failed to cleanup old prices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async cleanupAllGranularities(
    dryRun: boolean,
    result: CleanupResult,
  ): Promise<void> {
    for (const policy of this.defaultRetentionPolicies) {
      await this.cleanupByGranularity(
        policy.granularity,
        policy.retentionDays,
        dryRun,
        result,
      );
    }
  }

  private async cleanupByGranularity(
    granularity: string,
    retentionDays: number,
    dryRun: boolean,
    result: CleanupResult,
  ): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.log(
      `${dryRun ? '(DRY RUN) ' : ''}Cleaning up ${granularity} price records older than ${cutoffDate.toISOString()}`,
    );

    let deletedCount = 0;

    if (dryRun) {
      const recordsToDelete =
        await this.priceHistoryRepository.findByTokenAndTimeRange(
          '',
          '',
          new Date(0),
          cutoffDate,
          granularity,
        );
      deletedCount = recordsToDelete.length;
    } else {
      deletedCount = await this.priceHistoryRepository.deleteOlderThan(
        cutoffDate,
        granularity,
      );
    }

    result.deletedCount += deletedCount;
    result.details.push({
      granularity,
      cutoffDate,
      affectedRecords: deletedCount,
    });

    this.logger.log(
      `${dryRun ? 'Would delete' : 'Deleted'} ${deletedCount} ${granularity} price records`,
    );
  }

  private getDefaultRetentionDays(granularity: string): number {
    const policy = this.defaultRetentionPolicies.find(
      (p) => p.granularity === granularity,
    );
    return policy?.retentionDays || 30;
  }

  async getCleanupStatistics(): Promise<{
    totalRecords: number;
    recordsByGranularity: Record<string, number>;
    oldestRecordsByGranularity: Record<string, Date | null>;
    estimatedDeletionsByPolicy: Array<{
      granularity: string;
      retentionDays: number;
      cutoffDate: Date;
      recordsToDelete: number;
    }>;
  }> {
    const stats = {
      totalRecords: 0,
      recordsByGranularity: {} as Record<string, number>,
      oldestRecordsByGranularity: {} as Record<string, Date | null>,
      estimatedDeletionsByPolicy: [] as Array<{
        granularity: string;
        retentionDays: number;
        cutoffDate: Date;
        recordsToDelete: number;
      }>,
    };

    for (const policy of this.defaultRetentionPolicies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const recordsToDelete =
        await this.priceHistoryRepository.findByTokenAndTimeRange(
          '',
          '',
          new Date(0),
          cutoffDate,
          policy.granularity,
        );

      const allRecords =
        await this.priceHistoryRepository.findByTokenAndTimeRange(
          '',
          '',
          new Date(0),
          new Date(),
          policy.granularity,
        );

      stats.recordsByGranularity[policy.granularity] = allRecords.length;
      stats.totalRecords += allRecords.length;

      if (allRecords.length > 0) {
        const oldestRecord = allRecords.reduce((oldest, record) =>
          record.timestamp < oldest.timestamp ? record : oldest,
        );
        stats.oldestRecordsByGranularity[policy.granularity] =
          oldestRecord.timestamp;
      } else {
        stats.oldestRecordsByGranularity[policy.granularity] = null;
      }

      stats.estimatedDeletionsByPolicy.push({
        granularity: policy.granularity,
        retentionDays: policy.retentionDays,
        cutoffDate,
        recordsToDelete: recordsToDelete.length,
      });
    }

    return stats;
  }

  async cleanupDuplicates(): Promise<{
    duplicatesFound: number;
    duplicatesRemoved: number;
    errors: number;
  }> {
    const result = {
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      errors: 0,
    };

    try {
      const allTokens = await this.getAllUniqueTokens();

      for (const { tokenAddress, chain } of allTokens) {
        try {
          const duplicates = await this.findDuplicatesForToken(
            tokenAddress,
            chain,
          );

          if (duplicates.length > 0) {
            result.duplicatesFound += duplicates.length;
            const removed = await this.removeDuplicates(duplicates);
            result.duplicatesRemoved += removed;
          }
        } catch (error) {
          this.logger.error(
            `Failed to cleanup duplicates for ${tokenAddress} on ${chain}:`,
            error instanceof Error ? error.message : error,
          );
          result.errors++;
        }
      }

      this.logger.log(
        `Duplicate cleanup completed: ${result.duplicatesFound} found, ${result.duplicatesRemoved} removed, ${result.errors} errors`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Error during duplicate cleanup:',
        error instanceof Error ? error.stack : error,
      );
      throw new Error(
        `Failed to cleanup duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async getAllUniqueTokens(): Promise<
    Array<{ tokenAddress: string; chain: string }>
  > {
    const endDate = new Date();
    const startDate = new Date(0);

    const allRecords =
      await this.priceHistoryRepository.findByTokenAndTimeRange(
        '',
        '',
        startDate,
        endDate,
      );

    const uniqueTokens = new Map<
      string,
      { tokenAddress: string; chain: string }
    >();

    for (const record of allRecords) {
      const key = `${record.tokenAddress}:${record.chain}`;
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, {
          tokenAddress: record.tokenAddress,
          chain: record.chain,
        });
      }
    }

    return Array.from(uniqueTokens.values());
  }

  private async findDuplicatesForToken(
    tokenAddress: string,
    chain: string,
  ): Promise<string[]> {
    const endDate = new Date();
    const startDate = new Date(0);

    const records = await this.priceHistoryRepository.findByTokenAndTimeRange(
      tokenAddress,
      chain,
      startDate,
      endDate,
    );

    const groupedByTimestamp = new Map<string, string[]>();

    for (const record of records) {
      const key = `${record.timestamp.getTime()}:${record.granularity}`;
      const existing = groupedByTimestamp.get(key) || [];
      existing.push(record.id);
      groupedByTimestamp.set(key, existing);
    }

    const duplicateIds: string[] = [];

    for (const [, ids] of groupedByTimestamp) {
      if (ids.length > 1) {
        duplicateIds.push(...ids.slice(1));
      }
    }

    return duplicateIds;
  }

  private async removeDuplicates(duplicateIds: string[]): Promise<number> {
    let removed = 0;

    for (const id of duplicateIds) {
      try {
        const deleted = await this.priceHistoryRepository.deleteOlderThan(
          new Date(),
          undefined,
        );
        if (deleted > 0) {
          removed++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to remove duplicate ${id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return removed;
  }

  async archiveOldPrices(
    retentionDays: number,
    archivePath: string,
  ): Promise<{
    archived: number;
    deleted: number;
    archiveFile: string;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const recordsToArchive =
      await this.priceHistoryRepository.findByTokenAndTimeRange(
        '',
        '',
        new Date(0),
        cutoffDate,
      );

    if (recordsToArchive.length === 0) {
      return {
        archived: 0,
        deleted: 0,
        archiveFile: '',
      };
    }

    const archiveData = recordsToArchive.map((record) => ({
      id: record.id,
      tokenAddress: record.tokenAddress,
      chain: record.chain,
      priceUsd: record.priceUsd,
      priceChange24h: record.priceChange24h,
      marketCap: record.marketCap,
      volume24h: record.volume24h,
      timestamp: record.timestamp.toISOString(),
      source: record.source,
      granularity: record.granularity,
      createdAt: record.createdAt.toISOString(),
    }));

    const archiveFileName = `price_history_archive_${new Date().toISOString().split('T')[0]}.json`;
    const fullArchivePath = `${archivePath}/${archiveFileName}`;

    const fs = await import('fs/promises');
    await fs.writeFile(
      fullArchivePath,
      JSON.stringify(archiveData, null, 2),
      'utf-8',
    );

    const deleted =
      await this.priceHistoryRepository.deleteOlderThan(cutoffDate);

    this.logger.log(
      `Archived ${recordsToArchive.length} records and deleted ${deleted} from database`,
    );

    return {
      archived: recordsToArchive.length,
      deleted,
      archiveFile: fullArchivePath,
    };
  }
}
