import { Inject, Injectable } from '@nestjs/common';
import { IDeveloperContributionRepository } from '../../domain/repositories/developer-contribution.repository.interface';
import {
  DeveloperContributionEntity,
  DeveloperActionType,
} from '../../domain/entities/developer-contribution.entity';
import {
  Database,
  DeveloperContribution as DbDeveloperContribution,
  NewDeveloperContribution,
  DeveloperContributionUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class DeveloperContributionRepository
  implements IDeveloperContributionRepository
{
  private repository: BaseRepository<
    'developer_contributions',
    DbDeveloperContribution,
    NewDeveloperContribution,
    DeveloperContributionUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'developer_contributions',
      DbDeveloperContribution,
      NewDeveloperContribution,
      DeveloperContributionUpdate
    >('developer_contributions');
  }

  private toDomainModel(
    dbContribution: DbDeveloperContribution,
  ): DeveloperContributionEntity {
    return new DeveloperContributionEntity(
      dbContribution.id,
      dbContribution.wallet_address,
      dbContribution.season_id,
      dbContribution.action_type as DeveloperActionType,
      dbContribution.action_details as any,
      parseFloat(dbContribution.shards_earned),
      dbContribution.verified,
      dbContribution.verified_at,
      dbContribution.verified_by,
      dbContribution.distributed_at,
      dbContribution.created_at,
      dbContribution.updated_at,
    );
  }

  private toDatabaseModel(
    entity: DeveloperContributionEntity,
  ): NewDeveloperContribution {
    return {
      id: entity.id,
      wallet_address: entity.walletAddress,
      season_id: entity.seasonId,
      action_type: entity.actionType,
      action_details: entity.actionDetails,
      shards_earned: entity.shardsEarned.toString(),
      verified: entity.verified,
      verified_at: entity.verifiedAt,
      verified_by: entity.verifiedBy,
      distributed_at: entity.distributedAt,
    };
  }

  async findById(id: string): Promise<DeveloperContributionEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findByWallet(
    walletAddress: string,
    seasonId?: number,
  ): Promise<DeveloperContributionEntity[]> {
    let query = this.db
      .selectFrom('developer_contributions')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase());

    if (seasonId !== undefined) {
      query = query.where('season_id', '=', seasonId);
    }

    const results = await query.orderBy('created_at', 'desc').execute();

    return results.map(this.toDomainModel);
  }

  async findByWalletAndDate(
    walletAddress: string,
    date: Date,
  ): Promise<DeveloperContributionEntity[]> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const results = await this.db
      .selectFrom('developer_contributions')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('created_at', '>=', startOfDay)
      .where('created_at', '<=', endOfDay)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findBySeason(
    seasonId: number,
    verified?: boolean,
    distributed?: boolean,
  ): Promise<DeveloperContributionEntity[]> {
    let query = this.db
      .selectFrom('developer_contributions')
      .selectAll()
      .where('season_id', '=', seasonId);

    if (verified !== undefined) {
      query = query.where('verified', '=', verified);
    }

    if (distributed !== undefined) {
      if (distributed) {
        query = query.where('distributed_at', 'is not', null);
      } else {
        query = query.where('distributed_at', 'is', null);
      }
    }

    const results = await query.orderBy('created_at', 'desc').execute();

    return results.map(this.toDomainModel);
  }

  async findUnverified(
    seasonId: number,
  ): Promise<DeveloperContributionEntity[]> {
    const results = await this.db
      .selectFrom('developer_contributions')
      .selectAll()
      .where('season_id', '=', seasonId)
      .where('verified', '=', false)
      .orderBy('created_at', 'asc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findVerifiedUndistributed(
    seasonId: number,
  ): Promise<DeveloperContributionEntity[]> {
    const results = await this.db
      .selectFrom('developer_contributions')
      .selectAll()
      .where('season_id', '=', seasonId)
      .where('verified', '=', true)
      .where('distributed_at', 'is', null)
      .orderBy('verified_at', 'asc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findByActionType(
    actionType: DeveloperActionType,
    seasonId: number,
  ): Promise<DeveloperContributionEntity[]> {
    const results = await this.db
      .selectFrom('developer_contributions')
      .selectAll()
      .where('action_type', '=', actionType)
      .where('season_id', '=', seasonId)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async create(
    entity: DeveloperContributionEntity,
  ): Promise<DeveloperContributionEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.create(data);
    return this.toDomainModel(result);
  }

  async update(
    entity: DeveloperContributionEntity,
  ): Promise<DeveloperContributionEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.update(entity.id, data);
    if (!result) {
      throw new Error(`DeveloperContribution with id ${entity.id} not found`);
    }
    return this.toDomainModel(result);
  }

  async createBatch(entities: DeveloperContributionEntity[]): Promise<void> {
    if (entities.length === 0) return;

    const data = entities.map((entity) => this.toDatabaseModel(entity));

    await this.db.insertInto('developer_contributions').values(data).execute();
  }

  async getTotalShardsByWallet(
    walletAddress: string,
    seasonId: number,
    distributedOnly?: boolean,
  ): Promise<number> {
    let query = this.db
      .selectFrom('developer_contributions')
      .select(({ fn }) => [fn.sum<string>('shards_earned').as('total')])
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('season_id', '=', seasonId);

    if (distributedOnly) {
      query = query.where('distributed_at', 'is not', null);
    }

    const result = await query.executeTakeFirst();
    return result?.total ? parseFloat(result.total) : 0;
  }

  async getStatsBySeason(seasonId: number): Promise<{
    totalContributions: number;
    verifiedContributions: number;
    distributedContributions: number;
    totalShardsEarned: number;
    byActionType: Record<
      DeveloperActionType,
      {
        count: number;
        totalShards: number;
      }
    >;
  }> {
    const [totalStats, verifiedStats, distributedStats] = await Promise.all([
      this.db
        .selectFrom('developer_contributions')
        .select(({ fn }) => [
          fn.count<number>('id').as('count'),
          fn.sum<string>('shards_earned').as('total_shards'),
        ])
        .where('season_id', '=', seasonId)
        .executeTakeFirst(),
      this.db
        .selectFrom('developer_contributions')
        .select(({ fn }) => [fn.count<number>('id').as('count')])
        .where('season_id', '=', seasonId)
        .where('verified', '=', true)
        .executeTakeFirst(),
      this.db
        .selectFrom('developer_contributions')
        .select(({ fn }) => [fn.count<number>('id').as('count')])
        .where('season_id', '=', seasonId)
        .where('distributed_at', 'is not', null)
        .executeTakeFirst(),
    ]);

    const byActionTypeResults = await this.db
      .selectFrom('developer_contributions')
      .select(({ fn }) => [
        'action_type',
        fn.count<number>('id').as('count'),
        fn.sum<string>('shards_earned').as('total_shards'),
      ])
      .where('season_id', '=', seasonId)
      .groupBy('action_type')
      .execute();

    const byActionType: Record<
      DeveloperActionType,
      { count: number; totalShards: number }
    > = {} as any;

    for (const row of byActionTypeResults) {
      byActionType[row.action_type as DeveloperActionType] = {
        count: row.count,
        totalShards: row.total_shards ? parseFloat(row.total_shards) : 0,
      };
    }

    return {
      totalContributions: totalStats?.count ?? 0,
      verifiedContributions: verifiedStats?.count ?? 0,
      distributedContributions: distributedStats?.count ?? 0,
      totalShardsEarned: totalStats?.total_shards
        ? parseFloat(totalStats.total_shards)
        : 0,
      byActionType,
    };
  }

  async checkDuplicateContribution(
    walletAddress: string,
    actionType: DeveloperActionType,
    actionDetails: Record<string, any>,
    seasonId: number,
  ): Promise<boolean> {
    const results = await this.db
      .selectFrom('developer_contributions')
      .select('id')
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('action_type', '=', actionType)
      .where('season_id', '=', seasonId)
      .execute();

    for (const result of results) {
      const existing = await this.findById(result.id);
      if (
        existing &&
        this.areActionDetailsEqual(existing.actionDetails, actionDetails)
      ) {
        return true;
      }
    }

    return false;
  }

  private areActionDetailsEqual(
    details1: Record<string, any>,
    details2: Record<string, any>,
  ): boolean {
    // Compare key identifiers that would indicate a duplicate
    const keysToCompare = [
      'operationId',
      'contractAddress',
      'transactionHash',
      'pullRequestUrl',
    ];

    for (const key of keysToCompare) {
      if (details1[key] && details2[key] && details1[key] === details2[key]) {
        return true;
      }
    }

    return false;
  }
}
