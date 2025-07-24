import { ShardEarningHistoryEntity } from '../entities/shard-earning-history.entity';

export interface IShardEarningHistoryRepository {
  findById(id: string): Promise<ShardEarningHistoryEntity | null>;

  findByWalletAndDate(
    walletAddress: string,
    date: Date,
    seasonId: number,
  ): Promise<ShardEarningHistoryEntity | null>;

  findByWallet(
    walletAddress: string,
    seasonId?: number,
    startDate?: Date,
    endDate?: Date,
    limit?: number,
    offset?: number,
  ): Promise<{ history: ShardEarningHistoryEntity[]; total: number }>;

  findByDateRange(
    seasonId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<ShardEarningHistoryEntity[]>;

  create(entity: ShardEarningHistoryEntity): Promise<ShardEarningHistoryEntity>;

  createBatch(entities: ShardEarningHistoryEntity[]): Promise<void>;

  upsert(entity: ShardEarningHistoryEntity): Promise<ShardEarningHistoryEntity>;

  getAverageDailyShards(
    walletAddress: string,
    seasonId: number,
    days: number,
  ): Promise<number>;

  getTopEarnersByDate(
    date: Date,
    seasonId: number,
    limit: number,
    category?: 'total' | 'staking' | 'social' | 'developer' | 'referral',
  ): Promise<ShardEarningHistoryEntity[]>;

  getSummaryByWallet(
    walletAddress: string,
    seasonId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalDays: number;
    totalShards: number;
    avgDailyShards: number;
    breakdown: {
      staking: number;
      social: number;
      developer: number;
      referral: number;
    };
  }>;
}
