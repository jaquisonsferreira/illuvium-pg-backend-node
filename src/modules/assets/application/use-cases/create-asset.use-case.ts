import { Injectable, Inject } from '@nestjs/common';
import { Asset } from '../../domain/entities/asset.entity';
import { AssetRepositoryInterface } from '../../domain/repositories/asset.repository.interface';
import { CreateAssetDto } from '../dtos/create-asset.dto';
import { ASSET_REPOSITORY } from '../../constants';

@Injectable()
export class CreateAssetUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: AssetRepositoryInterface,
  ) {}

  async execute(createAssetDto: CreateAssetDto): Promise<Asset> {
    const asset = new Asset({
      name: createAssetDto.name,
      description: createAssetDto.description,
      imageUrl: createAssetDto.imageUrl,
      price: createAssetDto.price,
      tags: createAssetDto.tags,
    });

    return this.assetRepository.create(asset);
  }
}
