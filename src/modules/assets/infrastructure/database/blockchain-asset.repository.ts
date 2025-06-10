import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import {
  Database,
  BlockchainAsset as BlockchainAssetDB,
  NewBlockchainAsset,
  BlockchainAssetUpdate,
} from '../../../../shared/infrastructure/database/database.types';
import { BlockchainAsset } from '../../domain/entities/blockchain-asset.entity';
import { BlockchainContract } from '../../domain/entities/blockchain-contract.entity';
import {
  BlockchainAssetRepositoryInterface,
  AssetSearchFilters,
} from '../../domain/repositories/blockchain-asset.repository.interface';

@Injectable()
export class BlockchainAssetRepository
  implements BlockchainAssetRepositoryInterface
{
  constructor(private readonly db: Kysely<Database>) {}

  private toDomainEntity(
    row: BlockchainAssetDB,
    contract?: BlockchainContract,
  ): BlockchainAsset {
    return new BlockchainAsset({
      id: row.id,
      contractId: row.contract_id,
      tokenId: row.token_id || undefined,
      ownerAddress: row.owner_address,
      balance: row.balance,
      metadata: row.metadata as Record<string, any> | undefined,
      lastUpdatedBlock: row.last_updated_block,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      contract,
    });
  }

  private toNewDatabase(asset: BlockchainAsset): NewBlockchainAsset {
    return {
      id: asset.id,
      contract_id: asset.contractId,
      token_id: asset.tokenId || null,
      owner_address: asset.ownerAddress,
      balance: asset.balance,
      metadata: asset.metadata || null,
      last_updated_block: asset.lastUpdatedBlock,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
    };
  }

  private toUpdateDatabase(
    asset: Partial<BlockchainAsset>,
  ): BlockchainAssetUpdate {
    const update: BlockchainAssetUpdate = {};

    if (asset.contractId !== undefined) update.contract_id = asset.contractId;
    if (asset.tokenId !== undefined) update.token_id = asset.tokenId || null;
    if (asset.ownerAddress !== undefined)
      update.owner_address = asset.ownerAddress;
    if (asset.balance !== undefined) update.balance = asset.balance;
    if (asset.metadata !== undefined) update.metadata = asset.metadata || null;
    if (asset.lastUpdatedBlock !== undefined)
      update.last_updated_block = asset.lastUpdatedBlock;
    if (asset.updatedAt !== undefined) update.updated_at = asset.updatedAt;

    return update;
  }

  async create(asset: BlockchainAsset): Promise<BlockchainAsset> {
    const newAsset = this.toNewDatabase(asset);

    const row = await this.db
      .insertInto('blockchain_assets')
      .values(newAsset)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toDomainEntity(row);
  }

  async findById(id: string): Promise<BlockchainAsset | null> {
    const row = await this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async findByContractAndToken(
    contractId: string,
    tokenId?: string,
  ): Promise<BlockchainAsset | null> {
    let query = this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .where('contract_id', '=', contractId);

    if (tokenId !== undefined) {
      query = query.where('token_id', '=', tokenId);
    } else {
      query = query.where('token_id', 'is', null);
    }

    const row = await query.executeTakeFirst();
    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async findByOwner(ownerAddress: string): Promise<BlockchainAsset[]> {
    const rows = await this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .where('owner_address', '=', ownerAddress.toLowerCase())
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByContract(contractId: string): Promise<BlockchainAsset[]> {
    const rows = await this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .where('contract_id', '=', contractId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findAll(): Promise<BlockchainAsset[]> {
    const rows = await this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async update(
    id: string,
    asset: Partial<BlockchainAsset>,
  ): Promise<BlockchainAsset | null> {
    const updateData = this.toUpdateDatabase(asset);

    updateData.updated_at = new Date();

    const row = await this.db
      .updateTable('blockchain_assets')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('blockchain_assets')
      .where('id', '=', id)
      .execute();

    return Number(result[0]?.numDeletedRows) > 0;
  }

  async search(filters: AssetSearchFilters): Promise<{
    assets: BlockchainAsset[];
    total: number;
  }> {
    let query = this.db.selectFrom('blockchain_assets').selectAll();

    if (filters.ownerAddresses?.length) {
      const lowercaseAddresses = filters.ownerAddresses.map((addr) =>
        addr.toLowerCase(),
      );
      query = query.where('owner_address', 'in', lowercaseAddresses);
    }

    if (filters.contractIds?.length) {
      query = query.where('contract_id', 'in', filters.contractIds);
    }

    if (filters.contractAddresses?.length) {
      const contractSubquery = this.db
        .selectFrom('blockchain_contracts')
        .select('id')
        .where(
          'address',
          'in',
          filters.contractAddresses.map((addr) => addr.toLowerCase()),
        );

      query = query.where('contract_id', 'in', contractSubquery);
    }

    if (filters.tokenIds?.length) {
      query = query.where('token_id', 'in', filters.tokenIds);
    }

    if (filters.hasBalance === true) {
      query = query.where('balance', '!=', '0');
    } else if (filters.hasBalance === false) {
      query = query.where('balance', '=', '0');
    }

    // TODO: Implement metadata filtering

    const countQuery = query.select((eb) => eb.fn.count('id').as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);

    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    if (filters.limit) {
      query = query.limit(Math.min(filters.limit, 100)); // Max 100 items
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const rows = await query.execute();
    const assets = rows.map((row) => this.toDomainEntity(row));

    return { assets, total };
  }

  async findByOwnerAndContract(
    ownerAddress: string,
    contractId: string,
  ): Promise<BlockchainAsset[]> {
    const rows = await this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .where('owner_address', '=', ownerAddress.toLowerCase())
      .where('contract_id', '=', contractId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByMetadata(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _metadata: Record<string, any>,
  ): Promise<BlockchainAsset[]> {
    // TODO: Implement proper JSON metadata filtering
    console.warn('findByMetadata not yet implemented - returning empty array');
    return [];
  }

  async findWithBalance(): Promise<BlockchainAsset[]> {
    const rows = await this.db
      .selectFrom('blockchain_assets')
      .selectAll()
      .where('balance', '!=', '0')
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async createMany(assets: BlockchainAsset[]): Promise<BlockchainAsset[]> {
    if (assets.length === 0) return [];
    if (assets.length > 100) {
      throw new Error('Cannot create more than 100 assets at once');
    }

    const newAssets = assets.map((asset) => this.toNewDatabase(asset));

    const rows = await this.db
      .insertInto('blockchain_assets')
      .values(newAssets)
      .returningAll()
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async updateBalances(
    updates: Array<{ id: string; balance: string; blockNumber: string }>,
  ): Promise<boolean> {
    if (updates.length === 0) return true;
    if (updates.length > 100) {
      throw new Error('Cannot update more than 100 assets at once');
    }

    try {
      await this.db.transaction().execute(async (trx) => {
        for (const update of updates) {
          await trx
            .updateTable('blockchain_assets')
            .set({
              balance: update.balance,
              last_updated_block: update.blockNumber,
              updated_at: new Date(),
            })
            .where('id', '=', update.id)
            .execute();
        }
      });
      return true;
    } catch (error) {
      console.error('Error updating balances:', error);
      return false;
    }
  }

  async updateOwners(
    updates: Array<{ id: string; ownerAddress: string; blockNumber: string }>,
  ): Promise<boolean> {
    if (updates.length === 0) return true;
    if (updates.length > 100) {
      throw new Error('Cannot update more than 100 assets at once');
    }

    try {
      await this.db.transaction().execute(async (trx) => {
        for (const update of updates) {
          await trx
            .updateTable('blockchain_assets')
            .set({
              owner_address: update.ownerAddress.toLowerCase(),
              last_updated_block: update.blockNumber,
              updated_at: new Date(),
            })
            .where('id', '=', update.id)
            .execute();
        }
      });
      return true;
    } catch (error) {
      console.error('Error updating owners:', error);
      return false;
    }
  }

  async countByOwner(ownerAddress: string): Promise<number> {
    const result = await this.db
      .selectFrom('blockchain_assets')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('owner_address', '=', ownerAddress.toLowerCase())
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async countByContract(contractId: string): Promise<number> {
    const result = await this.db
      .selectFrom('blockchain_assets')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('contract_id', '=', contractId)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async getTotalValueByOwner(ownerAddress: string): Promise<string> {
    const result = await this.db
      .selectFrom('blockchain_assets')
      .select((eb) => eb.fn.sum('balance').as('totalValue'))
      .where('owner_address', '=', ownerAddress.toLowerCase())
      .executeTakeFirst();

    return result?.totalValue?.toString() || '0';
  }
}
