import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ASSET_MARKETPLACE_REPOSITORY } from '../../constants';
import { AssetMarketplaceRepositoryInterface } from '../../domain/repositories';
import { UpdateBatchListingsDto } from '../dtos/update-batch-listings.dto';
import { AssetMarketplace } from '../../domain/entities/asset-marketplace.entity';

export interface BatchUpdateResult {
  successCount: number;
  failureCount: number;
  updated: AssetMarketplace[];
  errors: Array<{
    listingId: string;
    error: string;
  }>;
}

@Injectable()
export class UpdateBatchListingsUseCase {
  constructor(
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
  ) {}

  async execute(dto: UpdateBatchListingsDto): Promise<BatchUpdateResult> {
    const { updates, sellerAddress } = dto;

    const result: BatchUpdateResult = {
      successCount: 0,
      failureCount: 0,
      updated: [],
      errors: [],
    };

    const listingIds = updates.map((update) => update.listingId);
    const uniqueListingIds = [...new Set(listingIds)];
    if (uniqueListingIds.length !== listingIds.length) {
      throw new BadRequestException('Duplicate listing IDs found in batch');
    }

    for (const updateData of updates) {
      try {
        const listing = await this.marketplaceRepository.findById(
          updateData.listingId,
        );

        if (!listing) {
          result.errors.push({
            listingId: updateData.listingId,
            error: 'Listing not found',
          });
          result.failureCount++;
          continue;
        }

        if (
          listing.sellerAddress.toLowerCase() !== sellerAddress.toLowerCase()
        ) {
          result.errors.push({
            listingId: updateData.listingId,
            error: 'Only the seller can update this listing',
          });
          result.failureCount++;
          continue;
        }

        if (!listing.isActive()) {
          result.errors.push({
            listingId: updateData.listingId,
            error: 'Listing cannot be updated (not active)',
          });
          result.failureCount++;
          continue;
        }

        const updateFields: Partial<AssetMarketplace> = {};

        if (updateData.price !== undefined) {
          if (!updateData.price || BigInt(updateData.price) <= 0n) {
            result.errors.push({
              listingId: updateData.listingId,
              error: 'Price must be greater than zero',
            });
            result.failureCount++;
            continue;
          }
          updateFields.price = updateData.price;
        }

        if (updateData.expiresAt !== undefined) {
          if (updateData.expiresAt && updateData.expiresAt <= new Date()) {
            result.errors.push({
              listingId: updateData.listingId,
              error: 'Expiration date must be in the future',
            });
            result.failureCount++;
            continue;
          }
          updateFields.expiresAt = updateData.expiresAt;
        }

        if (Object.keys(updateFields).length === 0) {
          result.errors.push({
            listingId: updateData.listingId,
            error: 'No valid fields to update',
          });
          result.failureCount++;
          continue;
        }

        const updatedListing = await this.marketplaceRepository.update(
          updateData.listingId,
          updateFields,
        );

        if (updatedListing) {
          result.updated.push(updatedListing);
          result.successCount++;
        } else {
          result.errors.push({
            listingId: updateData.listingId,
            error: 'Failed to update listing',
          });
          result.failureCount++;
        }
      } catch (error) {
        result.errors.push({
          listingId: updateData.listingId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failureCount++;
      }
    }

    if (result.successCount === 0) {
      throw new BadRequestException('No listings were successfully updated');
    }

    return result;
  }
}
