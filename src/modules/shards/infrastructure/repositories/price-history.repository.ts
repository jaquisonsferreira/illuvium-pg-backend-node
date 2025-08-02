import { Inject, Injectable } from '@nestjs/common';
import { IPriceHistoryRepository } from '../../domain/repositories/price-history.repository.interface';
import { PriceHistoryEntity } from '../../domain/entities/price-history.entity';
import {
  Database,
  PriceHistory as DbPriceHistory,
  NewPriceHistory,
  PriceHistoryUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';
import { sql } from 'kysely';

@Injectable()
export class PriceHistoryRepository implements IPriceHistoryRepository {
  private repository: BaseRepository<
    'price_history',
    DbPriceHistory,
    NewPriceHistory,
    PriceHistoryUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'price_history',
      DbPriceHistory,
      NewPriceHistory,
      PriceHistoryUpdate
    >('price_history');
  }

  private toDomainModel(dbPrice: DbPriceHistory): PriceHistoryEntity {
    return new PriceHistoryEntity(
      dbPrice.id,
      dbPrice.token_address,
      dbPrice.chain,
      parseFloat(dbPrice.price_usd),
      dbPrice.price_change_24h ? parseFloat(dbPrice.price_change_24h) : null,
      dbPrice.market_cap ? parseFloat(dbPrice.market_cap) : null,
      dbPrice.volume_24h ? parseFloat(dbPrice.volume_24h) : null,
      dbPrice.timestamp,
      dbPrice.source,
      dbPrice.granularity,
      dbPrice.created_at,
    );
  }

  private toDatabaseModel(entity: PriceHistoryEntity): NewPriceHistory {
    return {
      id: entity.id,
      token_address: entity.tokenAddress,
      chain: entity.chain,
      price_usd: entity.priceUsd.toString(),
      price_change_24h: entity.priceChange24h?.toString() ?? null,
      market_cap: entity.marketCap?.toString() ?? null,
      volume_24h: entity.volume24h?.toString() ?? null,
      timestamp: entity.timestamp,
      source: entity.source,
      granularity: entity.granularity,
    };
  }

  async findById(id: string): Promise<PriceHistoryEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findLatestByToken(
    tokenAddress: string,
    chain: string,
  ): Promise<PriceHistoryEntity | null> {
    const result = await this.db
      .selectFrom('price_history')
      .selectAll()
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findByTokenAndTimeRange(
    tokenAddress: string,
    chain: string,
    startTime: Date,
    endTime: Date,
    granularity?: string,
  ): Promise<PriceHistoryEntity[]> {
    let query = this.db
      .selectFrom('price_history')
      .selectAll()
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .where('timestamp', '>=', startTime)
      .where('timestamp', '<=', endTime);

    if (granularity) {
      query = query.where('granularity', '=', granularity);
    }

    const results = await query.orderBy('timestamp', 'asc').execute();

    return results.map((r) => this.toDomainModel(r));
  }

  async findByTokenAndDate(
    tokenAddress: string,
    chain: string,
    date: Date,
    granularity?: string,
  ): Promise<PriceHistoryEntity | null> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let query = this.db
      .selectFrom('price_history')
      .selectAll()
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<=', endOfDay);

    if (granularity) {
      query = query.where('granularity', '=', granularity);
    }

    const result = await query
      .orderBy('timestamp', 'desc')
      .limit(1)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findMultipleTokensLatest(
    tokens: Array<{ address: string; chain: string }>,
  ): Promise<PriceHistoryEntity[]> {
    if (tokens.length === 0) return [];

    const conditions = tokens.map(
      (token) =>
        sql`(token_address = ${token.address.toLowerCase()} AND chain = ${token.chain})`,
    );

    const query = sql`
      WITH ranked_prices AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY token_address, chain
            ORDER BY timestamp DESC
          ) as rn
        FROM price_history
        WHERE ${sql.join(conditions, sql` OR `)}
      )
      SELECT * FROM ranked_prices WHERE rn = 1
    `;

    const results = await query.execute(this.db);
    return results.rows.map((r: any) => this.toDomainModel(r));
  }

  async create(entity: PriceHistoryEntity): Promise<PriceHistoryEntity> {
    const dbModel = this.toDatabaseModel(entity);
    const result = await this.repository.create(dbModel);
    return this.toDomainModel(result);
  }

  async createBatch(entities: PriceHistoryEntity[]): Promise<void> {
    if (entities.length === 0) return;

    const dbModels = entities.map((e) => this.toDatabaseModel(e));

    await this.db
      .insertInto('price_history')
      .values(dbModels)
      .onConflict((oc) =>
        oc
          .columns([
            'token_address',
            'chain',
            'timestamp',
            'granularity',
            'source',
          ])
          .doUpdateSet({
            price_usd: (eb) => eb.ref('excluded.price_usd'),
            price_change_24h: (eb) => eb.ref('excluded.price_change_24h'),
            market_cap: (eb) => eb.ref('excluded.market_cap'),
            volume_24h: (eb) => eb.ref('excluded.volume_24h'),
          }),
      )
      .execute();
  }

  async upsert(entity: PriceHistoryEntity): Promise<PriceHistoryEntity> {
    const dbModel = this.toDatabaseModel(entity);

    const result = await this.db
      .insertInto('price_history')
      .values(dbModel)
      .onConflict((oc) =>
        oc
          .columns([
            'token_address',
            'chain',
            'timestamp',
            'granularity',
            'source',
          ])
          .doUpdateSet({
            price_usd: (eb) => eb.ref('excluded.price_usd'),
            price_change_24h: (eb) => eb.ref('excluded.price_change_24h'),
            market_cap: (eb) => eb.ref('excluded.market_cap'),
            volume_24h: (eb) => eb.ref('excluded.volume_24h'),
          }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toDomainModel(result);
  }

  async deleteOlderThan(date: Date, granularity?: string): Promise<number> {
    let query = this.db
      .deleteFrom('price_history')
      .where('timestamp', '<', date);

    if (granularity) {
      query = query.where('granularity', '=', granularity);
    }

    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  async getAveragePriceForPeriod(
    tokenAddress: string,
    chain: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number | null> {
    const result = await this.db
      .selectFrom('price_history')
      .select(sql<number>`AVG(CAST(price_usd AS NUMERIC))`.as('avg_price'))
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .executeTakeFirst();

    return result?.avg_price ?? null;
  }

  async getHighLowForPeriod(
    tokenAddress: string,
    chain: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ high: number; low: number } | null> {
    const result = await this.db
      .selectFrom('price_history')
      .select([
        sql<number>`MAX(CAST(price_usd AS NUMERIC))`.as('high'),
        sql<number>`MIN(CAST(price_usd AS NUMERIC))`.as('low'),
      ])
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .executeTakeFirst();

    if (!result || result.high === null || result.low === null) {
      return null;
    }

    return {
      high: result.high,
      low: result.low,
    };
  }
}
