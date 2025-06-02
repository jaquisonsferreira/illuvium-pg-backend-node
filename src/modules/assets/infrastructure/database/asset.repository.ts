import { Inject, Injectable } from '@nestjs/common';
import { AssetRepositoryInterface } from '../../domain/repositories/asset.repository.interface';
import { Asset } from '../../domain/entities/asset.entity';
import {
  Asset as DbAsset,
  Database,
  NewAsset,
  AssetUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class AssetRepository implements AssetRepositoryInterface {
  private repository: BaseRepository<'assets', DbAsset, NewAsset, AssetUpdate>;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'assets',
      DbAsset,
      NewAsset,
      AssetUpdate
    >('assets');
  }

  private toDatabaseModel = (asset: Asset): NewAsset => {
    return {
      name: asset.name,
      description: asset.description,
      image_url: asset.imageUrl,
      price: asset.price,
      tags: asset.tags,
      ...(asset.id && { id: asset.id }),
    };
  };

  private toDomainModel = (dbAsset: DbAsset): Asset => {
    return new Asset({
      id: dbAsset.id,
      name: dbAsset.name,
      description: dbAsset.description,
      imageUrl: dbAsset.image_url,
      price: dbAsset.price,
      tags: dbAsset.tags,
    });
  };

  async create(asset: Asset): Promise<Asset> {
    try {
      const dbAsset = await this.repository.create(this.toDatabaseModel(asset));
      return this.toDomainModel(dbAsset);
    } catch (error) {
      console.error('error on create asset:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Asset | null> {
    try {
      const dbAsset = await this.repository.findById(id);
      return dbAsset ? this.toDomainModel(dbAsset) : null;
    } catch (error) {
      console.error(`error on findById asset: ${id}`, error);
      throw error;
    }
  }

  async findAll(): Promise<Asset[]> {
    try {
      const dbAssets = await this.repository.findAll();
      return dbAssets.map(this.toDomainModel);
    } catch (error) {
      console.error('error on findAll assets:', error);
      throw error;
    }
  }

  async update(id: string, assetData: Partial<Asset>): Promise<Asset | null> {
    try {
      const updateData: AssetUpdate = {};

      if (assetData.name !== undefined) updateData.name = assetData.name;
      if (assetData.description !== undefined)
        updateData.description = assetData.description;
      if (assetData.imageUrl !== undefined)
        updateData.image_url = assetData.imageUrl;
      if (assetData.price !== undefined) updateData.price = assetData.price;
      if (assetData.tags !== undefined) updateData.tags = assetData.tags;

      const dbAsset = await this.repository.update(id, updateData);
      return dbAsset ? this.toDomainModel(dbAsset) : null;
    } catch (error) {
      console.error(`error on update asset: ${id}`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      return await this.repository.delete(id);
    } catch (error) {
      console.error(`error on delete asset: ${id}`, error);
      throw error;
    }
  }

  async findByName(name: string): Promise<Asset[]> {
    try {
      const dbAssets = await this.db
        .selectFrom('assets')
        .selectAll()
        .where('name', 'like', `%${name}%`)
        .execute();

      return dbAssets.map((dbAsset) => this.toDomainModel(dbAsset as DbAsset));
    } catch (error) {
      console.error(`error on findByName asset: ${name}`, error);
      throw error;
    }
  }

  async findByTags(tags: string[]): Promise<Asset[]> {
    try {
      const allAssets = await this.db
        .selectFrom('assets')
        .selectAll()
        .where('tags', '&&', tags)
        .execute();
      return allAssets.map((asset) => this.toDomainModel(asset as DbAsset));
    } catch (error) {
      console.error(`error on findByTags asset: ${tags.join(', ')}`, error);
      throw error;
    }
  }
}
