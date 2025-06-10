import { Injectable, Inject } from '@nestjs/common';
import { BlockchainAsset } from '../../domain/entities/blockchain-asset.entity';
import {
  BlockchainAssetRepositoryInterface,
  AssetSearchFilters,
} from '../../domain/repositories/blockchain-asset.repository.interface';
import { BLOCKCHAIN_ASSET_REPOSITORY } from '../../constants';

export interface SearchBlockchainAssetsDto {
  ownerAddresses?: string[];
  contractIds?: string[];
  contractAddresses?: string[];
  tokenIds?: string[];
  hasBalance?: boolean;
  metadata?: Record<string, any>;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'balance';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchBlockchainAssetsResult {
  assets: BlockchainAsset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class SearchBlockchainAssetsUseCase {
  constructor(
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly assetRepository: BlockchainAssetRepositoryInterface,
  ) {}

  async execute(
    searchDto: SearchBlockchainAssetsDto,
  ): Promise<SearchBlockchainAssetsResult> {
    const limit = Math.min(searchDto.limit || 20, 100);
    const offset = searchDto.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const filters: AssetSearchFilters = {
      ownerAddresses: searchDto.ownerAddresses,
      contractIds: searchDto.contractIds,
      contractAddresses: searchDto.contractAddresses,
      tokenIds: searchDto.tokenIds,
      hasBalance: searchDto.hasBalance,
      metadata: searchDto.metadata,
      limit,
      offset,
      sortBy: searchDto.sortBy || 'created_at',
      sortOrder: searchDto.sortOrder || 'desc',
    };

    const result = await this.assetRepository.search(filters);

    const totalPages = Math.ceil(result.total / limit);

    return {
      assets: result.assets,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }
}
