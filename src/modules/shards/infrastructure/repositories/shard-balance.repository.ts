import { Inject, Injectable } from '@nestjs/common';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';
import {
  Database,
  ShardBalance as DbShardBalance,
  NewShardBalance,
  ShardBalanceUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class ShardBalanceRepository implements IShardBalanceRepository {
  private repository: BaseRepository<
    'shard_balances',
    DbShardBalance,
    NewShardBalance,
    ShardBalanceUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'shard_balances',
      DbShardBalance,
      NewShardBalance,
      ShardBalanceUpdate
    >('shard_balances');
  }

  private toDomainModel(dbBalance: DbShardBalance): ShardBalanceEntity {
    return new ShardBalanceEntity(
      dbBalance.id,
      dbBalance.wallet_address,
      dbBalance.season_id,
      parseFloat(dbBalance.staking_shards),
      parseFloat(dbBalance.social_shards),
      parseFloat(dbBalance.developer_shards),
      parseFloat(dbBalance.referral_shards),
      parseFloat(dbBalance.total_shards),
      dbBalance.last_calculated_at,
      dbBalance.created_at,
      dbBalance.updated_at,
    );
  }

  private toDatabaseModel(entity: ShardBalanceEntity): NewShardBalance {
    return {
      id: entity.id,
      wallet_address: entity.walletAddress,
      season_id: entity.seasonId,
      staking_shards: entity.stakingShards.toString(),
      social_shards: entity.socialShards.toString(),
      developer_shards: entity.developerShards.toString(),
      referral_shards: entity.referralShards.toString(),
      total_shards: entity.totalShards.toString(),
      last_calculated_at: entity.lastCalculatedAt,
    };
  }

  async findById(id: string): Promise<ShardBalanceEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findByWalletAndSeason(
    walletAddress: string,
    seasonId: number,
  ): Promise<ShardBalanceEntity | null> {
    const result = await this.db
      .selectFrom('shard_balances')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findByWallet(walletAddress: string): Promise<ShardBalanceEntity[]> {
    const results = await this.db
      .selectFrom('shard_balances')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .orderBy('season_id', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findBySeason(seasonId: number): Promise<ShardBalanceEntity[]> {
    const results = await this.db
      .selectFrom('shard_balances')
      .selectAll()
      .where('season_id', '=', seasonId)
      .orderBy('total_shards', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findTopBySeason(
    seasonId: number,
    limit: number,
    offset: number,
    category?: 'total' | 'staking' | 'social' | 'developer' | 'referral',
  ): Promise<{ balances: ShardBalanceEntity[]; total: number }> {
    let query = this.db
      .selectFrom('shard_balances')
      .selectAll()
      .where('season_id', '=', seasonId);

    // Apply the orderBy based on category
    if (category === 'total' || !category) {
      query = query.orderBy('total_shards', 'desc');
    } else if (category === 'staking') {
      query = query.orderBy('staking_shards', 'desc');
    } else if (category === 'social') {
      query = query.orderBy('social_shards', 'desc');
    } else if (category === 'developer') {
      query = query.orderBy('developer_shards', 'desc');
    } else if (category === 'referral') {
      query = query.orderBy('referral_shards', 'desc');
    }

    const results = await query.limit(limit).offset(offset).execute();

    const totalResult = await this.db
      .selectFrom('shard_balances')
      .select((eb) => [eb.fn.count<number>('id').as('count')])
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return {
      balances: results.map(this.toDomainModel),
      total: totalResult?.count ?? 0,
    };
  }

  async create(entity: ShardBalanceEntity): Promise<ShardBalanceEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.create(data);
    return this.toDomainModel(result);
  }

  async update(entity: ShardBalanceEntity): Promise<ShardBalanceEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.update(entity.id, data);
    if (!result) {
      throw new Error(`ShardBalance with id ${entity.id} not found`);
    }
    return this.toDomainModel(result);
  }

  async upsert(entity: ShardBalanceEntity): Promise<ShardBalanceEntity> {
    const existing = await this.findByWalletAndSeason(
      entity.walletAddress,
      entity.seasonId,
    );

    if (existing) {
      const updatedEntity = new ShardBalanceEntity(
        existing.id,
        entity.walletAddress,
        entity.seasonId,
        entity.stakingShards,
        entity.socialShards,
        entity.developerShards,
        entity.referralShards,
        entity.totalShards,
        entity.lastCalculatedAt,
        existing.createdAt,
        new Date(),
      );
      return this.update(updatedEntity);
    }

    return this.create(entity);
  }

  async getTotalParticipantsBySeason(seasonId: number): Promise<number> {
    const result = await this.db
      .selectFrom('shard_balances')
      .select((eb) => [eb.fn.count<number>('id').as('count')])
      .where('season_id', '=', seasonId)
      .where('total_shards', '>', '0')
      .executeTakeFirst();

    return result?.count ?? 0;
  }

  async getTotalShardsIssuedBySeason(seasonId: number): Promise<number> {
    const result = await this.db
      .selectFrom('shard_balances')
      .select(({ fn }) => [fn.sum<string>('total_shards').as('total')])
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return result?.total ? parseFloat(result.total) : 0;
  }

  async getWalletRank(
    walletAddress: string,
    seasonId: number,
    category?: 'total' | 'staking' | 'social' | 'developer' | 'referral',
  ): Promise<number> {
    const categoryColumn =
      category === 'total' ? 'total_shards' : `${category}_shards`;

    const userBalance = await this.db
      .selectFrom('shard_balances')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    if (!userBalance || !userBalance[categoryColumn]) {
      return 0;
    }

    const result = await this.db
      .selectFrom('shard_balances')
      .select((eb) => [eb.fn.count<number>('id').as('count')])
      .where('season_id', '=', seasonId)
      .where(categoryColumn as any, '>', userBalance[categoryColumn])
      .executeTakeFirst();

    return (result?.count ?? 0) + 1;
  }

  async searchByWallet(
    searchTerm: string,
    seasonId: number,
    limit: number,
  ): Promise<ShardBalanceEntity[]> {
    const results = await this.db
      .selectFrom('shard_balances')
      .selectAll()
      .where('season_id', '=', seasonId)
      .where('wallet_address', 'like', `%${searchTerm.toLowerCase()}%`)
      .orderBy('total_shards', 'desc')
      .limit(limit)
      .execute();

    return results.map(this.toDomainModel);
  }
}
