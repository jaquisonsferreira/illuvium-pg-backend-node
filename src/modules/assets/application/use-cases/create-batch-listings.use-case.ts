import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  ASSET_MARKETPLACE_REPOSITORY,
  BLOCKCHAIN_ASSET_REPOSITORY,
} from '../../constants';
import {
  AssetMarketplaceRepositoryInterface,
  BlockchainAssetRepositoryInterface,
} from '../../domain/repositories';
import { AssetMarketplace } from '../../domain/entities/asset-marketplace.entity';
import { CreateBatchListingsDto } from '../dtos/create-batch-listings.dto';

export interface BatchCreateResult {
  successCount: number;
  failureCount: number;
  created: AssetMarketplace[];
  errors: Array<{
    assetId: string;
    error: string;
  }>;
}

@Injectable()
export class CreateBatchListingsUseCase {
  constructor(
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly assetRepository: BlockchainAssetRepositoryInterface,
  ) {}

  async execute(dto: CreateBatchListingsDto): Promise<BatchCreateResult> {
    const { listings, sellerAddress } = dto;

    const result: BatchCreateResult = {
      successCount: 0,
      failureCount: 0,
      created: [],
      errors: [],
    };

    const assetIds = listings.map((listing) => listing.assetId);
    const uniqueAssetIds = [...new Set(assetIds)];

    if (uniqueAssetIds.length !== assetIds.length) {
      throw new BadRequestException('Duplicate asset IDs found in batch');
    }

    const validListings: AssetMarketplace[] = [];

    for (const listingData of listings) {
      try {
        const asset = await this.assetRepository.findById(listingData.assetId);

        if (!asset) {
          result.errors.push({
            assetId: listingData.assetId,
            error: 'Asset not found',
          });
          result.failureCount++;
          continue;
        }

        if (asset.ownerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
          result.errors.push({
            assetId: listingData.assetId,
            error: 'Only the asset owner can create a sale listing',
          });
          result.failureCount++;
          continue;
        }

        if (!asset.hasBalance()) {
          result.errors.push({
            assetId: listingData.assetId,
            error: 'Cannot sell asset with zero balance',
          });
          result.failureCount++;
          continue;
        }

        if (!listingData.price || BigInt(listingData.price) <= 0n) {
          result.errors.push({
            assetId: listingData.assetId,
            error: 'Price must be greater than zero',
          });
          result.failureCount++;
          continue;
        }

        const existingActiveSales =
          await this.marketplaceRepository.findActiveSalesForAsset(
            listingData.assetId,
          );
        if (existingActiveSales.length > 0) {
          result.errors.push({
            assetId: listingData.assetId,
            error: 'Asset already has an active sale listing',
          });
          result.failureCount++;
          continue;
        }

        if (listingData.expiresAt && listingData.expiresAt <= new Date()) {
          result.errors.push({
            assetId: listingData.assetId,
            error: 'Expiration date must be in the future',
          });
          result.failureCount++;
          continue;
        }

        const saleListing = new AssetMarketplace({
          assetId: listingData.assetId,
          listingType: 'SALE',
          price: listingData.price,
          currencyContract: listingData.currencyContract,
          sellerAddress,
          status: 'ACTIVE',
          expiresAt: listingData.expiresAt,
        });

        validListings.push(saleListing);
      } catch (error) {
        result.errors.push({
          assetId: listingData.assetId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failureCount++;
      }
    }

    if (validListings.length === 0) {
      throw new BadRequestException('No valid listings to create');
    }

    try {
      const createdListings =
        await this.marketplaceRepository.createMany(validListings);
      result.created = createdListings;
      result.successCount = createdListings.length;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create batch listings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return result;
  }
}
