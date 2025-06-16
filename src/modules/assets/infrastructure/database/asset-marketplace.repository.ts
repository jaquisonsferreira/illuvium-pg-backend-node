import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import {
  Database,
  AssetMarketplace as AssetMarketplaceDB,
  NewAssetMarketplace,
  AssetMarketplaceUpdate,
} from '../../../../shared/infrastructure/database/database.types';
import {
  AssetMarketplace,
  ListingType,
  ListingStatus,
} from '../../domain/entities/asset-marketplace.entity';
import { BlockchainAsset } from '../../domain/entities/blockchain-asset.entity';
import { BlockchainContract } from '../../domain/entities/blockchain-contract.entity';
import {
  AssetMarketplaceRepositoryInterface,
  MarketplaceSearchFilters,
} from '../../domain/repositories/asset-marketplace.repository.interface';

@Injectable()
export class AssetMarketplaceRepository
  implements AssetMarketplaceRepositoryInterface
{
  constructor(private readonly db: Kysely<Database>) {}

  private toDomainEntity(
    row: AssetMarketplaceDB,
    asset?: BlockchainAsset,
    currency?: BlockchainContract,
  ): AssetMarketplace {
    return new AssetMarketplace({
      id: row.id,
      assetId: row.asset_id,
      listingType: row.listing_type as ListingType,
      price: row.price,
      currencyContract: row.currency_contract || undefined,
      sellerAddress: row.seller_address,
      buyerAddress: row.buyer_address || undefined,
      status: row.status as ListingStatus,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      asset,
      currency,
    });
  }

  private toNewDatabase(listing: AssetMarketplace): NewAssetMarketplace {
    return {
      id: listing.id,
      asset_id: listing.assetId,
      listing_type: listing.listingType,
      price: listing.price,
      currency_contract: listing.currencyContract || null,
      seller_address: listing.sellerAddress,
      buyer_address: listing.buyerAddress || null,
      status: listing.status,
      expires_at: listing.expiresAt || null,
      created_at: listing.createdAt,
      updated_at: listing.updatedAt,
    };
  }

  private toUpdateDatabase(
    listing: Partial<AssetMarketplace>,
  ): AssetMarketplaceUpdate {
    const update: AssetMarketplaceUpdate = {};

    if (listing.assetId !== undefined) update.asset_id = listing.assetId;
    if (listing.listingType !== undefined)
      update.listing_type = listing.listingType;
    if (listing.price !== undefined) update.price = listing.price;
    if (listing.currencyContract !== undefined)
      update.currency_contract = listing.currencyContract || null;
    if (listing.sellerAddress !== undefined)
      update.seller_address = listing.sellerAddress;
    if (listing.buyerAddress !== undefined)
      update.buyer_address = listing.buyerAddress || null;
    if (listing.status !== undefined) update.status = listing.status;
    if (listing.expiresAt !== undefined)
      update.expires_at = listing.expiresAt || null;
    if (listing.updatedAt !== undefined) update.updated_at = listing.updatedAt;

    return update;
  }

  async create(listing: AssetMarketplace): Promise<AssetMarketplace> {
    const newListing = this.toNewDatabase(listing);

    const row = await this.db
      .insertInto('asset_marketplace')
      .values(newListing)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toDomainEntity(row);
  }

  async findById(id: string): Promise<AssetMarketplace | null> {
    const row = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async findByAsset(assetId: string): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('asset_id', '=', assetId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findBySeller(sellerAddress: string): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('seller_address', '=', sellerAddress.toLowerCase())
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findByBuyer(buyerAddress: string): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('buyer_address', '=', buyerAddress.toLowerCase())
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findAll(): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async update(
    id: string,
    listing: Partial<AssetMarketplace>,
  ): Promise<AssetMarketplace | null> {
    const updateData = this.toUpdateDatabase(listing);

    updateData.updated_at = new Date();

    const row = await this.db
      .updateTable('asset_marketplace')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('asset_marketplace')
      .where('id', '=', id)
      .execute();

    return Number(result[0]?.numDeletedRows) > 0;
  }

  async search(filters: MarketplaceSearchFilters): Promise<{
    listings: AssetMarketplace[];
    total: number;
  }> {
    let query = this.db.selectFrom('asset_marketplace').selectAll();

    if (filters.assetIds?.length) {
      query = query.where('asset_id', 'in', filters.assetIds);
    }

    if (filters.listingTypes?.length) {
      query = query.where('listing_type', 'in', filters.listingTypes);
    }

    if (filters.statuses?.length) {
      query = query.where('status', 'in', filters.statuses);
    }

    if (filters.sellerAddresses?.length) {
      const normalizedAddresses = filters.sellerAddresses.map((addr) =>
        addr.toLowerCase(),
      );
      query = query.where('seller_address', 'in', normalizedAddresses);
    }

    if (filters.buyerAddresses?.length) {
      const normalizedAddresses = filters.buyerAddresses.map((addr) =>
        addr.toLowerCase(),
      );
      query = query.where('buyer_address', 'in', normalizedAddresses);
    }

    if (filters.currencyContracts?.length) {
      query = query.where('currency_contract', 'in', filters.currencyContracts);
    }

    if (filters.priceMin) {
      query = query.where('price', '>=', filters.priceMin);
    }

    if (filters.priceMax) {
      query = query.where('price', '<=', filters.priceMax);
    }

    if (filters.expiresAfter) {
      query = query.where('expires_at', '>=', filters.expiresAfter);
    }

    if (filters.expiresBefore) {
      query = query.where('expires_at', '<=', filters.expiresBefore);
    }

    const countQuery = query.select((eb) => eb.fn.count('id').as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);

    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    if (filters.limit) {
      query = query.limit(Math.min(filters.limit, 100));
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const rows = await query.execute();
    const listings = rows.map((row) => this.toDomainEntity(row));

    return { listings, total };
  }

  async findActiveListings(): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findActiveSales(): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('price', 'asc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findActiveBids(): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('listing_type', '=', 'BID')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('price', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findExpiredListings(): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('status', '=', 'ACTIVE')
      .where('expires_at', '<=', new Date())
      .orderBy('expires_at', 'asc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findActiveSalesForAsset(assetId: string): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('asset_id', '=', assetId)
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('price', 'asc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findActiveBidsForAsset(assetId: string): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('asset_id', '=', assetId)
      .where('listing_type', '=', 'BID')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('price', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findBestBidForAsset(assetId: string): Promise<AssetMarketplace | null> {
    const row = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('asset_id', '=', assetId)
      .where('listing_type', '=', 'BID')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('price', 'desc')
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async findLowestSaleForAsset(
    assetId: string,
  ): Promise<AssetMarketplace | null> {
    const row = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('asset_id', '=', assetId)
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('price', 'asc')
      .executeTakeFirst();

    if (!row) return null;
    return this.toDomainEntity(row);
  }

  async findUserActiveSales(
    sellerAddress: string,
  ): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('seller_address', '=', sellerAddress.toLowerCase())
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findUserActiveBids(buyerAddress: string): Promise<AssetMarketplace[]> {
    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where('buyer_address', '=', buyerAddress.toLowerCase())
      .where('listing_type', '=', 'BID')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async findUserCompletedTransactions(
    address: string,
  ): Promise<AssetMarketplace[]> {
    const normalizedAddress = address.toLowerCase();

    const rows = await this.db
      .selectFrom('asset_marketplace')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('seller_address', '=', normalizedAddress),
          eb('buyer_address', '=', normalizedAddress),
        ]),
      )
      .where('status', '=', 'COMPLETED')
      .orderBy('updated_at', 'desc')
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async createMany(listings: AssetMarketplace[]): Promise<AssetMarketplace[]> {
    if (listings.length === 0) return [];
    if (listings.length > 100) {
      throw new Error('Cannot create more than 100 listings at once');
    }

    const newListings = listings.map((listing) => this.toNewDatabase(listing));

    const rows = await this.db
      .insertInto('asset_marketplace')
      .values(newListings)
      .returningAll()
      .execute();

    return rows.map((row) => this.toDomainEntity(row));
  }

  async markAsExpired(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    if (ids.length > 100) {
      throw new Error('Cannot update more than 100 listings at once');
    }

    try {
      const result = await this.db
        .updateTable('asset_marketplace')
        .set({
          status: 'EXPIRED',
          updated_at: new Date(),
        })
        .where('id', 'in', ids)
        .where('status', '=', 'ACTIVE')
        .execute();

      return Number(result[0]?.numUpdatedRows) > 0;
    } catch (error) {
      console.error('Error marking listings as expired:', error);
      return false;
    }
  }

  async cancelListings(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    if (ids.length > 100) {
      throw new Error('Cannot update more than 100 listings at once');
    }

    try {
      const result = await this.db
        .updateTable('asset_marketplace')
        .set({
          status: 'CANCELLED',
          updated_at: new Date(),
        })
        .where('id', 'in', ids)
        .where('status', '=', 'ACTIVE')
        .execute();

      return Number(result[0]?.numUpdatedRows) > 0;
    } catch (error) {
      console.error('Error cancelling listings:', error);
      return false;
    }
  }

  async countActiveSales(): Promise<number> {
    const result = await this.db
      .selectFrom('asset_marketplace')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async countActiveBids(): Promise<number> {
    const result = await this.db
      .selectFrom('asset_marketplace')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('listing_type', '=', 'BID')
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date()),
        ]),
      )
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async getTotalVolumeByAsset(assetId: string): Promise<string> {
    const result = await this.db
      .selectFrom('asset_marketplace')
      .select((eb) => eb.fn.sum('price').as('totalVolume'))
      .where('asset_id', '=', assetId)
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'COMPLETED')
      .executeTakeFirst();

    return result?.totalVolume?.toString() || '0';
  }

  async getTotalVolumeByUser(address: string): Promise<string> {
    const normalizedAddress = address.toLowerCase();

    const result = await this.db
      .selectFrom('asset_marketplace')
      .select((eb) => eb.fn.sum('price').as('totalVolume'))
      .where((eb) =>
        eb.or([
          eb('seller_address', '=', normalizedAddress),
          eb('buyer_address', '=', normalizedAddress),
        ]),
      )
      .where('status', '=', 'COMPLETED')
      .executeTakeFirst();

    return result?.totalVolume?.toString() || '0';
  }

  async getAveragePriceByAsset(assetId: string): Promise<string | null> {
    const result = await this.db
      .selectFrom('asset_marketplace')
      .select((eb) => eb.fn.avg('price').as('avgPrice'))
      .where('asset_id', '=', assetId)
      .where('listing_type', '=', 'SALE')
      .where('status', '=', 'COMPLETED')
      .executeTakeFirst();

    return result?.avgPrice?.toString() || null;
  }
}
