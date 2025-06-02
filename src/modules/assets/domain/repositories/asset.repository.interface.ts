import { Asset } from '../entities/asset.entity';

export interface AssetRepositoryInterface {
  create(asset: Asset): Promise<Asset>;
  findById(id: string): Promise<Asset | null>;
  findAll(): Promise<Asset[]>;
  update(id: string, asset: Partial<Asset>): Promise<Asset | null>;
  delete(id: string): Promise<boolean>;
}
