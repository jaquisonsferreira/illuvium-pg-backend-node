import { Inject, Injectable } from '@nestjs/common';
import { IReferralRepository } from '../../domain/repositories/referral.repository.interface';
import { ReferralEntity } from '../../domain/entities/referral.entity';
import {
  Database,
  Referral as DbReferral,
  NewReferral,
  ReferralUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class ReferralRepository implements IReferralRepository {
  private repository: BaseRepository<
    'referrals',
    DbReferral,
    NewReferral,
    ReferralUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'referrals',
      DbReferral,
      NewReferral,
      ReferralUpdate
    >('referrals');
  }

  private toDomainModel(dbReferral: DbReferral): ReferralEntity {
    return new ReferralEntity(
      dbReferral.id,
      dbReferral.referrer_address,
      dbReferral.referee_address,
      dbReferral.season_id,
      dbReferral.status,
      dbReferral.activation_date,
      dbReferral.referee_multiplier_expires,
      parseFloat(dbReferral.total_shards_earned),
      dbReferral.created_at,
      dbReferral.updated_at,
    );
  }

  private toDatabaseModel(entity: ReferralEntity): NewReferral {
    return {
      id: entity.id,
      referrer_address: entity.referrerAddress,
      referee_address: entity.refereeAddress,
      season_id: entity.seasonId,
      status: entity.status,
      activation_date: entity.activationDate,
      referee_multiplier_expires: entity.refereeMultiplierExpires,
      total_shards_earned: entity.totalShardsEarned.toString(),
    };
  }

  async findById(id: string): Promise<ReferralEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findByRefereeAndSeason(
    refereeAddress: string,
    seasonId: number,
  ): Promise<ReferralEntity | null> {
    const result = await this.db
      .selectFrom('referrals')
      .selectAll()
      .where('referee_address', '=', refereeAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findByReferrerAndSeason(
    referrerAddress: string,
    seasonId: number,
  ): Promise<ReferralEntity[]> {
    const results = await this.db
      .selectFrom('referrals')
      .selectAll()
      .where('referrer_address', '=', referrerAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findActiveByReferrer(
    referrerAddress: string,
    seasonId: number,
  ): Promise<ReferralEntity[]> {
    const results = await this.db
      .selectFrom('referrals')
      .selectAll()
      .where('referrer_address', '=', referrerAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .where('status', '=', 'active')
      .orderBy('activation_date', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async countByReferrerAndSeason(
    referrerAddress: string,
    seasonId: number,
  ): Promise<number> {
    const result = await this.db
      .selectFrom('referrals')
      .select(({ fn }) => [fn.count<number>('id').as('count')])
      .where('referrer_address', '=', referrerAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return result?.count ?? 0;
  }

  async countActiveByReferrerAndSeason(
    referrerAddress: string,
    seasonId: number,
  ): Promise<number> {
    const result = await this.db
      .selectFrom('referrals')
      .select(({ fn }) => [fn.count<number>('id').as('count')])
      .where('referrer_address', '=', referrerAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    return result?.count ?? 0;
  }

  async create(entity: ReferralEntity): Promise<ReferralEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.create(data);
    return this.toDomainModel(result);
  }

  async update(entity: ReferralEntity): Promise<ReferralEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.update(entity.id, data);
    if (!result) {
      throw new Error(`Referral with id ${entity.id} not found`);
    }
    return this.toDomainModel(result);
  }

  async findPendingActivations(
    seasonId: number,
    minShards: number,
  ): Promise<ReferralEntity[]> {
    const results = await this.db
      .selectFrom('referrals')
      .innerJoin('shard_balances', (join) =>
        join
          .onRef(
            'referrals.referee_address',
            '=',
            'shard_balances.wallet_address',
          )
          .onRef('referrals.season_id', '=', 'shard_balances.season_id'),
      )
      .selectAll('referrals')
      .where('referrals.season_id', '=', seasonId)
      .where('referrals.status', '=', 'pending')
      .where('shard_balances.total_shards', '>=', minShards.toString())
      .execute();

    return results.map(this.toDomainModel);
  }

  async findExpiringBonuses(
    seasonId: number,
    expiryDate: Date,
  ): Promise<ReferralEntity[]> {
    const results = await this.db
      .selectFrom('referrals')
      .selectAll()
      .where('season_id', '=', seasonId)
      .where('status', '=', 'active')
      .where('referee_multiplier_expires', '<=', expiryDate)
      .execute();

    return results.map(this.toDomainModel);
  }

  async getTotalReferralShardsByReferrer(
    referrerAddress: string,
    seasonId: number,
  ): Promise<number> {
    const result = await this.db
      .selectFrom('referrals')
      .select(({ fn }) => [fn.sum<string>('total_shards_earned').as('total')])
      .where('referrer_address', '=', referrerAddress.toLowerCase())
      .where('season_id', '=', seasonId)
      .executeTakeFirst();

    return result?.total ? parseFloat(result.total) : 0;
  }
}
