import { Inject, Injectable } from '@nestjs/common';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { SeasonEntity } from '../../domain/entities/season.entity';
import {
  Database,
  Season as DbSeason,
  NewSeason,
  SeasonUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class SeasonRepository implements ISeasonRepository {
  private repository: BaseRepository<
    'seasons',
    DbSeason,
    NewSeason,
    SeasonUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'seasons',
      DbSeason,
      NewSeason,
      SeasonUpdate
    >('seasons');
  }

  private toDomainModel(dbSeason: DbSeason): SeasonEntity {
    return new SeasonEntity(
      dbSeason.id,
      dbSeason.name,
      dbSeason.chain,
      dbSeason.start_date,
      dbSeason.end_date,
      dbSeason.status,
      dbSeason.config as any,
      dbSeason.total_participants,
      parseFloat(dbSeason.total_shards_issued),
      dbSeason.created_at,
      dbSeason.updated_at,
    );
  }

  private toDatabaseModel(entity: SeasonEntity): NewSeason {
    return {
      id: entity.id,
      name: entity.name,
      chain: entity.chain,
      start_date: entity.startDate,
      end_date: entity.endDate,
      status: entity.status,
      config: entity.config,
      total_participants: entity.totalParticipants,
      total_shards_issued: entity.totalShardsIssued.toString(),
    };
  }

  async findById(id: number): Promise<SeasonEntity | null> {
    const result = await this.repository.findById(id.toString());
    return result ? this.toDomainModel(result) : null;
  }

  async findActive(): Promise<SeasonEntity | null> {
    const result = await this.db
      .selectFrom('seasons')
      .selectAll()
      .where('status', '=', 'active')
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findByChain(chain: string): Promise<SeasonEntity[]> {
    const results = await this.db
      .selectFrom('seasons')
      .selectAll()
      .where('chain', '=', chain)
      .orderBy('id', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findActiveByChain(chain: string): Promise<SeasonEntity[]> {
    const results = await this.db
      .selectFrom('seasons')
      .selectAll()
      .where('chain', '=', chain)
      .where('status', '=', 'active')
      .orderBy('id', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findByStatus(status: string): Promise<SeasonEntity[]> {
    const results = await this.db
      .selectFrom('seasons')
      .selectAll()
      .where('status', '=', status as 'active' | 'completed' | 'upcoming')
      .orderBy('id', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findAll(): Promise<SeasonEntity[]> {
    const results = await this.repository.findAll();
    return results.map(this.toDomainModel);
  }

  async create(entity: SeasonEntity): Promise<SeasonEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.create(data);
    return this.toDomainModel(result);
  }

  async update(entity: SeasonEntity): Promise<SeasonEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.update(entity.id.toString(), data);
    if (!result) {
      throw new Error(`Season with id ${entity.id} not found`);
    }
    return this.toDomainModel(result);
  }

  async findUpcoming(): Promise<SeasonEntity[]> {
    const results = await this.db
      .selectFrom('seasons')
      .selectAll()
      .where('status', '=', 'upcoming')
      .orderBy('start_date', 'asc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findCompleted(): Promise<SeasonEntity[]> {
    const results = await this.db
      .selectFrom('seasons')
      .selectAll()
      .where('status', '=', 'completed')
      .orderBy('end_date', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async exists(id: number): Promise<boolean> {
    const result = await this.db
      .selectFrom('seasons')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();

    return !!result;
  }
}
