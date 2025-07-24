import { Inject, Injectable } from '@nestjs/common';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { VaultPositionEntity } from '../../domain/entities/vault-position.entity';
import {
  Database,
  VaultPosition as DbVaultPosition,
  NewVaultPosition,
  VaultPositionUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class VaultPositionRepository implements IVaultPositionRepository {
  private repository: BaseRepository<
    'vault_positions',
    DbVaultPosition,
    NewVaultPosition,
    VaultPositionUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'vault_positions',
      DbVaultPosition,
      NewVaultPosition,
      VaultPositionUpdate
    >('vault_positions');
  }

  private toDomainModel(dbPosition: DbVaultPosition): VaultPositionEntity {
    return new VaultPositionEntity(
      dbPosition.id,
      dbPosition.wallet_address,
      dbPosition.vault_address,
      dbPosition.asset_symbol,
      dbPosition.chain,
      dbPosition.balance,
      dbPosition.shares,
      parseFloat(dbPosition.usd_value),
      dbPosition.lock_weeks || 4,
      dbPosition.snapshot_date,
      parseInt(dbPosition.block_number),
      dbPosition.created_at,
    );
  }

  private toDatabaseModel(entity: VaultPositionEntity): NewVaultPosition {
    return {
      id: entity.id,
      wallet_address: entity.walletAddress,
      vault_address: entity.vaultAddress,
      asset_symbol: entity.assetSymbol,
      chain: entity.chain,
      balance: entity.balance,
      shares: entity.shares,
      usd_value: entity.usdValue.toString(),
      lock_weeks: entity.lockWeeks,
      snapshot_date: entity.snapshotDate,
      block_number: entity.blockNumber.toString(),
    };
  }

  async findById(id: string): Promise<VaultPositionEntity | null> {
    const result = await this.repository.findById(id);
    return result ? this.toDomainModel(result) : null;
  }

  async findByWalletAndDate(
    walletAddress: string,
    snapshotDate: Date,
  ): Promise<VaultPositionEntity[]> {
    const normalizedDate = new Date(snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const results = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('snapshot_date', '=', normalizedDate)
      .execute();

    return results.map(this.toDomainModel);
  }

  async findByWalletAndSeason(
    walletAddress: string,
    seasonId: number,
  ): Promise<VaultPositionEntity[]> {
    const results = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .orderBy('snapshot_date', 'desc')
      .limit(10)
      .execute();

    return results.map(this.toDomainModel);
  }

  async findByWalletVaultAndSeason(
    walletAddress: string,
    vaultAddress: string,
    seasonId: number,
  ): Promise<VaultPositionEntity | null> {
    const result = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('wallet_address', '=', walletAddress.toLowerCase())
      .where('vault_address', '=', vaultAddress.toLowerCase())
      .orderBy('snapshot_date', 'desc')
      .executeTakeFirst();

    return result ? this.toDomainModel(result) : null;
  }

  async findActiveBySeason(seasonId: number): Promise<VaultPositionEntity[]> {
    const results = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('usd_value', '>', '0')
      .orderBy('snapshot_date', 'desc')
      .execute();

    return results.map(this.toDomainModel);
  }

  async findStalePositions(
    maxAge: Date,
    chain?: string,
  ): Promise<VaultPositionEntity[]> {
    let query = this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('snapshot_date', '<', maxAge);

    if (chain) {
      query = query.where('chain', '=', chain);
    }

    const results = await query.execute();
    return results.map(this.toDomainModel);
  }

  async findByVaultAndDate(
    vaultAddress: string,
    snapshotDate: Date,
  ): Promise<VaultPositionEntity[]> {
    const normalizedDate = new Date(snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const results = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('vault_address', '=', vaultAddress.toLowerCase())
      .where('snapshot_date', '=', normalizedDate)
      .execute();

    return results.map(this.toDomainModel);
  }

  async findLatestByWallet(
    walletAddress: string,
    chain?: string,
  ): Promise<VaultPositionEntity[]> {
    let query = this.db
      .selectFrom('vault_positions')
      .where('wallet_address', '=', walletAddress.toLowerCase());

    if (chain) {
      query = query.where('chain', '=', chain);
    }

    const latestDateResult = await query
      .select(({ fn }) => [fn.max('snapshot_date').as('latest_date')])
      .executeTakeFirst();

    if (!latestDateResult?.latest_date) {
      return [];
    }

    const results = await query
      .selectAll()
      .where('snapshot_date', '=', latestDateResult.latest_date)
      .execute();

    return results.map(this.toDomainModel);
  }

  async create(entity: VaultPositionEntity): Promise<VaultPositionEntity> {
    const data = this.toDatabaseModel(entity);
    const result = await this.repository.create(data);
    return this.toDomainModel(result);
  }

  async createBatch(entities: VaultPositionEntity[]): Promise<void> {
    if (entities.length === 0) return;

    const data = entities.map((entity) => this.toDatabaseModel(entity));

    await this.db.insertInto('vault_positions').values(data).execute();
  }

  async upsert(entity: VaultPositionEntity): Promise<VaultPositionEntity> {
    const normalizedDate = new Date(entity.snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const existing = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('wallet_address', '=', entity.walletAddress.toLowerCase())
      .where('vault_address', '=', entity.vaultAddress.toLowerCase())
      .where('snapshot_date', '=', normalizedDate)
      .executeTakeFirst();

    if (existing) {
      const data = this.toDatabaseModel(entity);
      await this.db
        .updateTable('vault_positions')
        .set(data)
        .where('id', '=', existing.id)
        .execute();

      const updated = await this.findById(existing.id);
      return updated!;
    }

    return this.create(entity);
  }

  async update(entity: VaultPositionEntity): Promise<VaultPositionEntity> {
    const data = this.toDatabaseModel(entity);
    await this.db
      .updateTable('vault_positions')
      .set(data)
      .where('id', '=', entity.id)
      .execute();

    const updated = await this.findById(entity.id);
    if (!updated) {
      throw new Error(`Vault position with id ${entity.id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('vault_positions').where('id', '=', id).execute();
  }

  async deleteByDateAndChain(
    snapshotDate: Date,
    chain: string,
  ): Promise<number> {
    const normalizedDate = new Date(snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const result = await this.db
      .deleteFrom('vault_positions')
      .where('snapshot_date', '=', normalizedDate)
      .where('chain', '=', chain)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  async getTotalValueLocked(
    chain: string,
    snapshotDate: Date,
  ): Promise<{
    totalUsdValue: number;
    byAsset: Record<string, number>;
  }> {
    const normalizedDate = new Date(snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const results = await this.db
      .selectFrom('vault_positions')
      .select(({ fn }) => [
        'asset_symbol',
        fn.sum<string>('usd_value').as('total_value'),
      ])
      .where('chain', '=', chain)
      .where('snapshot_date', '=', normalizedDate)
      .groupBy('asset_symbol')
      .execute();

    const byAsset: Record<string, number> = {};
    let totalUsdValue = 0;

    for (const row of results) {
      const value = row.total_value ? parseFloat(row.total_value) : 0;
      byAsset[row.asset_symbol] = value;
      totalUsdValue += value;
    }

    return { totalUsdValue, byAsset };
  }

  async getUniqueWalletCount(
    chain: string,
    snapshotDate: Date,
  ): Promise<number> {
    const normalizedDate = new Date(snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const result = await this.db
      .selectFrom('vault_positions')
      .select('wallet_address')
      .where('chain', '=', chain)
      .where('snapshot_date', '=', normalizedDate)
      .distinct()
      .execute();

    return result.length;
  }

  async getTopPositionsByValue(
    chain: string,
    snapshotDate: Date,
    limit: number,
  ): Promise<VaultPositionEntity[]> {
    const normalizedDate = new Date(snapshotDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const results = await this.db
      .selectFrom('vault_positions')
      .selectAll()
      .where('chain', '=', chain)
      .where('snapshot_date', '=', normalizedDate)
      .orderBy('usd_value', 'desc')
      .limit(limit)
      .execute();

    return results.map(this.toDomainModel);
  }
}
