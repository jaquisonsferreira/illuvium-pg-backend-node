import { Inject, Injectable } from '@nestjs/common';
import { ITokenMetadataRepository } from '../../domain/repositories/token-metadata.repository.interface';
import { TokenMetadataEntity } from '../../domain/entities/token-metadata.entity';
import {
  Database,
  TokenMetadata as DbTokenMetadata,
  NewTokenMetadata,
  TokenMetadataUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class TokenMetadataRepository implements ITokenMetadataRepository {
  private repository: BaseRepository<
    'token_metadata',
    DbTokenMetadata,
    NewTokenMetadata,
    TokenMetadataUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'token_metadata',
      DbTokenMetadata,
      NewTokenMetadata,
      TokenMetadataUpdate
    >('token_metadata');
  }

  private toDomainModel(dbToken: DbTokenMetadata): TokenMetadataEntity {
    return new TokenMetadataEntity(
      dbToken.id,
      dbToken.token_address,
      dbToken.chain,
      dbToken.symbol,
      dbToken.name,
      dbToken.decimals,
      dbToken.total_supply,
      dbToken.circulating_supply,
      dbToken.coingecko_id,
      dbToken.is_lp_token,
      dbToken.token0_address,
      dbToken.token1_address,
      dbToken.pool_address,
      dbToken.dex_name,
      dbToken.logo_url,
      dbToken.contract_type,
      dbToken.is_verified,
      dbToken.last_updated,
      dbToken.created_at,
      dbToken.updated_at,
    );
  }

  private toDatabaseModel(entity: TokenMetadataEntity): NewTokenMetadata {
    return {
      id: entity.id,
      token_address: entity.tokenAddress,
      chain: entity.chain,
      symbol: entity.symbol,
      name: entity.name,
      decimals: entity.decimals,
      total_supply: entity.totalSupply,
      circulating_supply: entity.circulatingSupply,
      coingecko_id: entity.coingeckoId,
      is_lp_token: entity.isLpToken,
      token0_address: entity.token0Address,
      token1_address: entity.token1Address,
      pool_address: entity.poolAddress,
      dex_name: entity.dexName,
      logo_url: entity.logoUrl,
      contract_type: entity.contractType,
      is_verified: entity.isVerified,
      last_updated: entity.lastUpdated,
    };
  }

  async findById(id: string): Promise<TokenMetadataEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findByAddress(
    tokenAddress: string,
    chain: string,
  ): Promise<TokenMetadataEntity | null> {
    const result = await this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findBySymbol(
    symbol: string,
    chain?: string,
  ): Promise<TokenMetadataEntity[]> {
    let query = this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where('symbol', '=', symbol);

    if (chain) {
      query = query.where('chain', '=', chain);
    }

    const results = await query.execute();
    return results.map((r) => this.toDomainModel(r));
  }

  async findByCoingeckoId(
    coingeckoId: string,
  ): Promise<TokenMetadataEntity | null> {
    const result = await this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where('coingecko_id', '=', coingeckoId)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findLpTokens(chain?: string): Promise<TokenMetadataEntity[]> {
    let query = this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where('is_lp_token', '=', true);

    if (chain) {
      query = query.where('chain', '=', chain);
    }

    const results = await query.execute();
    return results.map((r) => this.toDomainModel(r));
  }

  async findByPoolAddress(
    poolAddress: string,
    chain: string,
  ): Promise<TokenMetadataEntity | null> {
    const result = await this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where('pool_address', '=', poolAddress.toLowerCase())
      .where('chain', '=', chain)
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findStaleTokens(
    lastUpdatedBefore: Date,
    limit: number,
  ): Promise<TokenMetadataEntity[]> {
    const results = await this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where('last_updated', '<', lastUpdatedBefore)
      .orderBy('last_updated', 'asc')
      .limit(limit)
      .execute();

    return results.map((r) => this.toDomainModel(r));
  }

  async create(entity: TokenMetadataEntity): Promise<TokenMetadataEntity> {
    const dbModel = this.toDatabaseModel(entity);
    const result = await this.repository.create(dbModel);
    return this.toDomainModel(result);
  }

  async createBatch(entities: TokenMetadataEntity[]): Promise<void> {
    if (entities.length === 0) return;

    const dbModels = entities.map((e) => this.toDatabaseModel(e));

    await this.db.insertInto('token_metadata').values(dbModels).execute();
  }

  async update(entity: TokenMetadataEntity): Promise<TokenMetadataEntity> {
    const dbModel = this.toDatabaseModel(entity);
    const { id, ...updateData } = dbModel;

    const result = await this.db
      .updateTable('token_metadata')
      .set({
        ...updateData,
        updated_at: new Date(),
      })
      .where('id', '=', id!)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toDomainModel(result);
  }

  async upsert(entity: TokenMetadataEntity): Promise<TokenMetadataEntity> {
    const dbModel = this.toDatabaseModel(entity);

    const result = await this.db
      .insertInto('token_metadata')
      .values(dbModel)
      .onConflict((oc) =>
        oc.columns(['token_address', 'chain']).doUpdateSet({
          symbol: (eb) => eb.ref('excluded.symbol'),
          name: (eb) => eb.ref('excluded.name'),
          decimals: (eb) => eb.ref('excluded.decimals'),
          total_supply: (eb) => eb.ref('excluded.total_supply'),
          circulating_supply: (eb) => eb.ref('excluded.circulating_supply'),
          coingecko_id: (eb) => eb.ref('excluded.coingecko_id'),
          logo_url: (eb) => eb.ref('excluded.logo_url'),
          is_verified: (eb) => eb.ref('excluded.is_verified'),
          last_updated: (eb) => eb.ref('excluded.last_updated'),
          updated_at: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toDomainModel(result);
  }

  async updateLastUpdated(
    tokenAddress: string,
    chain: string,
    timestamp: Date,
  ): Promise<void> {
    await this.db
      .updateTable('token_metadata')
      .set({
        last_updated: timestamp,
        updated_at: new Date(),
      })
      .where('token_address', '=', tokenAddress.toLowerCase())
      .where('chain', '=', chain)
      .execute();
  }

  async searchTokens(
    query: string,
    limit: number,
  ): Promise<TokenMetadataEntity[]> {
    const searchPattern = `%${query}%`;

    const results = await this.db
      .selectFrom('token_metadata')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('symbol', 'ilike', searchPattern),
          eb('name', 'ilike', searchPattern),
          eb('token_address', 'ilike', searchPattern),
        ]),
      )
      .orderBy('is_verified', 'desc')
      .orderBy('symbol', 'asc')
      .limit(limit)
      .execute();

    return results.map((r) => this.toDomainModel(r));
  }
}
