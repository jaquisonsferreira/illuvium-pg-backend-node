import { Inject, Injectable } from '@nestjs/common';
import { IShardEarningHistoryRepository } from '../../domain/repositories/shard-earning-history.repository.interface';
import { ShardEarningHistoryEntity } from '../../domain/entities/shard-earning-history.entity';
import {
  Database,
  ShardEarningHistory as DbShardEarningHistory,
  NewShardEarningHistory,
  ShardEarningHistoryUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class ShardEarningHistoryRepository
  implements IShardEarningHistoryRepository
{
  private repository: BaseRepository<
    'shard_earning_history',
    DbShardEarningHistory,
    NewShardEarningHistory,
    ShardEarningHistoryUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'shard_earning_history',
      DbShardEarningHistory,
      NewShardEarningHistory,
      ShardEarningHistoryUpdate
    >('shard_earning_history');
  }

  private toDomainModel(
    dbHistory: DbShardEarningHistory,
  ): ShardEarningHistoryEntity {
    return new ShardEarningHistoryEntity(
      dbHistory.id,
      dbHistory.wallet_address,
      dbHistory.season_id,
      dbHistory.date,
      parseFloat(dbHistory.staking_shards),
      parseFloat(dbHistory.social_shards),
      parseFloat(dbHistory.developer_shards),
      parseFloat(dbHistory.referral_shards),
      parseFloat(dbHistory.daily_total),
      (dbHistory.vault_breakdown as any) || [],
      (dbHistory.metadata as any) || {},
      dbHistory.created_at,
    );
  }

  private toDatabaseModel(
    entity: ShardEarningHistoryEntity,
  ): NewShardEarningHistory {
    return {
      id: entity.id,
      wallet_address: entity.walletAddress,
      season_id: entity.seasonId,
      date: entity.date,
      staking_shards: entity.stakingShards.toString(),
      social_shards: entity.socialShards.toString(),
      developer_shards: entity.developerShards.toString(),
      referral_shards: entity.referralShards.toString(),
      daily_total: entity.dailyTotal.toString(),
      vault_breakdown: entity.vaultBreakdown,
      metadata: entity.metadata,
    };
  }

  async findById(id: string): Promise<ShardEarningHistoryEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findByWalletAndDate(
    walletAddress: string,
    date: Date,
    seasonId: number,
  ): Promise<ShardEarningHistoryEntity | null> {
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const result = await this.db
      .selectFrom('shard_earning_history')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('date', '=', normalizedDate)
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findByWallet(
    walletAddress: string,
    seasonId?: number,
    startDate?: Date,
    endDate?: Date,
    limit?: number,
    offset?: number,
  ): Promise<{ history: ShardEarningHistoryEntity[]; total: number }> {
    let query = this.db
      .selectFrom('shard_earning_history')
      .where('wallet_address', '=', walletAddress.toLowerCase());

    if (seasonId !== undefined) {
      query = query.where('season_id', '=', seasonId);
    }

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const [results, totalResult] = await Promise.all([
      query
        .selectAll()
        .orderBy('date', 'desc')
        .limit(limit || 30)
        .offset(offset || 0)
        .execute(),
      query
        .select(({ fn }) => [fn.count<number>('id').as('count')])
        .executeTakeFirst(),
    ]);

    return {
      history: results.map(this.toDomainModel),
      total: totalResult?.count ?? 0,
    };
  }

  async findByDateRange(
    seasonId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<ShardEarningHistoryEntity[]> {
    const results = await this.db
      .selectFrom('shard_earning_history')
      .selectAll()
      .where('season_id', '=', seasonId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async create(
    entity: ShardEarningHistoryEntity,
  ): Promise<ShardEarningHistoryEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.create(data);
    return this.toDomainModel(result);
  }

  async createBatch(entities: ShardEarningHistoryEntity[]): Promise<void> {
    if (entities.length === 0) return;

    const data = entities.map((entity) => this.toDatabaseModel(entity));

    await this.db.insertInto('shard_earning_history').values(data).execute();
  }

  async upsert(
    entity: ShardEarningHistoryEntity,
  ): Promise<ShardEarningHistoryEntity> {
    const existing = await this.findByWalletAndDate(
      entity.walletAddress,
      entity.date,
      entity.seasonId,
    );

    if (existing) {
      const data = this.toDatabaseModel(entity);
      await this.db
        .updateTable('shard_earning_history')
        .set(data)
        .where('id', '=', existing.id)
        .execute();

      const updated = await this.findById(existing.id);
      return updated!;
    }

    return this.create(entity);
  }

  async getAverageDailyShards(
    walletAddress: string,
    seasonId: number,
    days: number,
  ): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.db
      .selectFrom('shard_earning_history')
      .select(({ fn }) => [fn.avg<string>('daily_total').as('average')])
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .where('date', '>=', startDate)
      .executeTakeFirst();

    return result?.average ? parseFloat(result.average) : 0;
  }

  async getTopEarnersByDate(
    date: Date,
    seasonId: number,
    limit: number,
    category?: 'total' | 'staking' | 'social' | 'developer' | 'referral',
  ): Promise<ShardEarningHistoryEntity[]> {
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    let query = this.db
      .selectFrom('shard_earning_history')
      .selectAll()
      .where('date', '=', normalizedDate)
      .where('season_id', '=', seasonId);

    // Apply the orderBy based on category
    if (category === 'total' || !category) {
      query = query.orderBy('daily_total', 'desc');
    } else if (category === 'staking') {
      query = query.orderBy('staking_shards', 'desc');
    } else if (category === 'social') {
      query = query.orderBy('social_shards', 'desc');
    } else if (category === 'developer') {
      query = query.orderBy('developer_shards', 'desc');
    } else if (category === 'referral') {
      query = query.orderBy('referral_shards', 'desc');
    }

    const results = await query.limit(limit).execute();

    return results.map(this.toDomainModel);
  }

  async getSummaryByWallet(
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
  }> {
    let query = this.db
      .selectFrom('shard_earning_history')
      .select(({ fn }) => [
        fn.count<number>('id').as('total_days'),
        fn.sum<string>('daily_total').as('total_shards'),
        fn.avg<string>('daily_total').as('avg_daily_shards'),
        fn.sum<string>('staking_shards').as('total_staking'),
        fn.sum<string>('social_shards').as('total_social'),
        fn.sum<string>('developer_shards').as('total_developer'),
        fn.sum<string>('referral_shards').as('total_referral'),
      ])
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('season_id', '=', seasonId);

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const result = await query.executeTakeFirst();

    return {
      totalDays: result?.total_days ?? 0,
      totalShards: result?.total_shards ? parseFloat(result.total_shards) : 0,
      avgDailyShards: result?.avg_daily_shards
        ? parseFloat(result.avg_daily_shards)
        : 0,
      breakdown: {
        staking: result?.total_staking ? parseFloat(result.total_staking) : 0,
        social: result?.total_social ? parseFloat(result.total_social) : 0,
        developer: result?.total_developer
          ? parseFloat(result.total_developer)
          : 0,
        referral: result?.total_referral
          ? parseFloat(result.total_referral)
          : 0,
      },
    };
  }
}
